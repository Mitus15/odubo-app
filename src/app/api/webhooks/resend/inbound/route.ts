import { NextRequest, NextResponse } from 'next/server';

import { notifyOwner } from '@/lib/inbox/alerts';
import { fetchReceivedAttachment, fetchReceivedEmail, svixHeadersFrom, verifySvix, type ReceivedEvent } from '@/lib/inbox/resend-inbound';
import {
  cleanSubject,
  header,
  htmlToText,
  isAutomatedMail,
  parseAddress,
  parseMessageIds,
  stripQuotedReply,
  tokenFromRecipients,
} from '@/lib/inbox/text';
import {
  addAttachment,
  appendMessage,
  findContactById,
  findOrCreateContact,
  findThreadByMessageIds,
  findThreadByToken,
  latestLiveThreadForContact,
  openThread,
} from '@/lib/inbox/threads';
import { inboxFrom } from '@/lib/inbox/settings';

export const runtime = 'nodejs';

/**
 * Resend `email.received` → a message in the inbox.
 *
 * The webhook carries metadata only, so after the signature check the body
 * is fetched from Resend. Which thread the mail belongs to is decided in
 * this order, first hit wins:
 *   1. the thread token in a plus-address (support+<token>@…) on any recipient
 *   2. In-Reply-To / References matching a Message-ID we sent
 *   3. the sender has an open or waiting thread
 *   4. a new thread for the sender
 *
 * Retry semantics: 401 for a bad signature (Resend will not retry), 200 the
 * moment the message is safely stored or already known, 503 while it is not,
 * so Resend keeps trying. A duplicate delivery is one message because
 * `resend_email_id` is unique.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret || !apiKey) {
    console.error('[inbox:inbound] RESEND_WEBHOOK_SECRET or RESEND_API_KEY missing');
    return NextResponse.json({ error: 'Inbound mail not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const ok = await verifySvix(svixHeadersFrom((n) => request.headers.get(n)), rawBody, secret);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: ReceivedEvent;
  try {
    event = JSON.parse(rawBody) as ReceivedEvent;
  } catch {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }
  if (event.type !== 'email.received' || !event.data?.email_id) {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  try {
    const email = await fetchReceivedEmail(event.data.email_id, apiKey);
    const from = parseAddress(email.from || event.data.from);
    const ourFrom = parseAddress(await inboxFrom());

    if (isAutomatedMail(email.headers, from.address) || from.address === ourFrom.address) {
      return NextResponse.json({ ok: true, ignored: 'automated' });
    }

    const recipients = [...(email.to || []), ...(email.cc || []), ...(email.received_for || []), ...(event.data.to || []), ...(event.data.received_for || [])];
    const token = tokenFromRecipients(recipients);
    const inReplyTo = parseMessageIds(header(email.headers, 'In-Reply-To'));
    const references = parseMessageIds(header(email.headers, 'References'));
    const subject = cleanSubject(email.subject ?? event.data.subject);

    let thread = token ? await findThreadByToken(token) : null;
    if (!thread) thread = await findThreadByMessageIds([...inReplyTo, ...references]);

    let contact = thread ? await findContactById(thread.contact_id) : null;
    if (!contact) contact = await findOrCreateContact(from.address, from.name);
    if (!thread) thread = await latestLiveThreadForContact(contact.id);
    if (!thread) thread = await openThread({ contact, subject, topic: 'general' });

    const rawText = email.text?.trim() || (email.html ? htmlToText(email.html) : '');
    const bodyText = stripQuotedReply(rawText) || rawText || '(empty message)';

    const message = await appendMessage({
      threadId: thread.id,
      direction: 'in',
      channel: 'email',
      bodyText,
      bodyHtml: email.html || null,
      fromEmail: from.address,
      resendEmailId: event.data.email_id,
      providerMessageId: email.message_id || event.data.message_id || null,
      createdAt: email.created_at || event.data.created_at,
    });
    if (!message) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    for (const a of email.attachments || event.data.attachments || []) {
      const meta = await fetchReceivedAttachment(event.data.email_id, a.id, apiKey).catch(() => null);
      await addAttachment({
        message_id: message.id,
        filename: meta?.filename || a.filename || null,
        content_type: meta?.content_type || a.content_type || null,
        size: meta?.size ?? ('size' in a ? (a as { size?: number }).size ?? null : null),
        download_url: meta?.download_url || null,
        expires_at: meta?.expires_at || null,
      }).catch((err) => console.error('[inbox:inbound] attachment:', err));
    }

    await notifyOwner(thread, contact, message);
    return NextResponse.json({ ok: true, thread: thread.id, message: message.id });
  } catch (err) {
    console.error('[inbox:inbound] failed, asking Resend to retry:', err);
    return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 });
  }
}
