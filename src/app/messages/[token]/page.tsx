import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findContactById, findThreadByToken, messagesForThread } from '@/lib/inbox/threads';
import { TOPIC_LABELS } from '@/lib/inbox/types';

import ThreadClient from './ThreadClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Your conversation · Odubo Studio',
  robots: { index: false, follow: false, noarchive: true },
};

/**
 * The customer's side of a conversation, opened by the unguessable link in
 * their email. No login, no password: the link is the key, and it opens one
 * thread only. Internal notes are filtered before anything leaves the server.
 */
export default async function MessagesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const thread = await findThreadByToken(token);
  if (!thread) notFound();
  const [contact, messages] = await Promise.all([findContactById(thread.contact_id), messagesForThread(thread.id, false)]);

  return (
    <ThreadClient
      token={token}
      subject={thread.subject || TOPIC_LABELS[thread.topic]}
      status={thread.status}
      name={contact?.name || null}
      initialMessages={messages.map((m) => ({
        id: m.id,
        direction: m.direction === 'out' ? 'out' : 'in',
        body_text: m.body_text,
        created_at: m.created_at,
      }))}
    />
  );
}
