/**
 * Snapshot the story for a render.
 *
 *   npm run film:pull -- <take>            # approved cards only
 *   npm run film:pull -- <take> --drafts   # drafts too (a private review render)
 *
 * The pipeline runs on this machine and must not depend on the network
 * mid-render, so every chapter (with its colourway resolved by palette.ts,
 * the one implementation) and every card is written to
 * $FILM_WORK/<take>/story.json, and later stages read only that file.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listCards, listChapters } from "../../../src/lib/loop/film/store";
import { palette, parseHex, SAND } from "../../../src/lib/loop/film/palette";

const take = process.argv[2];
if (!take || take.startsWith("--")) {
  console.error("usage: npm run film:pull -- <take> [--drafts]");
  process.exit(1);
}
const drafts = process.argv.includes("--drafts");
const WORK = process.env.FILM_WORK ?? path.join(os.homedir(), "Documents/Loop-soul-the-entertainment-room/film-work");

async function main() {
  const [chapters, cards] = await Promise.all([listChapters(), listCards()]);
  const story = {
    pulledAt: new Date().toISOString(),
    drafts,
    chapters: chapters.map((c) => ({
      slug: c.slug,
      number: c.number,
      title: c.title,
      thread: c.thread,
      status: c.status,
      palette: palette(parseHex(c.field) ?? SAND),
      shadowMode: c.shadowMode,
      shadowLag: c.shadowLag,
      badgeFrom: c.badgeFrom,
      filmStart: c.filmStart,
      filmEnd: c.filmEnd,
    })),
    cards: cards
      .filter((c) => drafts || c.status === "approved")
      .map((c) => ({
        id: c.id,
        chapter: c.chapter,
        verseRef: c.verseRef,
        verseText: c.verseText,
        flip: c.flip,
        filmStart: c.filmStart,
        filmEnd: c.filmEnd,
        status: c.status,
      })),
  };
  const dir = path.join(WORK, take);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "story.json"), JSON.stringify(story, null, 2));
  console.log(`${take}: ${story.chapters.length} chapters, ${story.cards.length} cards${drafts ? " (drafts included)" : ""} -> ${dir}/story.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
