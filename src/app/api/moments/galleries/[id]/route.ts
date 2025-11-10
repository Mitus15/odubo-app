import { NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { GalleryUpdateSchema } from '@/lib/momentsSchemas';
import { writeAuditLog } from '@/lib/audit';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const rows = await queryDatabase('SELECT id, code, title, description, starts_at, ends_at, created_by, created_at, updated_at, config FROM galleries WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ gallery: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const rl = await rateLimit({ key: `galleries:update:${user!.userId}`, limit: 60, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const json = await req.json();
    const parsed = GalleryUpdateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });

    const updates: string[] = [];
    const sqlParams: any[] = [];
    for (const [k, v] of Object.entries(parsed.data)) {
      updates.push(`${k} = ?`);
      sqlParams.push(k === 'config' && v != null ? JSON.stringify(v) : v);
    }
    if (updates.length === 0) return NextResponse.json({ ok: true });
    sqlParams.push(id);
    await executeQuery(`UPDATE galleries SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, sqlParams);

    await writeAuditLog(req, user, 'galleries.update', String(id), { fields: Object.keys(parsed.data) });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Update gallery error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyUserFromRequest(req as any);
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const rl = await rateLimit({ key: `galleries:delete:${user!.userId}`, limit: 20, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    await executeQuery('DELETE FROM galleries WHERE id = ?', [id]);
    await writeAuditLog(req, user, 'galleries.delete', String(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Delete gallery error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
