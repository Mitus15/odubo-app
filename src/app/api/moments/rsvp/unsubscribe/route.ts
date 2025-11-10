import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

// POST /api/moments/rsvp/unsubscribe
// Body: { galleryId: number, email?: string, instagram_handle?: string, phone?: string }
// Minimal implementation: if email provided, clear reminder_offsets for that RSVP row
// Optional channels (ig/phone) handled if provided
export async function POST(req: NextRequest) {
  try {
  const json = (await req.json().catch(() => ({}))) as any;
  const galleryId = Number(json.galleryId);
  const emailRaw = (json.email || '').toString();
  const igRaw = (json.instagram_handle || '').toString();
  const phoneRaw = (json.phone || '').toString();

    if (!galleryId || (!emailRaw && !igRaw && !phoneRaw)) {
      return NextResponse.json({ error: 'galleryId and at least one identifier (email, instagram_handle, or phone) are required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rl = await rateLimit({ key: `moments:unsubscribe:${galleryId}:${emailRaw || igRaw || phoneRaw}:${ip}` as string, limit: 10, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    let affected = 0;

    // Unsubscribe by email
    if (emailRaw) {
      const email = emailRaw.trim().toLowerCase();
      const rows = await queryDatabase('SELECT id FROM gallery_rsvps WHERE gallery_id = ? AND email = ? LIMIT 1', [galleryId, email]);
      if (rows[0]) {
        await executeQuery('UPDATE gallery_rsvps SET reminder_offsets = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify([]), rows[0].id]);
        affected++;
      }
    }

    // Unsubscribe by Instagram handle (normalize by removing @ and lowering)
    if (!affected && igRaw) {
      const ig = igRaw.toString().trim().replace(/^@+/, '').toLowerCase();
      const rows = await queryDatabase('SELECT id FROM gallery_rsvps WHERE gallery_id = ? AND LOWER(REPLACE(instagram_handle, "@", "")) = ? LIMIT 1', [galleryId, ig]);
      if (rows[0]) {
        await executeQuery('UPDATE gallery_rsvps SET reminder_offsets = ?, instagram_opt_in = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify([]), rows[0].id]);
        affected++;
      }
    }

    // Unsubscribe by phone (E.164)
    if (!affected && phoneRaw) {
      const phone = phoneRaw.toString().trim();
      const rows = await queryDatabase('SELECT id FROM gallery_rsvps WHERE gallery_id = ? AND phone = ? LIMIT 1', [galleryId, phone]);
      if (rows[0]) {
        await executeQuery('UPDATE gallery_rsvps SET reminder_offsets = ?, sms_opt_in = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify([]), rows[0].id]);
        affected++;
      }
    }

    // Not found is OK (don’t reveal membership); respond success to be idempotent
    return NextResponse.json({ ok: true, affected });
  } catch (e: any) {
    console.error('Unsubscribe error:', e);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
