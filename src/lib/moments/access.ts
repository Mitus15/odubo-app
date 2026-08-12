import { queryDatabase } from '@/lib/db';

/**
 * Read access for a gallery.
 *
 * `config.visibility = 'private'` has always meant "link/code-access only" —
 * `/api/moments/galleries/public` says so in as many words and filters private
 * galleries out of the public listing. But that was the ONLY route enforcing
 * it. Every other read path took a bare `galleryId` and answered, so a private
 * gallery's photographs, and the gallery's own join `code`, were readable by
 * anyone who could guess a small integer. `/api/moments/list` even accepted a
 * `code` query parameter and never looked at it.
 *
 * This is the shared enforcement. It is deliberately generic — a private
 * gallery is private for every caller, whatever created it — so it stays a
 * capability of moments rather than a special case for any one consumer.
 *
 * Callers that fail this check should answer **404, not 403**: confirming that
 * a private gallery exists at a given id is itself a small leak, and there is
 * nothing useful a client can do with the distinction.
 */

export type GalleryAccess = {
  id: number;
  code: string | null;
  isPrivate: boolean;
};

/** Parse the visibility flag out of a gallery's config blob. */
function isPrivateConfig(config: unknown): boolean {
  if (!config) return false;
  let parsed: unknown = config;
  if (typeof config === 'string') {
    try {
      parsed = JSON.parse(config);
    } catch {
      // Malformed config is treated as public, matching the json_valid() guard
      // in galleries/public — a broken blob must not silently hide a gallery.
      return false;
    }
  }
  return (parsed as { visibility?: unknown })?.visibility === 'private';
}

/** Look up a gallery's id, join code and privacy. Null when it doesn't exist. */
export async function getGalleryAccess(
  galleryId: number | string
): Promise<GalleryAccess | null> {
  const id = Number(galleryId);
  if (!Number.isFinite(id)) return null;

  const rows = await queryDatabase(
    `SELECT id, code, config FROM galleries WHERE id = ? LIMIT 1`,
    [id]
  );
  const row = rows?.[0] as { id: number; code: string | null; config: unknown } | undefined;
  if (!row) return null;

  return { id: row.id, code: row.code, isPrivate: isPrivateConfig(row.config) };
}

/**
 * May this caller read the gallery's contents?
 *
 * Public galleries: always. Private galleries: admins, or anyone presenting the
 * gallery's own code — which is exactly what "link/code-access only" means, and
 * is the same credential `/api/moments/join` already accepts.
 */
export function mayReadGallery(
  gallery: GalleryAccess,
  opts: { code?: string | null; isAdmin?: boolean }
): boolean {
  if (!gallery.isPrivate) return true;
  if (opts.isAdmin) return true;
  const supplied = opts.code?.trim().toUpperCase();
  return Boolean(supplied && gallery.code && supplied === gallery.code.trim().toUpperCase());
}

/**
 * Convenience for route handlers: resolve and check in one call.
 * Returns null when the gallery is missing OR the caller may not read it, so
 * both cases collapse into the same 404 at the call site.
 */
export async function readableGallery(
  galleryId: number | string,
  opts: { code?: string | null; isAdmin?: boolean }
): Promise<GalleryAccess | null> {
  const gallery = await getGalleryAccess(galleryId);
  if (!gallery) return null;
  return mayReadGallery(gallery, opts) ? gallery : null;
}
