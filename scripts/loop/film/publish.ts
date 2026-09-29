/**
 * Put the finished pieces where people can find them, stopping short of
 * posting.
 *
 *   npm run film:publish -- <take> clips [--when=2026-10-23]            # dry run
 *   npm run film:publish -- <take> clips --apply [--when=2026-10-23]
 *   npm run film:publish -- <take> film --apply
 *
 * clips  For every APPROVED card with a finished clip: upload it to Stream,
 *        wait for the direct MP4 (the posting tool needs one), write a hidden
 *        `videos` row that knows its card, chapter and track, and stage a
 *        social DRAFT with its caption. Posting stays a person pressing
 *        publish in /admin/social (the same line scripts/loop/stage-reel.mjs
 *        holds): the clip goes live on the site when the post is processed.
 * film   Upload the film, write its hidden `videos` row (type feature), one
 *        chapter marker per song (the film's own time, labelled by slug), and
 *        point loop_settings.film_video_uid at it. /loop/film shows it once
 *        the owner sets it live.
 *
 * Refuses: an unapproved card, a caption that breaks a story rule (never
 * names Him, no em dash, one link), a card already published.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeQuery, queryDatabase } from "../../../src/lib/loop/db";
import { setSetting } from "../../../src/lib/loop/loopSetting";
import { SONGS, ALBUM_ID } from "../../../src/lib/loop/songs";
import { clipCaption, captionIssues, HASHTAGS } from "../../../src/lib/loop/film/caption";
import { getSingleStatuses } from "../../../src/lib/loop/singlesStore";
import { getPublicBaseUrl } from "../../../src/lib/loop/publicUrl";

const WORK = process.env.FILM_WORK ?? path.join(os.homedir(), "Documents/Loop-soul-the-entertainment-room/film-work");
const APPLY = process.argv.includes("--apply");
const when = process.argv.find((a) => a.startsWith("--when="))?.split("=")[1] ?? null;

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const STREAM_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const STREAM = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upload(file: string): Promise<{ uid: string; mp4: string; duration: number | null }> {
  if (!ACCOUNT || !STREAM_TOKEN) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN must be set");
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), path.basename(file));
  const res = await fetch(`${STREAM}?direct_user=false`, { method: "POST", headers: { Authorization: `Bearer ${STREAM_TOKEN}` }, body: form });
  const json = (await res.json()) as { success: boolean; result: { uid: string }; errors: unknown };
  if (!json.success) throw new Error(`Stream upload: ${JSON.stringify(json.errors)}`);
  const uid = json.result.uid;
  let duration: number | null = null;
  for (let i = 0; i < 120; i++) {
    const v = (await (await fetch(`${STREAM}/${uid}`, { headers: { Authorization: `Bearer ${STREAM_TOKEN}` } })).json()) as {
      result: { readyToStream: boolean; duration: number };
    };
    if (v.result?.readyToStream) {
      duration = v.result.duration ?? null;
      break;
    }
    await sleep(5000);
  }
  await fetch(`${STREAM}/${uid}/downloads`, { method: "POST", headers: { Authorization: `Bearer ${STREAM_TOKEN}`, "Content-Type": "application/json" }, body: "{}" });
  for (let i = 0; i < 120; i++) {
    const d = (await (await fetch(`${STREAM}/${uid}/downloads`, { headers: { Authorization: `Bearer ${STREAM_TOKEN}` } })).json()) as {
      result: { default?: { status: string; url: string } };
    };
    if (d.result?.default?.status === "ready") return { uid, mp4: d.result.default.url, duration };
    await sleep(5000);
  }
  // Fail loudly: a post without a real MP4 fails at publish time (docs, 2026-02-11).
  throw new Error(`Stream never produced a downloadable MP4 for ${uid}`);
}

type Story = {
  chapters: { slug: string; title: string; number: number }[];
  cards: { id: string; chapter: string; verseRef: string; flip: string | null; status: string; filmStart: number | null }[];
};

async function clips(take: string) {
  const dir = path.join(WORK, take);
  const story = JSON.parse(fs.readFileSync(path.join(dir, "story.json"), "utf8")) as Story;
  const out = path.join(dir, "out");
  const site = (await getPublicBaseUrl()) ?? "https://odubostudio.com";
  const released = new Set((await getSingleStatuses()).filter((s) => s.out).map((s) => s.slug));
  const published = new Set(
    (await queryDatabase<{ id: string }>(`SELECT id FROM loop_film_cards WHERE video_id IS NOT NULL`)).map((r) => r.id),
  );
  console.log(APPLY ? "APPLY: uploading and staging drafts" : "DRY RUN (pass --apply)");
  for (const card of story.cards) {
    const chapter = story.chapters.find((c) => c.slug === card.chapter);
    const song = SONGS.find((s) => s.slug === card.chapter);
    const tag = `${card.verseRef} (${card.chapter})`;
    if (card.status !== "approved") { console.log(`skip ${tag}: not approved`); continue; }
    if (published.has(card.id)) { console.log(`skip ${tag}: already published`); continue; }
    const audio = released.has(card.chapter) ? "full" : "tease";
    const file = path.join(out, `clip-${card.chapter}-${card.id.slice(0, 8)}-${audio}.mp4`);
    if (!fs.existsSync(file)) { console.log(`skip ${tag}: no finished clip (${path.basename(file)}); run film:cut`); continue; }
    const caption = clipCaption({ flip: card.flip, verseRef: card.verseRef, chapterTitle: chapter?.title ?? song?.title ?? card.chapter, slug: card.chapter, site });
    const issues = captionIssues(caption);
    if (issues.length) { console.log(`REFUSED ${tag}: ${issues.map((i) => i.detail).join(" ")}`); continue; }
    console.log(`\n${tag}  ${path.basename(file)}  audio ${audio}${when ? `  calendar ${when}` : ""}\n  ${caption.replace(/\n/g, "\n  ")}`);
    if (!APPLY) continue;
    const { uid, mp4, duration } = await upload(file);
    const now = new Date().toISOString();
    const poster = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
    await executeQuery(
      `INSERT INTO videos (uid, stream_video_id, title, description, url, poster_url, mp4_url, type, is_public,
                           publication_status, status, track_id, album_id, card_id, film_chapter_id, duration_seconds,
                           created_at, updated_at)
       VALUES (?1, ?1, ?2, ?3, ?4, ?5, ?6, 'clip', 0, 'archived', 'published', ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
      [uid, `${chapter?.title ?? card.chapter} · ${card.verseRef}`, caption, `https://iframe.videodelivery.net/${uid}`, poster, mp4,
       song?.trackId ?? null, ALBUM_ID, card.id, card.chapter, duration, now],
    );
    await executeQuery(`UPDATE loop_film_cards SET video_id = ?1, updated_at = ?2 WHERE id = ?3`, [uid, now, card.id]);
    await executeQuery(
      `INSERT INTO social_content (source_type, upload_uid, thumbnail_url, duration, title, caption_instagram, hashtags_instagram, status, scheduled_for)
       VALUES ('upload', ?1, ?2, ?3, ?4, ?5, ?6, 'draft', ?7)`,
      [uid, poster, duration, `${chapter?.title ?? card.chapter} · ${card.verseRef}`, caption, HASHTAGS, when],
    );
    console.log(`  uploaded ${uid}; staged a draft in /admin/social`);
  }
}

async function film(take: string) {
  const dir = path.join(WORK, take);
  const file = path.join(dir, "out", "film.mp4");
  if (!fs.existsSync(file)) throw new Error("no film.mp4: run film:cut -- <take> film");
  const align = JSON.parse(fs.readFileSync(path.join(dir, "align.json"), "utf8")) as { songs: { slug: string; filmStart: number }[] };
  const takeJson = JSON.parse(fs.readFileSync(path.join(dir, "take.json"), "utf8")) as { window: { start: number } };
  const markers = align.songs
    .map((s) => ({ slug: s.slug, t: Math.max(0, s.filmStart - takeJson.window.start) }))
    .sort((a, b) => a.t - b.t);
  console.log(APPLY ? "APPLY: uploading the film" : "DRY RUN (pass --apply)");
  for (const m of markers) console.log(`  marker ${Math.floor(m.t / 60)}:${String(Math.floor(m.t % 60)).padStart(2, "0")}  ${m.slug}`);
  if (!APPLY) return;
  const { uid, mp4, duration } = await upload(file);
  const now = new Date().toISOString();
  await executeQuery(
    `INSERT INTO videos (uid, stream_video_id, title, description, url, poster_url, mp4_url, type, is_public,
                         publication_status, status, album_id, duration_seconds, created_at, updated_at)
     VALUES (?1, ?1, 'Loop Soul, the film', 'Loop Soul, danced in one take.', ?2, ?3, ?4, 'feature', 0, 'archived', 'published', ?5, ?6, ?7, ?7)`,
    [uid, `https://iframe.videodelivery.net/${uid}`, `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`, mp4, ALBUM_ID, duration, now],
  );
  const row = await queryDatabase<{ id: number }>(`SELECT id FROM videos WHERE uid = ?1`, [uid]);
  for (const m of markers) {
    await executeQuery(`INSERT INTO video_markers (video_id, timestamp, label) VALUES (?1, ?2, ?3)`, [row[0].id, m.t, m.slug]);
  }
  await setSetting("film_video_uid", uid);
  console.log(`film uploaded ${uid} (hidden). Set it live in /admin/videos when the album is out; /loop/film shows it then.`);
}

async function main() {
  const [take, kind] = process.argv.slice(2);
  if (!take || !kind) throw new Error("usage: npm run film:publish -- <take> clips|film [--apply]");
  if (kind === "clips") return clips(take);
  if (kind === "film") return film(take);
  throw new Error(`unknown: ${kind}`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
