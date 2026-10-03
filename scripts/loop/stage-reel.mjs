/**
 * Put a finished reel into the Social CMS as a DRAFT.
 *
 *   node scripts/loop/stage-reel.mjs \
 *     --file=reel.mp4 --title="…" --caption="…" --hashtags="#a #b" \
 *     --when=2026-09-14T10:00:00-07:00 [--product=infinity-hoodie] [--folder=reels] [--dry]
 *
 * Uploads to Cloudflare Stream, waits for the direct MP4 download to exist,
 * then writes two rows that share the upload:
 *
 *   videos          the piece as a clip for the site's feed, HIDDEN, carrying
 *                   --product (a Shopify handle, checked before anything is
 *                   uploaded), so the clip's shop button opens that product
 *   social_content  the post, status 'draft', pointing at that clip
 *
 * The clip goes live in the feed when the post does: the status sync
 * (/api/admin/social/status) makes a draft's clip public once PostForMe
 * delivers it. A post made by hand from the phone does not pass through
 * PostForMe; make its clip public in /admin/videos.
 *
 * It stops at draft ON PURPOSE. Handing a post to PostForMe is what actually
 * publishes it — `scheduled_at` means PostForMe holds the timer and fires with
 * nobody watching — so that step stays a human pressing publish in
 * /admin/social. `scheduled_for` on a draft is only a date on the calendar;
 * nothing in the app consumes it.
 *
 * Why it waits for the MP4 rather than trusting the upload: the publish route
 * builds `https://videodelivery.net/<uid>/downloads/default.mp4`, and PostForMe
 * needs a real direct MP4 — never HLS, never an iframe URL. If that file does
 * not exist yet the post fails at publish time, which is the worst moment to
 * find out. See the 2026-02-11 crisis in docs/ for what silent fallbacks here
 * cost last time: 112 broken deployments.
 */
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const STREAM_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const D1_TOKEN = process.env.CLOUDFLARE_D1_API_TOKEN;
const D1_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
for (const [k, v] of Object.entries({ ACCOUNT, STREAM_TOKEN, D1_TOKEN, D1_ID })) {
  if (!v) throw new Error(`missing env: ${k}`);
}
const STREAM_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream`;
// The env's D1 URL is a template with unexpanded ${...} in it, so build it.
const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${D1_ID}/query`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The product a clip will open, checked in Shopify before anything is uploaded: {id, title} or a thrown error. */
async function productOf(handle) {
  const store = (process.env.SHOPIFY_STORE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!store || !token) throw new Error("--product needs SHOPIFY_STORE_URL and SHOPIFY_ADMIN_ACCESS_TOKEN");
  const res = await fetch(`https://${store}/admin/api/2024-07/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query($h: String!) { productByHandle(handle: $h) { id title status } }",
      variables: { h: handle },
    }),
  });
  const p = (await res.json()).data?.productByHandle;
  if (!p) throw new Error(`no product with the handle "${handle}" in Shopify`);
  if (p.status !== "ACTIVE") throw new Error(`"${handle}" is ${p.status}, not for sale`);
  return p;
}

async function d1(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${D1_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`D1: ${JSON.stringify(json.errors)}`);
  return json.result?.[0]?.results ?? [];
}

async function streamGet(uid) {
  const res = await fetch(`${STREAM_BASE}/${uid}`, {
    headers: { Authorization: `Bearer ${STREAM_TOKEN}` },
  });
  return (await res.json()).result;
}

async function upload(file) {
  const bytes = await fs.promises.readFile(file);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "video/mp4" }), path.basename(file));
  const res = await fetch(`${STREAM_BASE}?direct_user=false`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STREAM_TOKEN}` },
    body: form,
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Stream upload: ${JSON.stringify(json.errors)}`);
  return json.result.uid;
}

/** Ask Stream for the downloadable MP4 and wait until it really exists. */
async function ensureMp4(uid) {
  await fetch(`${STREAM_BASE}/${uid}/downloads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STREAM_TOKEN}`, "Content-Type": "application/json" },
    body: "{}",
  });
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${STREAM_BASE}/${uid}/downloads`, {
      headers: { Authorization: `Bearer ${STREAM_TOKEN}` },
    });
    const d = (await res.json()).result?.default;
    if (d?.status === "ready") return d.url;
    process.stdout.write(`\r  mp4: ${d?.status ?? "requesting"} ${d?.percentComplete ?? 0}%   `);
    await sleep(5000);
  }
  throw new Error("Stream never produced a downloadable MP4");
}

async function main() {
  const file = path.resolve(args.file);
  const title = String(args.title);
  const caption = String(args.caption ?? "");
  const hashtags = String(args.hashtags ?? "");
  const when = args.when ? new Date(String(args.when)).toISOString() : null;
  const folderName = String(args.folder ?? "reels");
  if (!args.file || !args.title) throw new Error("need --file and --title");
  const handle = args.product ? String(args.product) : null;
  const product = handle ? await productOf(handle) : null;

  const folders = await d1(`SELECT id, name FROM social_folders WHERE slug = ?1 OR name = ?1`, [folderName]);
  const folderId = folders[0]?.id ?? null;
  console.log(`${path.basename(file)}  →  folder ${folderName}${folderId ? ` (#${folderId})` : " (none found)"}`);

  if (args.dry) {
    console.log(`  DRY RUN — would upload and insert:\n    title: ${title}\n    when:  ${when}`);
    console.log(`    clip:  hidden in the feed until posted${product ? `, opens ${product.title} (${handle})` : ", no product"}`);
    return;
  }

  console.log(`  uploading ${(fs.statSync(file).size / 1e6).toFixed(1)} MB to Stream…`);
  const uid = await upload(file);
  for (let i = 0; i < 60; i++) {
    const v = await streamGet(uid);
    if (v?.readyToStream) break;
    process.stdout.write(`\r  encoding: ${v?.status?.pctComplete ?? 0}%   `);
    await sleep(5000);
  }
  const mp4 = await ensureMp4(uid);
  process.stdout.write("\r");
  console.log(`  uid ${uid}`);
  console.log(`  mp4 ${mp4}`);

  const duration = (await streamGet(uid))?.duration ?? null;
  const thumb = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
  const now = new Date().toISOString();

  // The clip for the site's feed: hidden until the post goes out.
  await d1(
    `INSERT INTO videos (uid, stream_video_id, title, description, url, poster_url, mp4_url, type, is_public,
                         publication_status, status, shopify_product_handle, shopify_product_id,
                         duration_seconds, created_at, updated_at)
     VALUES (?1, ?1, ?2, ?3, ?4, ?5, ?6, 'clip', 0, 'archived', 'published', ?7, ?8, ?9, ?10, ?10)`,
    [uid, title, caption, `https://iframe.videodelivery.net/${uid}`, thumb, mp4, handle, product?.id ?? null, duration, now],
  );
  const clip = await d1(`SELECT id FROM videos WHERE uid = ?1`, [uid]);

  await d1(
    `INSERT INTO social_content
       (folder_id, source_type, upload_uid, video_id, thumbnail_url, duration, title,
        caption_instagram, hashtags_instagram, status, scheduled_for)
     VALUES (?1, 'upload', ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'draft', ?9)`,
    [folderId, uid, clip[0]?.id ?? null, thumb, duration, title, caption, hashtags, when],
  );
  const row = await d1(`SELECT id FROM social_content WHERE upload_uid = ?1`, [uid]);
  console.log(`  drafted as social_content #${row[0]?.id}${when ? ` · calendar ${when}` : ""}`);
  console.log(`  clip #${clip[0]?.id} waits hidden in the feed${product ? `, opening ${product.title}` : ""}\n`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
