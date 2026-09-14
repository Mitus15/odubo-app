import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { sendReply } from '@/lib/inbox/send';
import { isValidEmail, normalizeOrderNumber } from '@/lib/inbox/text';
import { findOrCreateContact, openThread } from '@/lib/inbox/threads';
import { INBOX_TOPICS, type InboxTopic } from '@/lib/inbox/types';

export const runtime = 'nodejs';

/**
 * POST { email, name?, subject?, topic?, orderNumber?, body }
 *
 * The owner starts the conversation: from an order, from the Customers tab,
 * or cold. The first message goes out at once and the thread waits.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const b = (await req.json().catch(() => null)) as {
    email?: string;
    name?: string;
    subject?: string;
    topic?: string;
    orderNumber?: string;
    body?: string;
  } | null;

  if (!b?.email || !isValidEmail(b.email)) return NextResponse.json({ error: 'A valid email is needed' }, { status: 400 });
  const text = b.body?.trim();
  if (!text) return NextResponse.json({ error: 'Write something first' }, { status: 400 });

  try {
    const contact = await findOrCreateContact(b.email, b.name);
    const thread = await openThread({
      contact,
      subject: b.subject?.trim() || null,
      topic: INBOX_TOPICS.includes(b.topic as InboxTopic) ? (b.topic as InboxTopic) : 'general',
      orderNumber: normalizeOrderNumber(b.orderNumber),
    });
    const message = await sendReply(thread, contact, text, auth.user.userId);
    return NextResponse.json({ thread, message }, { status: message.delivery_status === 'failed' ? 502 : 201 });
  } catch (err) {
    console.error('[inbox] new thread:', err);
    return NextResponse.json({ error: 'Could not start the conversation' }, { status: 500 });
  }
}
