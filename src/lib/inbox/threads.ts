/**
 * The inbox's store: contacts, threads and messages in D1.
 *
 * Every write that could arrive twice (a webhook retry, a double tap) goes
 * through INSERT OR IGNORE against a unique column and reports whether it
 * actually landed. Callers branch on that, never on a SELECT they did first.
 */

import { executeQuery, queryDatabase } from '@/lib/db';
import type {
  CustomerOrderRow,
  InboxAttachment,
  InboxChannel,
  InboxContact,
  InboxDirection,
  InboxMessage,
  InboxStatus,
  InboxThread,
  InboxTopic,
  LoopCodeRow,
  ThreadDetail,
  ThreadListRow,
} from './types';
import { INBOX_STATUSES, INBOX_TOPICS } from './types';
import { newToken, normalizeEmail, snippet } from './text';

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

/** True when INSERT OR IGNORE wrote a row. D1 reports it in meta.changes. */
function inserted(result: unknown): boolean {
  const meta = (result as { result?: { meta?: { changes?: number; rows_written?: number } }[] })?.result?.[0]?.meta;
  if (!meta) return true;
  if (typeof meta.changes === 'number') return meta.changes > 0;
  if (typeof meta.rows_written === 'number') return meta.rows_written > 0;
  return true;
}

// ── Contacts ────────────────────────────────────────────────────────────────

export async function findContactByEmail(email: string): Promise<InboxContact | null> {
  const rows = await queryDatabase('SELECT * FROM inbox_contacts WHERE email = ? LIMIT 1', [normalizeEmail(email)]);
  return (rows[0] as InboxContact) || null;
}

export async function findContactById(id: string): Promise<InboxContact | null> {
  const rows = await queryDatabase('SELECT * FROM inbox_contacts WHERE id = ? LIMIT 1', [id]);
  return (rows[0] as InboxContact) || null;
}

/**
 * One contact per address. A name given later fills a blank one but never
 * overwrites what the customer typed first. Links to `customers` by email
 * when a store account exists.
 */
export async function findOrCreateContact(email: string, name?: string | null, phone?: string | null): Promise<InboxContact> {
  const normalized = normalizeEmail(email);
  const existing = await findContactByEmail(normalized);
  const ts = now();
  if (existing) {
    const nextName = existing.name || name?.trim() || null;
    const nextPhone = existing.phone || phone?.trim() || null;
    await executeQuery('UPDATE inbox_contacts SET name = ?, phone = ?, last_seen_at = ? WHERE id = ?', [
      nextName,
      nextPhone,
      ts,
      existing.id,
    ]);
    return { ...existing, name: nextName, phone: nextPhone, last_seen_at: ts };
  }

  const customer = await queryDatabase('SELECT id, first_name, last_name, phone FROM customers WHERE LOWER(email) = ? LIMIT 1', [normalized]);
  const c = customer[0] as { id: string; first_name: string | null; last_name: string | null; phone: string | null } | undefined;
  const contact: InboxContact = {
    id: uuid(),
    email: normalized,
    name: name?.trim() || [c?.first_name, c?.last_name].filter(Boolean).join(' ') || null,
    phone: phone?.trim() || c?.phone || null,
    customer_id: c?.id || null,
    notes: null,
    first_seen_at: ts,
    last_seen_at: ts,
  };
  await executeQuery(
    `INSERT OR IGNORE INTO inbox_contacts (id, email, name, phone, customer_id, notes, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [contact.id, contact.email, contact.name, contact.phone, contact.customer_id, null, ts, ts],
  );
  // A concurrent insert may have won; the unique email decides.
  return (await findContactByEmail(normalized)) || contact;
}

export async function updateContactNotes(contactId: string, notes: string | null): Promise<void> {
  await executeQuery('UPDATE inbox_contacts SET notes = ? WHERE id = ?', [notes, contactId]);
}

// ── Threads ─────────────────────────────────────────────────────────────────

export async function findThreadById(id: string): Promise<InboxThread | null> {
  const rows = await queryDatabase('SELECT * FROM inbox_threads WHERE id = ? LIMIT 1', [id]);
  return (rows[0] as InboxThread) || null;
}

export async function findThreadByToken(token: string): Promise<InboxThread | null> {
  if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) return null;
  const rows = await queryDatabase('SELECT * FROM inbox_threads WHERE token = ? LIMIT 1', [token]);
  return (rows[0] as InboxThread) || null;
}

export async function openThread(input: {
  contact: InboxContact;
  subject?: string | null;
  topic?: InboxTopic;
  orderNumber?: string | null;
  status?: InboxStatus;
}): Promise<InboxThread> {
  const ts = now();
  const thread: InboxThread = {
    id: uuid(),
    contact_id: input.contact.id,
    token: newToken(),
    subject: input.subject?.trim() || null,
    topic: input.topic && INBOX_TOPICS.includes(input.topic) ? input.topic : 'general',
    status: input.status || 'open',
    order_number: input.orderNumber || null,
    last_message_at: ts,
    last_direction: 'in',
    unread_count: 0,
    ack_message_id: null,
    references_json: null,
    created_at: ts,
    updated_at: ts,
  };
  await executeQuery(
    `INSERT INTO inbox_threads (id, contact_id, token, subject, topic, status, order_number, last_message_at, last_direction, unread_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      thread.id,
      thread.contact_id,
      thread.token,
      thread.subject,
      thread.topic,
      thread.status,
      thread.order_number,
      ts,
      'in',
      0,
      ts,
      ts,
    ],
  );
  return thread;
}

export async function updateThread(
  id: string,
  patch: Partial<Pick<InboxThread, 'status' | 'topic' | 'order_number' | 'subject' | 'ack_message_id' | 'references_json'>>,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.status !== undefined) {
    if (!INBOX_STATUSES.includes(patch.status)) throw new Error('bad status');
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (patch.topic !== undefined) {
    if (!INBOX_TOPICS.includes(patch.topic)) throw new Error('bad topic');
    sets.push('topic = ?');
    params.push(patch.topic);
  }
  if (patch.order_number !== undefined) {
    sets.push('order_number = ?');
    params.push(patch.order_number);
  }
  if (patch.subject !== undefined) {
    sets.push('subject = ?');
    params.push(patch.subject);
  }
  if (patch.ack_message_id !== undefined) {
    sets.push('ack_message_id = ?');
    params.push(patch.ack_message_id);
  }
  if (patch.references_json !== undefined) {
    sets.push('references_json = ?');
    params.push(patch.references_json);
  }
  if (!sets.length) return;
  sets.push('updated_at = ?');
  params.push(now(), id);
  await executeQuery(`UPDATE inbox_threads SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function markThreadRead(id: string): Promise<void> {
  await executeQuery('UPDATE inbox_threads SET unread_count = 0 WHERE id = ?', [id]);
}

/** The most recent open or waiting thread for a contact, for cold replies. */
export async function latestLiveThreadForContact(contactId: string): Promise<InboxThread | null> {
  const rows = await queryDatabase(
    `SELECT * FROM inbox_threads WHERE contact_id = ? AND status IN ('open', 'waiting')
     ORDER BY last_message_at DESC LIMIT 1`,
    [contactId],
  );
  return (rows[0] as InboxThread) || null;
}

/** Find the thread a Message-ID belongs to: one we sent, or an acknowledgement. */
export async function findThreadByMessageIds(ids: string[]): Promise<InboxThread | null> {
  if (!ids.length) return null;
  const marks = ids.map(() => '?').join(', ');
  const viaMessage = await queryDatabase(
    `SELECT t.* FROM inbox_messages m JOIN inbox_threads t ON t.id = m.thread_id
     WHERE m.provider_message_id IN (${marks}) ORDER BY m.created_at DESC LIMIT 1`,
    ids,
  );
  if (viaMessage[0]) return viaMessage[0] as InboxThread;
  const viaAck = await queryDatabase(`SELECT * FROM inbox_threads WHERE ack_message_id IN (${marks}) LIMIT 1`, ids);
  return (viaAck[0] as InboxThread) || null;
}

// ── Messages ────────────────────────────────────────────────────────────────

export interface AppendMessageInput {
  threadId: string;
  direction: InboxDirection;
  channel: InboxChannel;
  bodyText: string;
  bodyHtml?: string | null;
  fromEmail?: string | null;
  resendEmailId?: string | null;
  providerMessageId?: string | null;
  submissionId?: string | null;
  deliveryStatus?: InboxMessage['delivery_status'];
  authorUserId?: string | null;
  createdAt?: string;
}

/**
 * Append a message and move the thread with it. Returns null when the unique
 * keys say this message already exists, so the caller can stop quietly.
 */
export async function appendMessage(input: AppendMessageInput): Promise<InboxMessage | null> {
  const ts = input.createdAt || now();
  const message: InboxMessage = {
    id: uuid(),
    thread_id: input.threadId,
    direction: input.direction,
    channel: input.channel,
    body_text: input.bodyText,
    body_html: input.bodyHtml ?? null,
    from_email: input.fromEmail ?? null,
    resend_email_id: input.resendEmailId ?? null,
    provider_message_id: input.providerMessageId ?? null,
    submission_id: input.submissionId ?? null,
    delivery_status: input.deliveryStatus ?? (input.direction === 'in' ? 'received' : input.direction === 'note' ? 'sent' : 'queued'),
    delivery_error: null,
    author_user_id: input.authorUserId ?? null,
    created_at: ts,
  };

  const result = await executeQuery(
    `INSERT OR IGNORE INTO inbox_messages
       (id, thread_id, direction, channel, body_text, body_html, from_email, resend_email_id, provider_message_id, submission_id, delivery_status, author_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.thread_id,
      message.direction,
      message.channel,
      message.body_text,
      message.body_html,
      message.from_email,
      message.resend_email_id,
      message.provider_message_id,
      message.submission_id,
      message.delivery_status,
      message.author_user_id,
      ts,
    ],
  );
  if (!inserted(result)) return null;

  if (input.direction === 'in') {
    await executeQuery(
      `UPDATE inbox_threads SET last_message_at = ?, last_direction = 'in', unread_count = unread_count + 1,
         status = 'open', updated_at = ? WHERE id = ?`,
      [ts, ts, input.threadId],
    );
  } else if (input.direction === 'out') {
    await executeQuery(
      `UPDATE inbox_threads SET last_message_at = ?, last_direction = 'out', status = CASE WHEN status = 'closed' THEN 'closed' ELSE 'waiting' END, updated_at = ? WHERE id = ?`,
      [ts, ts, input.threadId],
    );
  }
  return message;
}

export async function findMessageBySubmissionId(submissionId: string): Promise<InboxMessage | null> {
  const rows = await queryDatabase('SELECT * FROM inbox_messages WHERE submission_id = ? LIMIT 1', [submissionId]);
  return (rows[0] as InboxMessage) || null;
}

/** Remove a thread only if nothing was ever written to it. */
export async function deleteEmptyThread(threadId: string): Promise<void> {
  await executeQuery(
    'DELETE FROM inbox_threads WHERE id = ? AND NOT EXISTS (SELECT 1 FROM inbox_messages WHERE thread_id = inbox_threads.id)',
    [threadId],
  );
}

export async function setMessageDelivery(
  messageId: string,
  status: InboxMessage['delivery_status'],
  extra: { resendEmailId?: string | null; providerMessageId?: string | null; error?: string | null } = {},
): Promise<void> {
  await executeQuery(
    `UPDATE inbox_messages SET delivery_status = ?, delivery_error = ?,
       resend_email_id = COALESCE(?, resend_email_id), provider_message_id = COALESCE(?, provider_message_id)
     WHERE id = ?`,
    [status, extra.error ?? null, extra.resendEmailId ?? null, extra.providerMessageId ?? null, messageId],
  );
}

export async function messagesForThread(threadId: string, includeNotes: boolean): Promise<InboxMessage[]> {
  const sql = includeNotes
    ? 'SELECT * FROM inbox_messages WHERE thread_id = ? ORDER BY created_at ASC'
    : "SELECT * FROM inbox_messages WHERE thread_id = ? AND direction != 'note' ORDER BY created_at ASC";
  return (await queryDatabase(sql, [threadId])) as InboxMessage[];
}

/** The last thing sent out on a thread, for In-Reply-To / References. */
export async function lastMessageIds(threadId: string): Promise<{ lastInbound: string | null; chain: string[] }> {
  const rows = (await queryDatabase(
    `SELECT direction, provider_message_id FROM inbox_messages
     WHERE thread_id = ? AND provider_message_id IS NOT NULL ORDER BY created_at ASC`,
    [threadId],
  )) as { direction: InboxDirection; provider_message_id: string }[];
  const chain = rows.map((r) => r.provider_message_id);
  const lastInbound = [...rows].reverse().find((r) => r.direction === 'in')?.provider_message_id || null;
  return { lastInbound, chain };
}

export async function addAttachment(a: Omit<InboxAttachment, 'id'>): Promise<void> {
  await executeQuery(
    `INSERT INTO inbox_attachments (id, message_id, filename, content_type, size, download_url, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), a.message_id, a.filename, a.content_type, a.size, a.download_url, a.expires_at],
  );
}

// ── Reads for the admin ─────────────────────────────────────────────────────

export interface ListThreadsQuery {
  status?: InboxStatus | 'all';
  topic?: InboxTopic;
  q?: string;
  limit?: number;
  before?: string;
}

export async function listThreads(query: ListThreadsQuery): Promise<ThreadListRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.status && query.status !== 'all') {
    where.push('t.status = ?');
    params.push(query.status);
  }
  if (query.topic) {
    where.push('t.topic = ?');
    params.push(query.topic);
  }
  if (query.q?.trim()) {
    const like = `%${query.q.trim().toLowerCase()}%`;
    where.push('(LOWER(c.email) LIKE ? OR LOWER(COALESCE(c.name, \'\')) LIKE ? OR LOWER(COALESCE(t.subject, \'\')) LIKE ? OR COALESCE(t.order_number, \'\') LIKE ?)');
    params.push(like, like, like, like);
  }
  if (query.before) {
    where.push('t.last_message_at < ?');
    params.push(query.before);
  }
  const limit = Math.min(Math.max(query.limit || 50, 1), 200);
  params.push(limit);

  const rows = (await queryDatabase(
    `SELECT t.*, c.email AS contact_email, c.name AS contact_name,
       (SELECT body_text FROM inbox_messages m WHERE m.thread_id = t.id AND m.direction != 'note' ORDER BY m.created_at DESC LIMIT 1) AS last_body
     FROM inbox_threads t JOIN inbox_contacts c ON c.id = t.contact_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.last_message_at DESC LIMIT ?`,
    params,
  )) as (ThreadListRow & { last_body: string | null })[];

  return rows.map(({ last_body, ...row }) => ({ ...row, last_snippet: last_body ? snippet(last_body) : null }));
}

export async function unreadThreadCount(): Promise<number> {
  const rows = await queryDatabase('SELECT COUNT(*) AS n FROM inbox_threads WHERE unread_count > 0', []);
  return Number((rows[0] as { n: number } | undefined)?.n || 0);
}

export async function threadDetail(threadId: string): Promise<ThreadDetail | null> {
  const thread = await findThreadById(threadId);
  if (!thread) return null;
  const contact = await findContactById(thread.contact_id);
  if (!contact) return null;

  const [messages, attachments, orders, loopCodes, priorThreads] = await Promise.all([
    messagesForThread(thread.id, true),
    queryDatabase(
      `SELECT a.* FROM inbox_attachments a JOIN inbox_messages m ON m.id = a.message_id WHERE m.thread_id = ? ORDER BY a.created_at ASC`,
      [thread.id],
    ) as Promise<InboxAttachment[]>,
    queryDatabase(
      `SELECT id, order_number, total_amount, currency, status, payment_status, fulfillment_status, created_at
       FROM orders WHERE LOWER(customer_email) = ? ORDER BY created_at DESC LIMIT 25`,
      [contact.email],
    ) as Promise<CustomerOrderRow[]>,
    queryDatabase(
      `SELECT event_id, code, (redeemed_by IS NOT NULL) AS redeemed, created_at FROM event_codes WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 10`,
      [contact.email],
    ).catch(() => []) as Promise<LoopCodeRow[]>,
    queryDatabase(
      `SELECT id, subject, topic, status, last_message_at FROM inbox_threads WHERE contact_id = ? AND id != ? ORDER BY last_message_at DESC LIMIT 10`,
      [contact.id, thread.id],
    ) as Promise<ThreadDetail['priorThreads']>,
  ]);

  return {
    thread,
    contact,
    messages,
    attachments,
    orders,
    loopCodes: (loopCodes as (LoopCodeRow & { redeemed: number | boolean })[]).map((c) => ({ ...c, redeemed: Boolean(c.redeemed) })),
    priorThreads,
  };
}
