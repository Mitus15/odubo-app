import { NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { RsvpCreateSchema, RsvpStatusQuerySchema } from '@/lib/momentsSchemas';
import { rateLimit } from '@/lib/rateLimit';

// POST /api/moments/rsvp -> create or update RSVP
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = RsvpCreateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  const { galleryId, email, name, reminder_offsets, instagram_handle, instagram_opt_in, phone, sms_opt_in } = parsed.data;

    // Basic rate limit per email per gallery (avoid hammering)
    const rl = await rateLimit({ key: `rsvp:${galleryId}:${email}`, limit: 20, windowMs: 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    // Ensure gallery exists & fetch starts_at
    const gRows = await queryDatabase('SELECT id, starts_at FROM galleries WHERE id = ? LIMIT 1', [galleryId]);
    if (!gRows[0]) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    const startsAt = gRows[0].starts_at ? Date.parse(gRows[0].starts_at) : null;

    // Upsert RSVP (replace reminder offsets)
    const offsetsJson = JSON.stringify(reminder_offsets || []);
    const normEmail = email ? email.toLowerCase() : null;
  const normIg = instagram_handle ? instagram_handle.replace(/^@/, '').toLowerCase() : null;
  const normPhone = phone ? phone.replace(/\s+/g, '') : null;

    // Upsert strategy: If email present, use (gallery_id,email) uniqueness; else, fallback to IG handle uniqueness emulation.
    if (normEmail) {
      await executeQuery(
        `INSERT INTO gallery_rsvps (gallery_id, email, name, reminder_offsets, instagram_handle, instagram_opt_in, phone, sms_opt_in)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(gallery_id, email) DO UPDATE SET name = excluded.name, reminder_offsets = excluded.reminder_offsets, instagram_handle = excluded.instagram_handle, instagram_opt_in = excluded.instagram_opt_in, phone = excluded.phone, sms_opt_in = excluded.sms_opt_in, updated_at = CURRENT_TIMESTAMP`,
        [galleryId, normEmail, name || null, offsetsJson, normIg ? '@' + normIg : null, instagram_opt_in ? 1 : 0, normPhone, sms_opt_in ? 1 : 0]
      );
    } else if (normIg) {
      // No email: check if existing row for this IG handle
      const existing = await queryDatabase('SELECT id, email FROM gallery_rsvps WHERE gallery_id = ? AND instagram_handle = ? LIMIT 1', [galleryId, '@' + normIg]);
      if (existing[0]) {
        await executeQuery('UPDATE gallery_rsvps SET name = ?, reminder_offsets = ?, instagram_opt_in = ?, phone = ?, sms_opt_in = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name || null, offsetsJson, instagram_opt_in ? 1 : 0, normPhone, sms_opt_in ? 1 : 0, existing[0].id]);
      } else {
        await executeQuery('INSERT INTO gallery_rsvps (gallery_id, email, name, reminder_offsets, instagram_handle, instagram_opt_in, phone, sms_opt_in) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)', [galleryId, name || null, offsetsJson, '@' + normIg, instagram_opt_in ? 1 : 0, normPhone, sms_opt_in ? 1 : 0]);
      }
    } else if (normPhone) {
      // No email/IG: upsert by phone
      const existing = await queryDatabase('SELECT id FROM gallery_rsvps WHERE gallery_id = ? AND phone = ? LIMIT 1', [galleryId, normPhone]);
      if (existing[0]) {
        await executeQuery('UPDATE gallery_rsvps SET name = ?, reminder_offsets = ?, instagram_handle = COALESCE(instagram_handle, ?), instagram_opt_in = COALESCE(instagram_opt_in, ?), sms_opt_in = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name || null, offsetsJson, normIg ? '@' + normIg : null, instagram_opt_in ? 1 : 0, sms_opt_in ? 1 : 0, existing[0].id]);
      } else {
        await executeQuery('INSERT INTO gallery_rsvps (gallery_id, email, name, reminder_offsets, instagram_handle, instagram_opt_in, phone, sms_opt_in) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)', [galleryId, name || null, offsetsJson, normIg ? '@' + normIg : null, instagram_opt_in ? 1 : 0, normPhone, sms_opt_in ? 1 : 0]);
      }
    }

  return NextResponse.json({ ok: true, galleryId, email: normEmail, instagram_handle: normIg ? '@' + normIg : null, phone: normPhone, starts_at: gRows[0].starts_at, reminder_offsets, instagram_opt_in: instagram_opt_in || false, sms_opt_in: sms_opt_in || false });
  } catch (e: any) {
    console.error('RSVP create error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

// GET /api/moments/rsvp?galleryId=123&email=x -> status check
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
  const galleryIdStr = url.searchParams.get('galleryId');
  const email = url.searchParams.get('email') || undefined;
  const instagram_handle = url.searchParams.get('instagram_handle') || undefined;
  const phone = url.searchParams.get('phone') || undefined;
  const galleryId = galleryIdStr ? Number(galleryIdStr) : NaN;
  const parsed = RsvpStatusQuerySchema.safeParse({ galleryId, email, instagram_handle, phone });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid query', issues: parsed.error.issues }, { status: 400 });

    const gRows = await queryDatabase('SELECT id, starts_at, ends_at, title FROM galleries WHERE id = ? LIMIT 1', [galleryId]);
    if (!gRows[0]) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    const g = gRows[0];
    let rsvp: any = null;
    if (email) {
      const rRows = await queryDatabase('SELECT id, email, name, reminder_offsets, instagram_handle, instagram_opt_in, phone, sms_opt_in, created_at FROM gallery_rsvps WHERE gallery_id = ? AND email = ? LIMIT 1', [galleryId, email.toLowerCase()]);
      if (rRows[0]) {
        rsvp = { id: rRows[0].id, email: rRows[0].email, name: rRows[0].name, instagram_handle: rRows[0].instagram_handle, instagram_opt_in: !!rRows[0].instagram_opt_in, phone: rRows[0].phone, sms_opt_in: !!rRows[0].sms_opt_in, reminder_offsets: JSON.parse(rRows[0].reminder_offsets || '[]'), created_at: rRows[0].created_at };
      }
    } else if (instagram_handle) {
      const normIg = instagram_handle.replace(/^@/, '').toLowerCase();
      const rRows = await queryDatabase('SELECT id, email, name, reminder_offsets, instagram_handle, instagram_opt_in, phone, sms_opt_in, created_at FROM gallery_rsvps WHERE gallery_id = ? AND LOWER(REPLACE(instagram_handle, "@", "")) = ? LIMIT 1', [galleryId, normIg]);
      if (rRows[0]) {
        rsvp = { id: rRows[0].id, email: rRows[0].email, name: rRows[0].name, instagram_handle: rRows[0].instagram_handle, instagram_opt_in: !!rRows[0].instagram_opt_in, phone: rRows[0].phone, sms_opt_in: !!rRows[0].sms_opt_in, reminder_offsets: JSON.parse(rRows[0].reminder_offsets || '[]'), created_at: rRows[0].created_at };
      }
    } else if (phone) {
      const normPhone = phone.replace(/\s+/g, '');
      const rRows = await queryDatabase('SELECT id, email, name, reminder_offsets, instagram_handle, instagram_opt_in, phone, sms_opt_in, created_at FROM gallery_rsvps WHERE gallery_id = ? AND phone = ? LIMIT 1', [galleryId, normPhone]);
      if (rRows[0]) {
        rsvp = { id: rRows[0].id, email: rRows[0].email, name: rRows[0].name, instagram_handle: rRows[0].instagram_handle, instagram_opt_in: !!rRows[0].instagram_opt_in, phone: rRows[0].phone, sms_opt_in: !!rRows[0].sms_opt_in, reminder_offsets: JSON.parse(rRows[0].reminder_offsets || '[]'), created_at: rRows[0].created_at };
      }
    }
    return NextResponse.json({ gallery: g, rsvp });
  } catch (e: any) {
    console.error('RSVP status error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
