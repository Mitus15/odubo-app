/**
 * Replace a product's photos with background-free cut-outs.
 *
 * Supplier renders come on flat white. The store puts them on sand and on
 * near-black, where a white square reads as a card. This lifts the garment
 * off the white with macOS Vision's subject mask (liftsubject.swift, the same
 * engine Photos uses), re-uploads each image in place with the same alt text,
 * position and variant links, then deletes the original.
 *
 *   npx tsx --env-file=.env.local scripts/shopify/cutout-photos.ts script-tee infinity-hoodie
 *   npx tsx --env-file=.env.local scripts/shopify/cutout-photos.ts script-tee --apply
 *   npx tsx --env-file=.env.local scripts/shopify/cutout-photos.ts --vendor="B.A.A.D"
 *
 * An image whose subject cannot be found, or whose cut-out covers an
 * implausible share of the frame, is REPORTED AND LEFT ALONE — a product keeps
 * its original photo rather than getting a bad one. Nothing is uploaded for a
 * product unless every one of its images cut cleanly, so a garment never ends
 * up half cut-out and half white.
 *
 * Work files land in --dir (default: .cutouts/<handle>/, gitignored). Keep the
 * originals somewhere — Shopify's CDN copy is gone once the image is deleted.
 * macOS only (swiftc + Vision). Uses the REST images endpoint because
 * write_products is the only scope this token has for media.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const run = promisify(execFile);
const API_VERSION = "2024-07";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const dirArg = argv.find((a) => a.startsWith("--dir="))?.slice(6);
const vendorArg = argv.find((a) => a.startsWith("--vendor="))?.slice(9);
const HANDLES = argv.filter((a) => !a.startsWith("--"));
if (!HANDLES.length && !vendorArg) {
  console.error('usage: cutout-photos.ts <handle...> | --vendor="B.A.A.D" [--apply] [--dir=path]');
  process.exit(64);
}

/** A cut-out covering less/more of the frame than this is not a garment on white. */
const MIN_COVERAGE = 0.03;
const MAX_COVERAGE = 0.92;

function config() {
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!storeUrl || !token) throw new Error("SHOPIFY_STORE_URL and SHOPIFY_ADMIN_ACCESS_TOKEN must be set");
  const base = `${storeUrl.replace(/\/$/, "")}/admin/api/${API_VERSION}`;
  return { base, headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token } };
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { base, headers } = config();
  const res = await fetch(`${base}/graphql.json`, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  if (!res.ok) throw new Error(`Admin API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data as T;
}

async function rest(method: "POST" | "DELETE", p: string, body?: unknown) {
  const { base, headers } = config();
  const res = await fetch(`${base}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`REST ${method} ${p} ${res.status}: ${await res.text()}`);
  return res.status === 200 || res.status === 201 ? res.json() : null;
}

type Product = {
  id: string;
  handle: string;
  title: string;
  images: { nodes: { id: string; url: string; altText: string | null }[] };
  variants: { nodes: { id: string; image: { id: string } | null }[] };
};

const numeric = (gid: string) => Number(gid.split("/").pop());

/**
 * PNG colour type lives at byte 25 (IHDR): 6 = RGBA, 4 = grey+alpha. Supplier
 * renders are type 2 (RGB), so an alpha channel means this photo has already
 * been cut out and re-uploading it would only churn its id.
 */
function alreadyCutOut(png: Buffer): boolean {
  const isPng = png.length > 26 && png.readUInt32BE(0) === 0x89504e47;
  return isPng && (png[25] === 6 || png[25] === 4);
}

async function ensureLifter(): Promise<string> {
  const src = path.join(HERE, "liftsubject.swift");
  const bin = path.join(HERE, ".liftsubject");
  try {
    const [s, b] = await Promise.all([fs.stat(src), fs.stat(bin)]);
    if (b.mtimeMs >= s.mtimeMs) return bin;
  } catch {
    /* build below */
  }
  console.log("Building liftsubject (swiftc)…");
  await run("swiftc", ["-O", "-o", bin, src]);
  return bin;
}

async function main() {
  console.log(APPLY ? "APPLY — replacing images in Shopify" : "DRY RUN — cut-outs are made, nothing is uploaded (pass --apply)");
  const lifter = await ensureLifter();
  const problems: string[] = [];

  const handles = HANDLES.length
    ? HANDLES
    : (
        await gql<{ products: { nodes: { handle: string }[] } }>(
          `query($q: String!) { products(first: 100, query: $q) { nodes { handle } } }`,
          { q: `vendor:${vendorArg}` },
        )
      ).products.nodes.map((n) => n.handle);
  if (!HANDLES.length) console.log(`Vendor ${vendorArg}: ${handles.length} products`);

  for (const handle of handles) {
    const data = await gql<{ productByHandle: Product | null }>(
      `query($h: String!) { productByHandle(handle: $h) { id handle title
        images(first: 20) { nodes { id url altText } }
        variants(first: 100) { nodes { id image { id } } } } }`,
      { h: handle },
    );
    const p = data.productByHandle;
    if (!p) throw new Error(`Not found: ${handle}`);
    const dir = dirArg ?? path.join(".cutouts", handle);
    await fs.mkdir(dir, { recursive: true });
    console.log(`\n=== ${p.title} (${handle}) — ${p.images.nodes.length} images → ${dir}`);

    const plan: { position: number; alt: string; variantIds: number[]; file: string; oldId: number }[] = [];
    const skipped: string[] = [];
    const done: string[] = [];
    for (const [i, img] of p.images.nodes.entries()) {
      const stem = `${handle}-${i}`;
      const original = path.join(dir, `${stem}.original.png`);
      const cut = path.join(dir, `${stem}.png`);
      const res = await fetch(img.url);
      if (!res.ok) throw new Error(`download ${img.url}: ${res.status}`);
      const source = Buffer.from(await res.arrayBuffer());
      if (alreadyCutOut(source)) {
        console.log(`  ${stem}: already transparent — leaving it`);
        done.push(stem);
        continue;
      }
      await fs.writeFile(original, source);
      let coverage: number;
      try {
        const { stdout } = await run(lifter, [original, cut]);
        coverage = Number(/coverage=([\d.]+)/.exec(stdout)?.[1] ?? NaN);
      } catch (err) {
        console.log(`  ${stem}: SKIPPED — no subject found (${(err as Error).message.split("\n")[0]})`);
        skipped.push(stem);
        continue;
      }
      if (!(coverage > MIN_COVERAGE && coverage < MAX_COVERAGE)) {
        console.log(`  ${stem}: SKIPPED — coverage ${coverage.toFixed(3)} outside ${MIN_COVERAGE}–${MAX_COVERAGE}`);
        skipped.push(stem);
        continue;
      }
      const variantIds = p.variants.nodes.filter((v) => v.image?.id === img.id).map((v) => numeric(v.id));
      console.log(`  ${stem}: coverage ${coverage.toFixed(3)} · alt "${img.altText ?? ""}" · variants ${variantIds.length}`);
      plan.push({ position: i + 1, alt: img.altText ?? "", variantIds, file: cut, oldId: numeric(img.id) });
    }

    if (done.length === p.images.nodes.length) {
      console.log(`  → ${handle} is already cut out.`);
      continue;
    }
    if (skipped.length) {
      console.log(`  → NOT replacing ${handle}: ${skipped.length} of ${p.images.nodes.length} images did not cut cleanly.`);
      problems.push(handle);
      continue;
    }
    if (!APPLY) continue;

    // Upload every replacement first — variant links move to the new image on
    // creation — and only then delete the originals, so a failure half-way
    // leaves the product with more photos, never fewer.
    const pid = numeric(p.id);
    for (const step of plan) {
      const attachment = (await fs.readFile(step.file)).toString("base64");
      const created = (await rest("POST", `/products/${pid}/images.json`, {
        image: { attachment, filename: path.basename(step.file), alt: step.alt, position: step.position, variant_ids: step.variantIds },
      })) as { image: { id: number } };
      console.log(`  uploaded ${path.basename(step.file)} → image ${created.image.id}`);
    }
    for (const step of plan) {
      await rest("DELETE", `/products/${pid}/images/${step.oldId}.json`);
      console.log(`  deleted original image ${step.oldId}`);
    }
  }
  if (problems.length) console.log(`\nLeft untouched (a photo did not cut cleanly): ${problems.join(", ")}`);
  console.log(APPLY ? "\nDone." : "\nDry run complete. Review the cut-outs, then re-run with --apply.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
