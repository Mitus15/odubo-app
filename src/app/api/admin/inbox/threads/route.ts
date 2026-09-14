import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { listThreads, unreadThreadCount } from '@/lib/inbox/threads';
import type { InboxStatus, InboxTopic } from '@/lib/inbox/types';

export const runtime = 'nodejs';

/**
 * GET /api/admin/inbox/threads
 *   ?status=open|waiting|closed|all  ?topic=  ?q=  ?before=<iso>  ?limit=
 *   ?count=unread → { unread: n } only, for the nav badge.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const p = req.nextUrl.searchParams;
  try {
    if (p.get('count') === 'unread') {
      return NextResponse.json({ unread: await unreadThreadCount() }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const threads = await listThreads({
      status: (p.get('status') as InboxStatus | 'all' | null) || 'open',
      topic: (p.get('topic') as InboxTopic | null) || undefined,
      q: p.get('q') || undefined,
      before: p.get('before') || undefined,
      limit: p.get('limit') ? Number(p.get('limit')) : undefined,
    });
    return NextResponse.json({ threads }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[inbox] list:', err);
    return NextResponse.json({ error: 'Could not load the inbox' }, { status: 500 });
  }
}
