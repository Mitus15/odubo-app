import { chunkForParams, executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";

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
  imageUrl: string;
  caption: string;
  credit: string;
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

export async function getJournalMoments(eventId: string): Promise<JournalMoment[]> {
  const rows = await queryDatabase<{
    id: string;
    image_url: string;
    caption: string;
    credit: string;
  }>(
    `SELECT id, image_url, caption, credit
       FROM journal_moments WHERE event_id = ?1 ORDER BY position`,
    [eventId],
  );

  return rows.map((r) => ({
    id: r.id,
    imageUrl: r.image_url,
    caption: r.caption,
    credit: r.credit,
  }));
}

/** Replace the whole curated list (the admin editor posts the full list). */
export async function setJournalMoments(
  eventId: string,
  items: JournalMoment[],
): Promise<void> {
  // Rows without an image are half-filled editor rows, not moments — drop them
  // rather than printing a broken frame in the gallery.
  const normalised = items
    .map((m, i) => ({
      id: m.id?.trim() || `moment-${i}-${Date.now()}`,
      imageUrl: m.imageUrl?.trim() ?? "",
      caption: m.caption?.trim() ?? "",
      credit: m.credit?.trim() ?? "",
    }))
    .filter((m) => m.imageUrl);

  await executeQuery(`DELETE FROM journal_moments WHERE event_id = ?1`, [eventId]);
  if (!normalised.length) return;

  // 4 params per row + the shared event id; chunked under D1's 100-var cap.
  // `position` comes from the row's index in the WHOLE list, not the chunk.
  let position = 0;
  for (const chunk of chunkForParams(normalised, 4)) {
    const values = chunk
      .map((_, i) => {
        const p = i * 4 + 2;
        return `(?1, ${position + i}, ?${p}, ?${p + 1}, ?${p + 2}, ?${p + 3})`;
      })
      .join(", ");

    await executeQuery(
      `INSERT INTO journal_moments (event_id, position, id, image_url, caption, credit)
       VALUES ${values}`,
      [eventId, ...chunk.flatMap((m) => [m.id, m.imageUrl, m.caption, m.credit])],
    );
    position += chunk.length;
  }
}
