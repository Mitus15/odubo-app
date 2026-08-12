import { chunkForParams, executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { loopGalleryCode, publicUrlFor } from "@/lib/loop/wall/server";

/**
 * The Loop Journal — one issue per event volume, D1-backed like every other
 * Loop store. The issue row is the editorial frame (headline, standfirst,
 * published flag); the Iconic Moments list is the hand-curated photography.
 * Everything else the magazine prints (anthem champion, night recap) is
 * derived from tables that already exist — see journal-server.ts.
 */

export type JournalIssue = {
  headline: string;
  standfirst: string;
  published: boolean;
  /** ISO string of first publish — kept across unpublish/republish. */
  publishedAt: string | null;
};

export type JournalMoment = {
  id: string;
  /** The Wall photo behind this moment. Null only for legacy pasted-URL rows. */
  photoUid: string | null;
  imageUrl: string;
  caption: string;
  /**
   * Who shot it. DERIVED from loop_media_credits → loop_attendees, falling back
   * to the name left on the photo. Never typed into the Journal: contributor
   * royalties are paid on this, so it has to be the same answer the capture
   * recorded, not a second one someone re-keyed months later.
   */
  credit: string;
  kind: "photo" | "video";
};

export async function getJournalIssue(eventId: string): Promise<JournalIssue | null> {
  const row = await queryOne<{
    headline: string | null;
    standfirst: string | null;
    published: number;
    published_at: string | null;
  }>(
    `SELECT headline, standfirst, published, published_at
       FROM journal_issues WHERE event_id = ?1`,
    [eventId],
  );
  if (!row) return null;

  return {
    headline: row.headline ?? "",
    standfirst: row.standfirst ?? "",
    published: row.published === 1,
    publishedAt: row.published_at,
  };
}

/**
 * Upsert the issue frame. `publishedAt` is stamped on the first publish and
 * then never overwritten — an issue keeps its original date like a print run.
 */
export async function setJournalIssue(
  eventId: string,
  patch: { headline?: string; standfirst?: string; published?: boolean },
): Promise<void> {
  const current = await getJournalIssue(eventId);

  const headline = (patch.headline ?? current?.headline ?? "").trim();
  const standfirst = (patch.standfirst ?? current?.standfirst ?? "").trim();
  const published = patch.published ?? current?.published ?? false;
  const publishedAt =
    current?.publishedAt ?? (published ? new Date().toISOString() : null);

  await executeQuery(
    `INSERT INTO journal_issues (event_id, headline, standfirst, published, published_at)
          VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (event_id) DO UPDATE SET
       headline = excluded.headline,
       standfirst = excluded.standfirst,
       published = excluded.published,
       published_at = excluded.published_at`,
    [eventId, headline, standfirst, published ? 1 : 0, publishedAt],
  );
}

export type FeaturedPhoto = {
  uid: string;
  url: string;
  kind: "photo" | "video";
  /** Resolved attribution — see JournalMoment.credit. */
  credit: string;
};

/**
 * The Wall's featured (✦) set for a volume, with attribution resolved.
 *
 * Reads moments' tables the way the rest of Loop does — via the gallery `code`
 * derived from the event id, so no moments file learns Loop Soul exists. Credit
 * prefers the attendee record (the person, durable across devices and volumes)
 * and falls back to the name typed on the upload.
 */
export async function listFeaturedForJournal(eventId: string): Promise<FeaturedPhoto[]> {
  const rows = await queryDatabase<{
    uid: string;
    r2_key: string;
    media_type: "photo" | "video";
    user_name: string | null;
    attendee_name: string | null;
  }>(
    `SELECT p.uid, p.r2_key, p.media_type, p.user_name, a.display_name AS attendee_name
       FROM gallery_photos p
       JOIN galleries g ON g.id = p.gallery_id
       LEFT JOIN loop_media_credits c ON c.photo_uid = p.uid
       LEFT JOIN loop_attendees a ON a.id = c.attendee_id
      WHERE g.code = ?1
        AND p.featured = 1
        AND (p.moderated != 2 OR p.moderated IS NULL)
      ORDER BY p.created_at DESC, p.id DESC`,
    [loopGalleryCode(eventId)],
  );

  return rows.map((r) => ({
    uid: r.uid,
    url: publicUrlFor(r.r2_key),
    kind: r.media_type,
    credit: (r.attendee_name || r.user_name || "").trim(),
  }));
}

/**
 * The issue's photography — the Wall's featured set, in editorial order.
 *
 * Featuring a shot with the ✦ in Wall moderation is what puts it in the
 * magazine. There is no second act of curation and no URL to paste: this table
 * only carries the overlay (which ones ran, in what order, under what caption),
 * and anything featured but not yet ordered still appears, newest first.
 *
 * Legacy rows holding a pasted `image_url` with no `photo_uid` are preserved
 * and still render, so migration 150 loses nothing.
 */
export async function getJournalMoments(eventId: string): Promise<JournalMoment[]> {
  const overlayRows = await queryDatabase<{
    id: string;
    photo_uid: string | null;
    image_url: string | null;
    caption: string;
    position: number;
  }>(
    `SELECT id, photo_uid, image_url, caption, position
       FROM journal_moments WHERE event_id = ?1 ORDER BY position`,
    [eventId],
  );

  const featured = await listFeaturedForJournal(eventId);
  const byUid = new Map(featured.map((f) => [f.uid, f]));
  const out: JournalMoment[] = [];
  const used = new Set<string>();

  // Curated order first.
  for (const row of overlayRows) {
    if (row.photo_uid) {
      const photo = byUid.get(row.photo_uid);
      // Un-featuring a photo pulls it from the issue. The overlay row is left
      // alone so re-featuring restores its caption and place.
      if (!photo) continue;
      used.add(row.photo_uid);
      out.push({
        id: row.id,
        photoUid: photo.uid,
        imageUrl: photo.url,
        caption: row.caption,
        credit: photo.credit,
        kind: photo.kind,
      });
    } else if (row.image_url) {
      out.push({
        id: row.id,
        photoUid: null,
        imageUrl: row.image_url,
        caption: row.caption,
        credit: "",
        kind: "photo",
      });
    }
  }

  // Then anything newly featured that the editor hasn't placed yet — so a shot
  // starred during the night is in the issue immediately, not silently missing.
  for (const photo of featured) {
    if (used.has(photo.uid)) continue;
    out.push({
      id: `wall-${photo.uid}`,
      photoUid: photo.uid,
      imageUrl: photo.url,
      caption: "",
      credit: photo.credit,
      kind: photo.kind,
    });
  }

  return out;
}

/** Save the editorial overlay: order and captions, keyed by Wall photo. */
export async function setJournalMoments(
  eventId: string,
  items: { id?: string; photoUid?: string | null; caption?: string }[],
): Promise<void> {
  const normalised = items
    .map((m, i) => ({
      id: m.id?.trim() || `moment-${i}-${Date.now()}`,
      photoUid: m.photoUid?.trim() || null,
      caption: m.caption?.trim() ?? "",
    }))
    // A row with no photo behind it isn't a moment. Photography now comes from
    // the Wall, so there is nothing to save without one.
    .filter((m) => m.photoUid);

  await executeQuery(`DELETE FROM journal_moments WHERE event_id = ?1`, [eventId]);
  if (!normalised.length) return;

  // 3 params per row + the shared event id; chunked under D1's 100-var cap.
  // `position` comes from the row's index in the WHOLE list, not the chunk.
  let position = 0;
  for (const chunk of chunkForParams(normalised, 3)) {
    const values = chunk
      .map((_, i) => {
        const p = i * 3 + 2;
        return `(?1, ${position + i}, ?${p}, ?${p + 1}, ?${p + 2})`;
      })
      .join(", ");

    await executeQuery(
      `INSERT INTO journal_moments (event_id, position, id, photo_uid, caption)
       VALUES ${values}`,
      [eventId, ...chunk.flatMap((m) => [m.id, m.photoUid as string, m.caption])],
    );
    position += chunk.length;
  }
}
