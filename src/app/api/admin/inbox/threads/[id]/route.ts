import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { normalizeOrderNumber } from '@/lib/inbox/text';
import { markThreadRead, threadDetail, updateContactNotes, updateThread } from '@/lib/inbox/threads';
import { INBOX_STATUSES, INBOX_TOPICS, type InboxStatus, type InboxTopic } from '@/lib/inbox/types';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** GET one thread with its messages, contact and what we know about them. Opening it marks it read. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const detail = await threadDetail(id);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (detail.thread.unread_count > 0 && req.nextUrl.searchParams.get('peek') !== '1') {
      await markThreadRead(id);
      detail.thread.unread_count = 0;
    }
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (err) {
    console.error('[inbox] detail:', err);
    return NextResponse.json({ error: 'Could not load the thread' }, { status: 500 });
  }
}

/** PATCH { status?, topic?, orderNumber?, subject?, contactNotes? } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    status?: string;
    topic?: string;
    orderNumber?: string | null;
    subject?: string | null;
    contactNotes?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  if (body.status !== undefined && !INBOX_STATUSES.includes(body.status as InboxStatus)) {
    return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
  }
  if (body.topic !== undefined && !INBOX_TOPICS.includes(body.topic as InboxTopic)) {
    return NextResponse.json({ error: 'Unknown topic' }, { status: 400 });
  }

  try {
    const detail = await threadDetail(id);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await updateThread(id, {
      ...(body.status !== undefined ? { status: body.status as InboxStatus } : {}),
      ...(body.topic !== undefined ? { topic: body.topic as InboxTopic } : {}),
      ...(body.orderNumber !== undefined ? { order_number: normalizeOrderNumber(body.orderNumber) } : {}),
      ...(body.subject !== undefined ? { subject: body.subject?.trim() || null } : {}),
    });
    if (body.contactNotes !== undefined) {
      await updateContactNotes(detail.contact.id, body.contactNotes?.trim() || null);
    }
    const fresh = await threadDetail(id);
    return NextResponse.json(fresh, { headers: NO_STORE });
  } catch (err) {
    console.error('[inbox] patch:', err);
    return NextResponse.json({ error: 'Could not update the thread' }, { status: 500 });
  }
}
