/**
 * Load the Signs of Life film's first-run story data into D1.
 *
 *   npm run film:seed            # dry run: prints what it would insert
 *   npm run film:seed -- --apply # inserts; existing rows are left untouched
 *
 * Chapters: one per song (src/lib/loop/film/songs.json), with the default
 * colourway from palette.ts, the shadow mode from the seed file, a lagging
 * shadow one beat behind (from the measured tempo in shape.json), and for
 * Welcome the badge landing where the song lets go. World entries: the sparse
 * map from the seed file. All drafts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SONGS } from "../../../src/lib/loop/songs";
import { defaultField, hex } from "../../../src/lib/loop/film/palette";
import { seedChapter, createWorld, type ShadowMode } from "../../../src/lib/loop/film/store";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "data/loop/film/story-bible.seed.json"), "utf8"));
const shape = JSON.parse(fs.readFileSync(path.join(ROOT, "data/loop/film/shape.json"), "utf8"));
const FPS = 30;

async function main() {
  console.log(APPLY ? "APPLY: inserting missing rows" : "DRY RUN (pass --apply)");
  for (const [i, song] of SONGS.entries()) {
    const draft = seed.chapters[song.slug] ?? { shadow: "sync" };
    const measured = shape.songs.find((s: { slug: string }) => s.slug === song.slug);
    const beatFrames = measured?.bpm ? Math.round((60 / measured.bpm) * FPS) : 0;
    const shadowMode = draft.shadow as ShadowMode;
    const row = {
      slug: song.slug,
      number: song.number,
      trackId: song.trackId,
      title: song.title,
      thread: null,
      emotion: null,
      field: hex(defaultField(i, SONGS.length)),
      shadowMode,
      shadowLag: shadowMode === "lag" ? beatFrames : 0,
      badgeFrom: draft.badgeAtLetGo && measured?.fallsAwayAt != null ? measured.fallsAwayAt : null,
    };
    console.log(
      `${String(song.number).padStart(2)} ${song.slug.padEnd(20)} ${row.field}  shadow ${row.shadowMode}${row.shadowLag ? ` ${row.shadowLag}f` : ""}${row.badgeFrom != null ? `  badge at ${row.badgeFrom}s` : ""}`,
    );
    if (APPLY) await seedChapter(row);
  }
  for (const w of seed.world) {
    console.log(`world  ${w.slug.padEnd(14)} ${w.name}: ${w.line}`);
    if (APPLY) await createWorld(w);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
