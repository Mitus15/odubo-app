import fs from "node:fs";
import path from "node:path";
import { ALBUM_NAME } from "@/lib/loop/albumName";
import SONGS_JSON from "@/lib/loop/film/songs.json";

/**
 * The album is Signs of Life (owner, 2026-10-03). Loop Soul is the night, and
 * keeps its name on the night's pages (the pass, the door, the store, legal).
 * Every page about the record names it from ALBUM_NAME, so this fails the day
 * a branch written before the rename merges and puts "Loop Soul" back on one.
 * Comments may still say it: they record history.
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
    for (const f of ALBUM_SURFACES.flatMap(files)) {
      fs.readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/loop ?soul/i.test(line) && !isComment(line)) found.push(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });

  it("is not Loop Soul in the song list either", () => {
    expect(JSON.stringify(SONGS_JSON)).not.toMatch(/loop ?soul/i);
  });
});
