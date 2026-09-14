import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { setGlobalSetting } from '@/lib/db';
import { inboxTemplates, SETTING_KEYS } from '@/lib/inbox/settings';
import { INBOX_TOPICS, type ReplyTemplate } from '@/lib/inbox/types';

export const runtime = 'nodejs';

/** GET the canned replies. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  return NextResponse.json({ templates: await inboxTemplates() }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** PUT { templates: ReplyTemplate[] } replaces the set. */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const b = (await req.json().catch(() => null)) as { templates?: unknown } | null;
  if (!Array.isArray(b?.templates)) return NextResponse.json({ error: 'templates must be a list' }, { status: 400 });

  const clean: ReplyTemplate[] = [];
  for (const t of b!.templates as Partial<ReplyTemplate>[]) {
    const title = t.title?.trim();
    const body = t.body?.trim();
    if (!title || !body) continue;
    const topic = t.topic === 'any' || INBOX_TOPICS.includes(t.topic as never) ? (t.topic as ReplyTemplate['topic']) : 'any';
    clean.push({ id: t.id?.trim() || crypto.randomUUID(), title, body, topic });
  }

  try {
    await setGlobalSetting(SETTING_KEYS.templates, JSON.stringify(clean), 'json', auth.user.userId, 'Inbox canned replies');
    return NextResponse.json({ templates: clean });
  } catch (err) {
    console.error('[inbox] templates:', err);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
