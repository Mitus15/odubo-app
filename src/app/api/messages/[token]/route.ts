import { NextRequest, NextResponse } from 'next/server';

import { notifyOwner } from '@/lib/inbox/alerts';
import { appendMessage, findContactById, findThreadByToken, messagesForThread } from '@/lib/inbox/threads';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * The customer's side of a thread, keyed by the unguessable token in their
 * link. Internal notes are filtered here and never leave the server.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const thread = await findThreadByToken(token);
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  const contact = await findContactById(thread.contact_id);
  const messages = await messagesForThread(thread.id, false);
  return NextResponse.json(
    {
      thread: { subject: thread.subject, status: thread.status, topic: thread.topic, order_number: thread.order_number },
      contact: { name: contact?.name || null, email: contact?.email || null },
      messages: messages.map((m) => ({ id: m.id, direction: m.direction, body_text: m.body_text, created_at: m.created_at, delivery_status: m.delivery_status })),
    },
    { headers: NO_STORE },
  );
}

/** POST { body, submissionId? } appends the customer's reply and wakes the owner. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limiter = await rateLimit({ key: `inbox:reply:${ip}`, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'Too many messages in a row. Give it a few minutes.' }, { status: 429, headers: NO_STORE });
  }

  const b = (await req.json().catch(() => null)) as { body?: string; submissionId?: string } | null;
  const text = b?.body?.trim();
  if (!text) return NextResponse.json({ error: 'Write something first' }, { status: 400, headers: NO_STORE });
  if (text.length > 10_000) return NextResponse.json({ error: 'That is too long for one message' }, { status: 400, headers: NO_STORE });

  const thread = await findThreadByToken(token);
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  const contact = await findContactById(thread.contact_id);
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });

  try {
    const message = await appendMessage({
      threadId: thread.id,
      direction: 'in',
      channel: 'web',
      bodyText: text,
      fromEmail: contact.email,
      submissionId: b?.submissionId && /^[A-Za-z0-9_-]{8,64}$/.test(b.submissionId) ? `web:${b.submissionId}` : null,
    });
    if (message) await notifyOwner(thread, contact, message);
    return NextResponse.json({ ok: true, duplicate: !message }, { status: message ? 201 : 200, headers: NO_STORE });
  } catch (err) {
    console.error('[inbox] customer reply:', err);
    return NextResponse.json({ error: 'Could not send. Try again in a moment.' }, { status: 500, headers: NO_STORE });
  }
}
