import { NextRequest, NextResponse } from 'next/server';

import { notifyOwner } from '@/lib/inbox/alerts';
import { sendAcknowledgement, threadLink } from '@/lib/inbox/send';
import { inboxAutoAck } from '@/lib/inbox/settings';
import { isValidEmail, normalizeOrderNumber } from '@/lib/inbox/text';
import { appendMessage, deleteEmptyThread, findMessageBySubmissionId, findOrCreateContact, openThread } from '@/lib/inbox/threads';
import { INBOX_TOPICS, type InboxTopic } from '@/lib/inbox/types';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * The store's contact form.
 *
 * This used to email the owner and keep nothing. Now the message is the
 * record: it is written to the inbox first, and only then do the emails go
 * out, the acknowledgement to the customer (with their private link and the
 * reply key) and the alert to the owner. An email failing never loses the
 * message; it is logged loudly and the thread is still there in the admin.
 */
interface ContactFormData {
  name?: string;
  email?: string;
  orderNumber?: string;
  inquiryType?: string;
  message?: string;
  submissionId?: string;
}

const SUBJECTS: Record<InboxTopic, string> = {
  order: 'Order inquiry',
  refund: 'Return or refund',
  shipping: 'Shipping question',
  general: 'General inquiry',
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limiter = await rateLimit({ key: `contact:${ip}`, limit: 3, windowMs: 60_000 });
    if (!limiter.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as ContactFormData;
    const name = body.name?.trim();
    const email = body.email?.trim();
    const message = body.message?.trim();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 });
    }
    if (message.length > 10_000) {
      return NextResponse.json({ error: 'That message is too long. Keep it under 10,000 characters.' }, { status: 400 });
    }

    const topic: InboxTopic = INBOX_TOPICS.includes(body.inquiryType as InboxTopic) ? (body.inquiryType as InboxTopic) : 'general';
    const orderNumber = normalizeOrderNumber(body.orderNumber);
    const submissionId = body.submissionId && /^[A-Za-z0-9_-]{8,64}$/.test(body.submissionId) ? `form:${body.submissionId}` : null;

    // A repeat of a submission we already hold answers before anything is
    // created, so a double tap never leaves an empty second thread behind.
    if (submissionId && (await findMessageBySubmissionId(submissionId))) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    const contact = await findOrCreateContact(email, name);
    const thread = await openThread({
      contact,
      subject: orderNumber ? `${SUBJECTS[topic]} · #${orderNumber}` : SUBJECTS[topic],
      topic,
      orderNumber,
    });
    const stored = await appendMessage({
      threadId: thread.id,
      direction: 'in',
      channel: 'web',
      bodyText: message,
      fromEmail: contact.email,
      submissionId,
    });

    if (!stored) {
      // Lost a race with an identical submission: keep the thread that won.
      await deleteEmptyThread(thread.id);
      return NextResponse.json({ success: true, duplicate: true });
    }

    // Emails are best effort from here: the message is already the record.
    const [ack] = await Promise.allSettled([
      (async () => {
        if (await inboxAutoAck()) await sendAcknowledgement(thread, contact, stored);
      })(),
      notifyOwner(thread, contact, stored),
    ]);
    if (ack.status === 'rejected') console.error('[contact] acknowledgement:', ack.reason);

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent',
      threadUrl: threadLink(thread),
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Failed to send message. Please try again later.' }, { status: 500 });
  }
}
