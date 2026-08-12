import { queryDatabase, queryOne, executeQuery, type SqlParam } from "@/lib/loop/db";
import { toSlug } from "@/lib/storage/pathGenerators";
import type { LoopEvent } from "@/lib/loop/hub";

/**
 * The Wall — Loop Soul's shared event gallery, stored on the moments core.
 *
 * Everything here reads/writes moments' `galleries` / `gallery_photos` tables
 * (see docs/decisions/loop-wall-on-moments.md). Loop imports from moments;
 * moments never learns Loop Soul exists — the gallery row is an ordinary
 * moments gallery whose `config.visibility` is "private" so it stays off
 * odubo's public moments listing.
 */

/** Deterministic moments gallery code for a Loop volume: "vol-1" → "LOOPVOL1". */
export function loopGalleryCode(eventId: string): string {
  const suffix = eventId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `LOOP${suffix}`.slice(0, 12);
}

export type LoopGallery = {
  id: number;
  code: string;
  title: string;
  /** R2 path segment — derived from the stored title, matching moments' scheme. */
  slug: string;
};

/**
 * Find-or-create the moments gallery row for this volume. Safe to call on every
 * request (one SELECT on the hot path); the INSERT is race-safe via the UNIQUE
 * constraint on `galleries.code` + OR IGNORE.
 */
export async function ensureLoopGallery(event: LoopEvent): Promise<LoopGallery> {
  const code = loopGalleryCode(event.id);

  const existing = await queryOne<{ id: number; code: string; title: string }>(
    `SELECT id, code, title FROM galleries WHERE code = ?1`,
    [code],
  );
  if (existing) {
    return { ...existing, slug: toSlug(existing.title) };
  }

  // Column set stops at migration 125 on remote D1 (133's retention columns —
  // is_permanent / content_rights — were never applied there, and no read path
  // enforces them). Permanence is carried in config.persistent instead.
  const title = `Loop Soul — ${event.title}`;
  await executeQuery(
    `INSERT OR IGNORE INTO galleries
       (code, title, description, created_by, config, gallery_type, upload_mode)
     VALUES (?1, ?2, ?3, 'loop-admin', ?4, 'event', 'public')`,
    [
      code,
      title,
      `Guest wall for ${event.title} · ${event.venue}`,
      JSON.stringify({ visibility: "private", persistent: true }),
    ],
  );

  const row = await queryOne<{ id: number; code: string; title: string }>(
    `SELECT id, code, title FROM galleries WHERE code = ?1`,
    [code],
  );
  if (!row) throw new Error("Failed to provision the Loop gallery row");
  return { ...row, slug: toSlug(row.title) };
}

export type WallPhoto = {
  id: number;
  uid: string;
  r2_key: string;
  r2_url: string;
  user_name: string | null;
  caption: string | null;
  media_type: "photo" | "video";
  moderated: number | null;
  featured: number;
  created_at: string;
};

/**
 * Media URLs route through the app's presigned-GET redirect rather than the
 * bucket's public URL — media.odubo.studio is down while the domain is lapsed,
 * and the redirect works either way (see /api/loop/gallery/media/[...key]).
 */
export function publicUrlFor(key: string): string {
  return `/api/loop/gallery/media/${key}`;
}

type ListOptions = {
  galleryId: number;
  /** Only featured (Iconic Moments) rows. */
  featuredOnly?: boolean;
  /** Include hidden (moderated = 2) rows — admin views only. */
  includeHidden?: boolean;
  limit: number;
  offset: number;
};

export async function listWallPhotos(opts: ListOptions): Promise<WallPhoto[]> {
  const where: string[] = [`gallery_id = ?1`];
  const params: SqlParam[] = [opts.galleryId];
  if (!opts.includeHidden) where.push(`(moderated != 2 OR moderated IS NULL)`);
  if (opts.featuredOnly) where.push(`featured = 1`);

  const rows = await queryDatabase<Omit<WallPhoto, "r2_url">>(
    `SELECT id, uid, r2_key, user_name, caption, media_type, moderated, featured, created_at
       FROM gallery_photos
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC, id DESC
      LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`,
    [...params, opts.limit, opts.offset],
  );
  return rows.map((r) => ({ ...r, r2_url: publicUrlFor(r.r2_key) }));
}

export async function insertWallPhoto(input: {
  galleryId: number;
  uid: string;
  r2Key: string;
  originalFilename: string;
  userName: string | null;
  caption: string | null;
  mediaType: "photo" | "video";
}): Promise<WallPhoto | null> {
  await executeQuery(
    `INSERT INTO gallery_photos
       (gallery_id, uid, r2_key, original_filename, user_name, caption, media_type, source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'public')`,
    [
      input.galleryId,
      input.uid,
      input.r2Key,
      input.originalFilename,
      input.userName,
      input.caption,
      input.mediaType,
    ],
  );
  const row = await queryOne<Omit<WallPhoto, "r2_url">>(
    `SELECT id, uid, r2_key, user_name, caption, media_type, moderated, featured, created_at
       FROM gallery_photos
      WHERE gallery_id = ?1 AND uid = ?2`,
    [input.galleryId, input.uid],
  );
  return row ? { ...row, r2_url: publicUrlFor(row.r2_key) } : null;
}
