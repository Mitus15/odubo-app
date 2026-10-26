import fs from "node:fs";
import path from "node:path";
import { namesHim } from "./naming";

/**
 * Search the King James Version for a scripture card (server only).
 *
 * data/bible-kjv.json is the whole KJV, cleaned (scripts/loop/film/build_kjv.py).
 * Two ways in:
 *   by reference  "Genesis 2:7", "gen 2:5-7", "John 1"
 *   by words      a chapter's emotion words: "dust ground breath living"
 *
 * A verse that names Him is never offered: Signs of Life never names Him, and the
 * words of the verses around it make Him unmistakable (naming.ts).
 */

type Book = { abbrev: string; name: string; chapters: string[][] };
export type Verse = { ref: string; book: string; chapter: number; verse: number; text: string };

let BOOKS: Book[] | null = null;
let FLAT: (Verse & { lower: string })[] | null = null;

function load(): (Verse & { lower: string })[] {
  if (FLAT) return FLAT;
  const file = path.join(process.cwd(), "data", "bible-kjv.json");
  BOOKS = JSON.parse(fs.readFileSync(file, "utf8")) as Book[];
  FLAT = [];
  for (const b of BOOKS) {
    b.chapters.forEach((ch, ci) =>
      ch.forEach((text, vi) =>
        FLAT!.push({ ref: `${b.name} ${ci + 1}:${vi + 1}`, book: b.name, chapter: ci + 1, verse: vi + 1, text, lower: text.toLowerCase() }),
      ),
    );
  }
  return FLAT;
}

function findBook(name: string): Book | null {
  load();
  const n = name.toLowerCase().replace(/\s+/g, "");
  return (
    BOOKS!.find((b) => b.name.toLowerCase().replace(/\s+/g, "") === n) ??
    BOOKS!.find((b) => b.abbrev === n) ??
    BOOKS!.find((b) => b.name.toLowerCase().replace(/\s+/g, "").startsWith(n)) ??
    null
  );
}

const REF = /^\s*((?:[123]\s*)?[a-z][a-z\s]*?)\s*(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?\s*$/i;

/** "Genesis 2:5-7" → those verses; "John 1" → the chapter. Names excluded. */
export function versesByRef(ref: string): Verse[] | null {
  const m = REF.exec(ref);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  const verses = book.chapters[chapter - 1];
  if (!verses) return [];
  const from = m[3] ? Number(m[3]) : 1;
  const to = m[4] ? Number(m[4]) : m[3] ? from : verses.length;
  const out: Verse[] = [];
  for (let v = from; v <= Math.min(to, verses.length); v++) {
    const text = verses[v - 1];
    if (!namesHim(text)) out.push({ ref: `${book.name} ${chapter}:${v}`, book: book.name, chapter, verse: v, text });
  }
  return out;
}

const STOP = new Set(["the", "and", "of", "to", "a", "in", "is", "it", "that", "for", "on", "with", "as", "be", "i", "my", "me"]);

/** Verses holding the most of these words (word starts, so "light" finds "lighten"). */
export function searchVerses(query: string, limit = 30): Verse[] {
  const byRef = versesByRef(query);
  if (byRef && byRef.length) return byRef.slice(0, limit);
  const words = query
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  if (!words.length) return [];
  const patterns = words.map((w) => new RegExp(`\\b${w.replace(/[^a-z']/g, "")}`));
  const scored: { v: Verse; score: number }[] = [];
  for (const v of load()) {
    let score = 0;
    for (const p of patterns) if (p.test(v.lower)) score++;
    if (score && !namesHim(v.text)) scored.push({ v, score });
  }
  scored.sort((a, b) => b.score - a.score || a.v.text.length - b.v.text.length);
  return scored.slice(0, limit).map(({ v }) => ({ ref: v.ref, book: v.book, chapter: v.chapter, verse: v.verse, text: v.text }));
}
