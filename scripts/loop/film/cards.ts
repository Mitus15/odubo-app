/**
 * Render the words: every scripture card, and the film's chapter cards.
 *
 *   npm run film:cards -- <take>
 *
 * Reads $FILM_WORK/<take>/story.json (film:pull) and writes transparent PNGs
 * to $FILM_WORK/<take>/cards/: one per card per aspect, laid out by the one
 * poster engine (layoutFilmCard, layoutFilmChapter) and drawn as Jost glyph
 * outlines, so the film's words are the posters' words. film:cut lays them
 * over the figure.
 *
 * The band is the part of the frame film:compose keeps clear of him: the top
 * of a vertical clip, the left of a wide one.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { layoutFilmCard, layoutFilmChapter, type FilmBand } from "../../../src/lib/loop/poster/layout";
import { storyIssues } from "../../../src/lib/loop/film/naming";
import { assertFontResolves, prepareSharp, renderSharp } from "../poster-render-sharp";

const WORK = process.env.FILM_WORK ?? path.join(os.homedir(), "Documents/Loop-soul-the-entertainment-room/film-work");

export const CARD_ASPECTS: Record<string, { w: number; h: number; band: (w: number, h: number) => FilmBand; align: "middle" | "start" }> = {
  "9x16": { w: 1080, h: 1920, band: (w, h) => ({ x: w * 0.07, y: h * 0.06, w: w * 0.86, h: h * 0.24 }), align: "middle" },
  "16x9": { w: 1920, h: 1080, band: (w, h) => ({ x: w * 0.06, y: h * 0.14, w: w * 0.3, h: h * 0.72 }), align: "start" },
  "1x1": { w: 1080, h: 1080, band: (w, h) => ({ x: w * 0.08, y: h * 0.05, w: w * 0.84, h: h * 0.22 }), align: "middle" },
};

type Story = {
  drafts: boolean;
  chapters: { slug: string; number: number; title: string; thread: string | null; status: string }[];
  cards: { id: string; chapter: string; verseRef: string; verseText: string; flip: string | null; status: string }[];
};

async function main() {
  const take = process.argv[2];
  if (!take) throw new Error("usage: npm run film:cards -- <take> [--film-height=2160]");
  const filmHeight = Number(process.argv.find((a) => a.startsWith("--film-height="))?.split("=")[1] ?? 1080);
  const dir = path.join(WORK, take);
  const story = JSON.parse(fs.readFileSync(path.join(dir, "story.json"), "utf8")) as Story;
  const out = path.join(dir, "cards");
  fs.mkdirSync(out, { recursive: true });
  await assertFontResolves();
  const prepared = await prepareSharp([]);
  let made = 0;

  for (const card of story.cards) {
    const words = [card.verseText, card.flip ?? "", card.verseRef].join(" ");
    const issues = storyIssues(words, { drawn: true });
    if (issues.length) {
      console.warn(`skip ${card.verseRef} (${card.id.slice(0, 8)}): ${issues.map((i) => i.detail).join(" ")}`);
      continue;
    }
    for (const [name, a] of Object.entries(CARD_ASPECTS)) {
      const laid = layoutFilmCard({
        w: a.w, h: a.h, band: a.band(a.w, a.h), align: a.align,
        verseRef: card.verseRef, verseText: card.verseText, flip: card.flip,
      });
      if (!laid.ok) {
        console.warn(`skip ${card.verseRef} ${name}: ${laid.error}`);
        continue;
      }
      fs.writeFileSync(path.join(out, `${card.id}-${name}.png`), await renderSharp(laid.list, prepared, { transparent: true }));
      made++;
    }
  }

  const W = Math.round((filmHeight * 16) / 9 / 2) * 2;
  for (const ch of story.chapters) {
    const thread = ch.status === "approved" || story.drafts ? ch.thread : null;
    const laid = layoutFilmChapter({ w: W, h: filmHeight, number: ch.number, title: ch.title, thread });
    if (!laid.ok) {
      console.warn(`chapter ${ch.slug}: ${laid.error}`);
      continue;
    }
    fs.writeFileSync(path.join(out, `chapter-${ch.slug}.png`), await renderSharp(laid.list, prepared, { transparent: true }));
    made++;
  }
  console.log(`${take}: ${made} cards -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
