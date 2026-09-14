import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { sendReply } from '@/lib/inbox/send';
import { appendMessage, findContactById, findThreadById } from '@/lib/inbox/threads';

export const runtime = 'nodejs';

/**
 * POST { body, kind: 'reply' | 'note' }
 *
 * A reply goes to the customer by email from the inbox address and is
 * recorded whether or not the send succeeds. A note stays inside.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { body?: string; kind?: 'reply' | 'note' } | null;
  const text = body?.body?.trim();
  if (!text) return NextResponse.json({ error: 'Write something first' }, { status: 400 });
  if (text.length > 20_000) return NextResponse.json({ error: 'That is too long for one message' }, { status: 400 });
  const kind = body?.kind === 'note' ? 'note' : 'reply';

  try {
    const thread = await findThreadById(id);
    if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const contact = await findContactById(thread.contact_id);
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (kind === 'note') {
      const note = await appendMessage({
        threadId: thread.id,
        direction: 'note',
        channel: 'web',
        bodyText: text,
        authorUserId: auth.user.userId,
      });
      return NextResponse.json({ message: note }, { status: 201 });
    }

    const message = await sendReply(thread, contact, text, auth.user.userId);
    return NextResponse.json({ message }, { status: message.delivery_status === 'failed' ? 502 : 201 });
  } catch (err) {
    console.error('[inbox] message:', err);
    return NextResponse.json({ error: 'Could not send' }, { status: 500 });
  }
}
