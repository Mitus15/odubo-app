import fs from "node:fs";
import path from "node:path";
import { ALBUM_NAME, RECORD_NAMES } from "@/lib/loop/albumName";
import SONGS_JSON from "@/lib/loop/film/songs.json";

/**
 * The album is Signs of Life, on two records: Loop Soul and Signs of Life
 * (owner, 2026-10-03; lib/loop/albumName.ts). Loop Soul is also the night,
 * and keeps its name on the night's pages (the pass, the door, the store,
 * legal). Every page about the work names it from albumName.ts or from the
 * data, never as a literal, so this fails the day a branch written before the
 * rename merges and puts "Loop Soul" back on one by hand. Comments may still
 * say it: they record history.
 */
const ROOT = path.join(__dirname, "..", "..");
const ALBUM_SURFACES = [
  "src/app/loop/[single]",
  "src/app/loop/album",
  "src/app/loop/film",
  "src/app/loop/admin/film",
  "src/app/loop/layout.tsx",
  "src/app/recoolman",
  "src/app/game/soul-loop",
  "src/components/loop/film",
  "src/components/loop/album",
  "src/components/loop/gathering/TheSingle.tsx",
  "src/components/loop/gathering/SinglePlayer.tsx",
  "src/components/loop/gathering/SingleStandalone.tsx",
  "src/lib/loop/film",
  "public/loop/manifest.webmanifest",
];

function files(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  return fs.readdirSync(abs).flatMap((f) => files(path.join(rel, f)));
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\s*\/\*)/.test(line);

describe("the album's name", () => {
  it("is Signs of Life", () => {
    expect(ALBUM_NAME).toBe("Signs of Life");
  });

  it("is never Loop Soul on a page about the record", () => {
    const found: string[] = [];
    // songs.json names the first record Loop Soul on purpose; the next test holds it.
    for (const f of ALBUM_SURFACES.flatMap(files).filter((f) => !f.endsWith("songs.json"))) {
      fs.readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/loop ?soul/i.test(line) && !isComment(line)) found.push(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });

  it("is pressed on two records, Loop Soul then Signs of Life", () => {
    // A page naming the first record reads RECORD_NAMES[1] or the data, never
    // the literal, so a stale "Loop Soul" meaning the whole cannot hide in it.
    expect(RECORD_NAMES).toEqual({ 1: "Loop Soul", 2: "Signs of Life" });
  });

  it("gives the records their names in the song list, and nothing else there says Loop Soul", () => {
    // The film branch splits the song list into the two records
    // (`albums: { "1": { title }, "2": { title } }`); main has one album.
    const { albums, ...rest } = SONGS_JSON as { albums?: Record<string, { title: string }> };
    if (albums) {
      const titles = Object.fromEntries(Object.entries(albums).map(([v, a]) => [v, a.title]));
      expect(titles).toEqual({ "1": RECORD_NAMES[1], "2": RECORD_NAMES[2] });
    }
    expect(JSON.stringify(rest)).not.toMatch(/loop ?soul/i);
  });
});
