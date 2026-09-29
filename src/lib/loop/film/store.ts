import { executeQuery, queryDatabase, queryOne, type SqlParam } from "@/lib/loop/db";
import { storyIssues, type StoryIssue } from "./naming";

/**
 * The Loop Soul film's story data in D1 (migration 168): chapters, scripture
 * cards and world entries. The admin page writes here; the site and the film
 * pipeline (via `film:pull`) read.
 *
 * Every word is faith content, so APPROVAL is where the rules bite: an entry
 * cannot be approved while it names Him, carries an em dash or a link, or uses
 * a character the poster engine cannot draw (naming.ts). Drafts may hold
 * anything; they are never shown to a guest.
 */

export type Status = "draft" | "approved";
export type ShadowMode = "none" | "sync" | "lag";

export type Chapter = {
  slug: string;
  number: number;
  trackId: string;
  title: string;
  thread: string | null;
  emotion: string | null;
  field: string;
  shadowMode: ShadowMode;
  shadowLag: number;
  badgeFrom: number | null;
  lyricsDraft: string | null;
  filmStart: number | null;
  filmEnd: number | null;
  status: Status;
  revealedAt: string | null;
  updatedAt: string;
};

export type Card = {
  id: string;
  chapter: string;
  sort: number;
  verseRef: string;
  verseText: string;
  flip: string | null;
  filmStart: number | null;
  filmEnd: number | null;
  status: Status;
  videoId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorldEntry = {
  slug: string;
  name: string;
  line: string;
  revealedWith: string | null;
  sort: number;
  status: Status;
  updatedAt: string;
};

type ChapterRow = {
  slug: string; number: number; track_id: string; title: string; thread: string | null; emotion: string | null;
  field: string; shadow_mode: string; shadow_lag: number; badge_from: number | null; lyrics_draft: string | null;
  film_start: number | null; film_end: number | null; status: string; revealed_at: string | null; updated_at: string;
};
type CardRow = {
  id: string; chapter: string; sort: number; verse_ref: string; verse_text: string; flip: string | null;
  film_start: number | null; film_end: number | null; status: string; video_id: string | null;
  created_at: string; updated_at: string;
};
type WorldRow = {
  slug: string; name: string; line: string; revealed_with: string | null; sort: number; status: string; updated_at: string;
};

const asStatus = (s: string): Status => (s === "approved" ? "approved" : "draft");
const asShadow = (s: string): ShadowMode => (s === "none" || s === "lag" ? s : "sync");

const toChapter = (r: ChapterRow): Chapter => ({
  slug: r.slug, number: r.number, trackId: r.track_id, title: r.title, thread: r.thread, emotion: r.emotion,
  field: r.field, shadowMode: asShadow(r.shadow_mode), shadowLag: r.shadow_lag, badgeFrom: r.badge_from,
  lyricsDraft: r.lyrics_draft, filmStart: r.film_start, filmEnd: r.film_end, status: asStatus(r.status),
  revealedAt: r.revealed_at, updatedAt: r.updated_at,
});
const toCard = (r: CardRow): Card => ({
  id: r.id, chapter: r.chapter, sort: r.sort, verseRef: r.verse_ref, verseText: r.verse_text, flip: r.flip,
  filmStart: r.film_start, filmEnd: r.film_end, status: asStatus(r.status), videoId: r.video_id,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const toWorld = (r: WorldRow): WorldEntry => ({
  slug: r.slug, name: r.name, line: r.line, revealedWith: r.revealed_with, sort: r.sort,
  status: asStatus(r.status), updatedAt: r.updated_at,
});

const now = () => new Date().toISOString();

/* ── chapters ──────────────────────────────────────────────────────────── */

export async function listChapters(): Promise<Chapter[]> {
  const rows = await queryDatabase<ChapterRow>(`SELECT * FROM loop_film_chapters ORDER BY number`);
  return rows.map(toChapter);
}

export async function getChapter(slug: string): Promise<Chapter | null> {
  const r = await queryOne<ChapterRow>(`SELECT * FROM loop_film_chapters WHERE slug = ?1`, [slug]);
  return r ? toChapter(r) : null;
}

export type ChapterPatch = Partial<
  Pick<Chapter, "title" | "thread" | "emotion" | "field" | "shadowMode" | "shadowLag" | "badgeFrom" | "filmStart" | "filmEnd" | "lyricsDraft" | "status" | "revealedAt">
>;

const CHAPTER_COLUMNS: Record<keyof ChapterPatch, string> = {
  title: "title", thread: "thread", emotion: "emotion", field: "field", shadowMode: "shadow_mode",
  shadowLag: "shadow_lag", badgeFrom: "badge_from", filmStart: "film_start", filmEnd: "film_end",
  lyricsDraft: "lyrics_draft", status: "status", revealedAt: "revealed_at",
};

/** The words of a chapter a guest will read, checked before approval. */
export function chapterIssues(c: Pick<Chapter, "title" | "thread">): StoryIssue[] {
  return [...storyIssues(c.title, { drawn: true }), ...storyIssues(c.thread ?? "", { drawn: true })];
}

async function patchRow(table: string, key: string, id: string, columns: Record<string, string>, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const params: SqlParam[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = columns[k];
    if (!col || v === undefined) continue;
    params.push(v as SqlParam);
    sets.push(`${col} = ?${params.length}`);
  }
  if (!sets.length) return;
  params.push(now());
  sets.push(`updated_at = ?${params.length}`);
  params.push(id);
  await executeQuery(`UPDATE ${table} SET ${sets.join(", ")} WHERE ${key} = ?${params.length}`, params);
}

export class StoryRuleError extends Error {
  constructor(public issues: StoryIssue[]) {
    super(issues.map((i) => i.detail).join(" "));
  }
}

export async function updateChapter(slug: string, patch: ChapterPatch): Promise<Chapter | null> {
  const current = await getChapter(slug);
  if (!current) return null;
  const next = { ...current, ...patch };
  if (next.status === "approved") {
    const issues = chapterIssues(next);
    if (issues.length) throw new StoryRuleError(issues);
  }
  await patchRow("loop_film_chapters", "slug", slug, CHAPTER_COLUMNS, patch);
  return getChapter(slug);
}

/** First run only: rows that already exist keep every edit the owner made. */
export async function seedChapter(c: Omit<Chapter, "updatedAt" | "lyricsDraft" | "filmStart" | "filmEnd" | "revealedAt" | "status">) {
  await executeQuery(
    `INSERT OR IGNORE INTO loop_film_chapters
       (slug, number, track_id, title, thread, emotion, field, shadow_mode, shadow_lag, badge_from, status, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'draft', ?11)`,
    [c.slug, c.number, c.trackId, c.title, c.thread, c.emotion, c.field, c.shadowMode, c.shadowLag, c.badgeFrom, now()],
  );
}

/* ── cards ─────────────────────────────────────────────────────────────── */

export async function listCards(chapter?: string): Promise<Card[]> {
  const rows = chapter
    ? await queryDatabase<CardRow>(`SELECT * FROM loop_film_cards WHERE chapter = ?1 ORDER BY sort, created_at`, [chapter])
    : await queryDatabase<CardRow>(`SELECT * FROM loop_film_cards ORDER BY chapter, sort, created_at`);
  return rows.map(toCard);
}

export async function getCard(id: string): Promise<Card | null> {
  const r = await queryOne<CardRow>(`SELECT * FROM loop_film_cards WHERE id = ?1`, [id]);
  return r ? toCard(r) : null;
}

/** A card's words: the verse as it will be set, and the flip. No links on a card. */
export function cardIssues(c: Pick<Card, "verseText" | "flip" | "verseRef">): StoryIssue[] {
  return [
    ...storyIssues(c.verseText, { drawn: true }),
    ...storyIssues(c.flip ?? "", { drawn: true }),
    ...storyIssues(c.verseRef, { drawn: true }),
  ];
}

export async function createCard(input: { chapter: string; verseRef: string; verseText: string; flip?: string | null }): Promise<Card> {
  const id = crypto.randomUUID();
  const t = now();
  const sort = (await queryOne<{ n: number }>(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM loop_film_cards WHERE chapter = ?1`, [input.chapter]))?.n ?? 0;
  await executeQuery(
    `INSERT INTO loop_film_cards (id, chapter, sort, verse_ref, verse_text, flip, status, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'draft', ?7, ?7)`,
    [id, input.chapter, sort, input.verseRef, input.verseText, input.flip ?? null, t],
  );
  return (await getCard(id))!;
}

export type CardPatch = Partial<Pick<Card, "verseRef" | "verseText" | "flip" | "filmStart" | "filmEnd" | "status" | "sort" | "videoId">>;
const CARD_COLUMNS: Record<keyof CardPatch, string> = {
  verseRef: "verse_ref", verseText: "verse_text", flip: "flip", filmStart: "film_start", filmEnd: "film_end",
  status: "status", sort: "sort", videoId: "video_id",
};

export async function updateCard(id: string, patch: CardPatch): Promise<Card | null> {
  const current = await getCard(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  if (next.status === "approved") {
    const issues = cardIssues(next);
    if (issues.length) throw new StoryRuleError(issues);
  }
  await patchRow("loop_film_cards", "id", id, CARD_COLUMNS, patch);
  return getCard(id);
}

export async function deleteCard(id: string): Promise<void> {
  await executeQuery(`DELETE FROM loop_film_cards WHERE id = ?1 AND video_id IS NULL`, [id]);
}

/* ── the world ─────────────────────────────────────────────────────────── */

export async function listWorld(): Promise<WorldEntry[]> {
  const rows = await queryDatabase<WorldRow>(`SELECT * FROM loop_film_world ORDER BY sort, name`);
  return rows.map(toWorld);
}

export function worldIssues(w: Pick<WorldEntry, "name" | "line">): StoryIssue[] {
  return [...storyIssues(w.name, { drawn: true }), ...storyIssues(w.line, { drawn: true })];
}

export type WorldPatch = Partial<Pick<WorldEntry, "name" | "line" | "revealedWith" | "sort" | "status">>;
const WORLD_COLUMNS: Record<keyof WorldPatch, string> = {
  name: "name", line: "line", revealedWith: "revealed_with", sort: "sort", status: "status",
};

export async function updateWorld(slug: string, patch: WorldPatch): Promise<WorldEntry | null> {
  const current = (await listWorld()).find((w) => w.slug === slug);
  if (!current) return null;
  const next = { ...current, ...patch };
  if (next.status === "approved") {
    const issues = worldIssues(next);
    if (issues.length) throw new StoryRuleError(issues);
  }
  await patchRow("loop_film_world", "slug", slug, WORLD_COLUMNS, patch);
  return (await listWorld()).find((w) => w.slug === slug) ?? null;
}

export async function createWorld(input: { slug: string; name: string; line: string; revealedWith?: string | null; sort?: number }): Promise<void> {
  await executeQuery(
    `INSERT OR IGNORE INTO loop_film_world (slug, name, line, revealed_with, sort, status, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'draft', ?6)`,
    [input.slug, input.name, input.line, input.revealedWith ?? null, input.sort ?? 0, now()],
  );
}

export async function deleteWorld(slug: string): Promise<void> {
  await executeQuery(`DELETE FROM loop_film_world WHERE slug = ?1`, [slug]);
}

/* ── what a guest may see ──────────────────────────────────────────────── */

/** A chapter a guest may read: approved, and revealed. */
export function isPublic(c: Pick<Chapter, "status" | "revealedAt">): boolean {
  return c.status === "approved" && !!c.revealedAt && Date.parse(c.revealedAt) <= Date.now();
}

/** World entries in order, each either shown or held back as a silhouette. */
export function worldView(entries: WorldEntry[], chapters: Chapter[]): { entry: WorldEntry; shown: boolean }[] {
  const open = new Set(chapters.filter(isPublic).map((c) => c.slug));
  return entries.map((entry) => ({
    entry,
    shown: entry.status === "approved" && (!entry.revealedWith || open.has(entry.revealedWith)),
  }));
}
