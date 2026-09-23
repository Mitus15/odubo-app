/**
 * Build the Loop Soul press kit and publish its heavy parts.
 *
 *   npm run loop:press              # zip + upload zip + reels, write the manifest
 *   npm run loop:press -- --no-reels
 *
 * What it does, in order:
 *   1. reads public/loop/press/{artwork,cover,logos,photos} (what the page shows
 *      and serves statically, straight from git)
 *   2. zips those plus docs/loop/press/{README,press-release}.md into one file
 *   3. uploads the zip and the living-poster reels to R2 under
 *      warehouse/press/loop-soul-v1/ (too heavy for git; served through the
 *      presigned media route, /api/media/audio/<key>, which allows warehouse/)
 *   4. writes src/lib/loop/press/manifest.json, which /loop/press renders
 *
 * Adding photos: drop JPG/PNG files into public/loop/press/photos, run this,
 * commit, push. That is the whole procedure.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createStorageService } from "../../src/lib/storage/StorageService";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public/loop/press");
const DOCS_DIR = path.join(ROOT, "docs/loop/press");
const MANIFEST = path.join(ROOT, "src/lib/loop/press/manifest.json");
const R2_PREFIX = "warehouse/press/loop-soul-v1";
const ZIP_NAME = "Loop-Soul-Press-Kit.zip";
const DEFAULT_REELS = path.join(os.homedir(), "Documents/Loop-soul-the-entertainment-room/social-2026-09/living-poster");
const SECTIONS = ["artwork", "cover", "logos", "photos"] as const;
const SHOWABLE = /\.(png|jpe?g|webp|svg)$/i;

const args = new Set(process.argv.slice(2));
const reelsDir = [...args].find((a) => a.startsWith("--reels="))?.split("=")[1] ?? DEFAULT_REELS;

type FileEntry = { name: string; href: string; bytes: number; w: number | null; h: number | null };

async function listSection(section: string): Promise<FileEntry[]> {
  const dir = path.join(PUBLIC_DIR, section);
  const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => SHOWABLE.test(n)).sort();
  const out: FileEntry[] = [];
  for (const name of names) {
    const full = path.join(dir, name);
    const buf = await fs.readFile(full);
    const meta = /\.svg$/i.test(name) ? null : await sharp(buf).metadata().catch(() => null);
    // Public images are cached for a year (next.config headers), and a
    // re-render keeps the filename: the content hash is what changes the URL.
    const v = createHash("sha1").update(buf).digest("hex").slice(0, 10);
    out.push({ name, href: `/loop/press/${section}/${encodeURIComponent(name)}?v=${v}`, bytes: buf.length, w: meta?.width ?? null, h: meta?.height ?? null });
  }
  return out;
}

async function main() {
  const sections = Object.fromEntries(await Promise.all(SECTIONS.map(async (s) => [s, await listSection(s)] as const)));

  // 2 — the zip, staged so its folders read cleanly when opened.
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), "loop-press-"));
  const kit = path.join(stage, "Loop-Soul-Press-Kit");
  for (const s of SECTIONS) {
    const files = sections[s] as FileEntry[];
    if (files.length === 0) continue;
    await fs.mkdir(path.join(kit, s), { recursive: true });
    for (const f of files) await fs.copyFile(path.join(PUBLIC_DIR, s, f.name), path.join(kit, s, f.name));
  }
  await fs.copyFile(path.join(DOCS_DIR, "README.md"), path.join(kit, "README.md"));
  await fs.copyFile(path.join(DOCS_DIR, "press-release.md"), path.join(kit, "press-release.md"));
  const zipPath = path.join(stage, ZIP_NAME);
  execFileSync("zip", ["-rq", "-X", zipPath, "Loop-Soul-Press-Kit"], { cwd: stage });
  const zip = await fs.readFile(zipPath);
  console.log(`→ zip: ${(zip.length / 1e6).toFixed(1)} MB`);

  // 3 — the heavy parts, to R2.
  const storage = createStorageService();
  const put = async (key: string, file: Buffer, filename: string) => {
    const r = await storage.uploadToR2({ contentType: "document" as never, file, filename, metadata: { filename } as never, customKey: key });
    if (!r.success) throw new Error(`upload failed: ${key}`);
    console.log(`→ uploaded ${key} (${(file.length / 1e6).toFixed(1)} MB)`);
  };
  const zipKey = `${R2_PREFIX}/${ZIP_NAME}`;
  await put(zipKey, zip, ZIP_NAME);

  const previous = JSON.parse(await fs.readFile(MANIFEST, "utf8").catch(() => "{}")) as { reels?: unknown[] };
  let reels = (previous.reels ?? []) as { name: string; href: string; bytes: number; silent: boolean }[];
  if (!args.has("--no-reels")) {
    const names = (await fs.readdir(reelsDir)).filter((n) => n.endsWith(".mp4")).sort();
    if (names.length === 0) throw new Error(`no reels in ${reelsDir}`);
    reels = [];
    for (const name of names) {
      const buf = await fs.readFile(path.join(reelsDir, name));
      const key = `${R2_PREFIX}/reels/${name}`;
      await put(key, buf, name);
      reels.push({ name, href: `/api/media/audio/${key}`, bytes: buf.length, silent: name.includes("-silent") });
      // A still for the page, so a reel is not a black box until it plays.
      const kind = name.match(/-30s-([a-z]+)-silent\.mp4$/)?.[1];
      if (kind) {
        await fs.mkdir(path.join(PUBLIC_DIR, "reels"), { recursive: true });
        execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", "3", "-i", path.join(reelsDir, name), "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", path.join(PUBLIC_DIR, "reels", `${kind}.jpg`)]);
      }
    }
  }

  // 4 — what the page renders.
  const manifest = {
    builtAt: new Date().toISOString(),
    zip: { name: ZIP_NAME, href: `/api/media/audio/${zipKey}`, bytes: zip.length },
    ...sections,
    reels,
  };
  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`→ manifest: ${path.relative(ROOT, MANIFEST)}`);
  await fs.rm(stage, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
