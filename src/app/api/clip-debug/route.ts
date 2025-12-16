import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ClipEntry = { id: number; title?: string | null; parentId?: number | null; count: number };
const counts = new Map<number, ClipEntry>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });
    }
    const existing = counts.get(id) || { id, count: 0, title: body?.title ?? null, parentId: body?.parentId ?? null };
    existing.count += 1;
    if (!existing.title && body?.title) existing.title = body.title;
    if (existing.parentId == null && body?.parentId != null) existing.parentId = body.parentId;
    counts.set(id, existing);
    console.log('[clip-debug]', existing);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[clip-debug] error', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  const rows = Array.from(counts.values()).sort((a, b) => b.count - a.count || a.id - b.id);
  return NextResponse.json({ rows, total: rows.length });
}
