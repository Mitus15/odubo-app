/**
 * File the Loop Soul drop in Shopify.
 *
 * Tapstitch imports arrive raw: vendor `ODMPOD`, no tags, no category, no SEO,
 * empty alt text, supplier boilerplate copy, and — the one that actually
 * hides them — published to the Online Store channel only, which the headless
 * site never reads. This script takes each piece in MANIFEST to the house
 * standard the other B.A.A.D garments already meet, and makes it visible to
 * the Storefront API.
 *
 *   npx tsx --env-file=.env.local scripts/shopify/loop-soul-drop.ts           # dry run: prints the diff
 *   npx tsx --env-file=.env.local scripts/shopify/loop-soul-drop.ts --apply   # writes
 *
 * Every step compares before it writes, so the script is safe to re-run. A
 * JSON backup of the products as found is written to docs/shopify/ first.
 *
 * Filing rule (owner, 2026-09-10): the garments are made by the label, for
 * the project. Vendor B.A.A.D · `brand:baad` · `drop:loop-soul` · `type:<garment>`
 * · in the `loop-soul` collection. Never `loop-pass` — that tag is admission,
 * and it is what keeps a product OUT of the Odubo store.
 */
import fs from "node:fs/promises";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const API_VERSION = "2024-07";

// ---------------------------------------------------------------------------
// The manifest — the hand-written part. Everything else is derived.
// ---------------------------------------------------------------------------

const VENDOR = "B.A.A.D";
const DROP_TAG = "drop:loop-soul";
const BRAND_TAG = "brand:baad";
const COLLECTION_HANDLE = "loop-soul";
/** The garment whose sales channels the new pieces mirror. */
const REFERENCE_HANDLE = "manteau-de-vin";

const CATEGORY = {
  tee: "gid://shopify/TaxonomyCategory/aa-1-13-8", // Clothing Tops > T-Shirts
  hoodie: "gid://shopify/TaxonomyCategory/aa-1-13-13", // Clothing Tops > Hoodies
  jeans: "gid://shopify/TaxonomyCategory/aa-1-12-4", // Pants > Jeans
} as const;

type Piece = {
  /** Current handle in Shopify — how the script finds the product. */
  from: string;
  title: string;
  handle: string;
  productType: "Tops" | "Bottoms";
  type: keyof typeof CATEGORY;
  /** One billing line about the piece. Not a paragraph. */
  line: string;
};

const MANIFEST: Piece[] = [
  {
    from: "unisex-heavyweight-slim-fit-t-shirt",
    title: "Script Tee",
    handle: "script-tee",
    productType: "Tops",
    type: "tee",
    line: "The loop∞Soul script on the chest. Slim, heavyweight cotton — 280 gsm.",
  },
  {
    from: "curved-panel-raglan-hoodie",
    title: "Infinity Hoodie",
    handle: "infinity-hoodie",
    productType: "Tops",
    type: "hoodie",
    line: "The ∞ across the chest. Oversized pullover, curved panels, hidden side zips, no drawstring — 350 gsm.",
  },
  {
    from: "heavyweight-raglan-sleeve-zip-hoodie",
    title: "Infinity Zip Hoodie",
    handle: "infinity-zip-hoodie",
    productType: "Tops",
    type: "hoodie",
    line: "The ∞ on the chest, a wine stripe down each sleeve. Two-way zip, raglan sleeve — 400 gsm.",
  },
  {
    from: "mens-vintage-wash-barrel-leg-jeans",
    title: "Barrel Jeans",
    handle: "barrel-jeans",
    productType: "Bottoms",
    type: "jeans",
    line: "Vintage wash, barrel leg, mid rise. Heavy cotton denim — 450 gsm.",
  },
];

const CARE =
  "<p><strong>Care.</strong> Machine wash at 30°C (gentle cycle). Do not bleach. Tumble dry low. Iron at low temperature, avoid ironing on print. Do not dry clean.</p>";

/** House order for size-guide rows; anything else follows, in supplier order. */
const ROW_ORDER = ["Chest", "Length", "Shoulder", "Sleeve length", "Waist", "Hip"];

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

function config() {
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!storeUrl || !token) {
    throw new Error("SHOPIFY_STORE_URL and SHOPIFY_ADMIN_ACCESS_TOKEN must be set (run with --env-file=.env.local)");
  }
  return { endpoint: `${storeUrl.replace(/\/$/, "")}/admin/api/${API_VERSION}/graphql.json`, token };
}

type UserError = { field?: string[] | null; message: string };

async function admin<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { endpoint, token } = config();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Admin API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  return json.data as T;
}

function userErrors(payload: { userErrors?: UserError[] } | null | undefined, what: string) {
  const errs = payload?.userErrors ?? [];
  if (errs.length) throw new Error(`${what}: ${errs.map((e) => `${(e.field ?? []).join(".")} ${e.message}`).join("; ")}`);
}

const PRODUCT_FIELDS = `
  id title handle status vendor productType tags descriptionHtml
  category { id fullName }
  seo { title description }
  collections(first: 20) { nodes { id handle } }
  resourcePublicationsV2(first: 20) { nodes { isPublished publication { id name } } }
  options { name values }
  variants(first: 50) { nodes { id title price selectedOptions { name value } image { url } } }
  media(first: 20) { nodes { id alt mediaContentType ... on MediaImage { image { url } } } }
  images(first: 20) { nodes { id url altText } }
`;

type Product = {
  id: string; title: string; handle: string; status: string; vendor: string; productType: string;
  tags: string[]; descriptionHtml: string;
  category: { id: string; fullName: string } | null;
  seo: { title: string | null; description: string | null };
  collections: { nodes: { id: string; handle: string }[] };
  resourcePublicationsV2: { nodes: { isPublished: boolean; publication: { id: string; name: string } }[] };
  options: { name: string; values: string[] }[];
  variants: { nodes: { id: string; title: string; price: string; selectedOptions: { name: string; value: string }[]; image: { url: string } | null }[] };
  media: { nodes: { id: string; alt: string | null; mediaContentType: string; image?: { url: string } | null }[] };
  /** The legacy image ids — the REST images endpoint is the alt-text write
   *  path a products-scoped token is allowed (fileUpdate needs write_files). */
  images: { nodes: { id: string; url: string; altText: string | null }[] };
};

async function productByHandle(handle: string): Promise<Product | null> {
  const data = await admin<{ productByHandle: Product | null }>(
    `query($handle: String!) { productByHandle(handle: $handle) { ${PRODUCT_FIELDS} } }`,
    { handle },
  );
  return data.productByHandle;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/**
 * The supplier's size table: header row of sizes (each `colspan="2"`), a row of
 * `inch | cm` labels, then one row per measurement with inch/cm pairs. Rebuilt
 * as the semantic table the house uses, with both units in one cell.
 */
function rebuildSizeGuide(html: string): string | null {
  const table = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) return null;
  const rows = [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1])),
  );
  if (rows.length < 3) return null;
  const sizes = rows[0].slice(1).filter(Boolean);
  const measurements = rows.slice(2).filter((r) => r.length === 1 + sizes.length * 2);
  const byLabel = new Map(measurements.map((r) => [r[0], r.slice(1)]));
  const ordered = [
    ...ROW_ORDER.filter((l) => byLabel.has(l)),
    ...measurements.map((r) => r[0]).filter((l) => !ROW_ORDER.includes(l)),
  ];
  const head = sizes.map((s) => `<th scope="col">${s}</th>`).join("\n");
  const body = ordered
    .map((label) => {
      const cells = byLabel.get(label)!;
      const tds = sizes
        .map((_, i) => `<td>${Number(cells[i * 2]).toFixed(1)} in / ${cells[i * 2 + 1]} cm</td>`)
        .join("\n");
      return `<tr>\n<th scope="row">${label}</th>\n${tds}\n</tr>`;
    })
    .join("\n");
  return `<table>\n<thead><tr>\n<th scope="col">Measurement</th>\n${head}\n</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

/** True once a description is already in the house shape, with a real table body. */
function isHouseDescription(html: string): boolean {
  return /<th scope="col">Measurement<\/th>/.test(html) && /<th scope="row">/.test(html);
}

/**
 * The size guide is rebuilt from the SUPPLIER's table. After the first apply
 * the live description no longer carries one — so the backup taken on the
 * first run is the source of truth from then on. A description already in
 * house form with a real table body is left exactly as it is.
 */
function buildDescription(piece: Piece, current: string, original: string | undefined): string {
  if (isHouseDescription(current)) return current;
  const guide = rebuildSizeGuide(current) ?? (original ? rebuildSizeGuide(original) : null);
  if (!guide) throw new Error(`${piece.handle}: no supplier size table to rebuild from (live or backup)`);
  return [
    `<p>${piece.line}</p>`,
    CARE,
    "<h3>Size guide</h3>",
    "<p>Flat garment measurements. Allow 1–2 cm tolerance.</p>",
    guide,
  ].join("\n");
}

function optionValues(p: Product, name: RegExp): string[] {
  return p.options.find((o) => name.test(o.name))?.values ?? [];
}

function buildSeo(piece: Piece, p: Product, currency: string) {
  const colours = optionValues(p, /^colou?r$/i);
  const sizes = optionValues(p, /^size$/i);
  const price = Number(p.variants.nodes[0]?.price ?? 0).toFixed(2);
  const parts = [
    `${piece.title} — the Loop Soul drop by ${VENDOR}, Odubo Studio.`,
    colours.length ? `${colours.join(", ")}.` : null,
    sizes.length ? `Sizes ${sizes.join(", ")}.` : null,
    `$${price} ${currency}.`,
  ].filter(Boolean);
  return { title: `${piece.title} — ${VENDOR} | Odubo Studio`, description: parts.join(" ") };
}

/**
 * Alt text per image, from the variant links: an image a variant points at is
 * the front of that colour; unlinked images that follow it are the back.
 */
function altTexts(piece: Piece, p: Product): { id: string; alt: string }[] {
  const key = (url: string) => url.split("?")[0];
  const colourByUrl = new Map<string, string>();
  for (const v of p.variants.nodes) {
    const colour = v.selectedOptions.find((o) => /^colou?r$/i.test(o.name))?.value;
    if (v.image?.url && colour && !colourByUrl.has(key(v.image.url))) colourByUrl.set(key(v.image.url), colour);
  }
  const out: { id: string; alt: string }[] = [];
  let colour: string | null = null;
  for (const img of p.images.nodes) {
    const linked = colourByUrl.get(key(img.url));
    let view: string;
    if (linked) {
      colour = linked;
      view = "front view";
    } else {
      view = "back view";
    }
    const alt = colour ? `${piece.title} in ${colour} — ${view}` : `${piece.title} — ${view}`;
    out.push({ id: img.id, alt });
  }
  return out;
}

/** PUT /products/{id}/images/{image_id}.json — write_products is enough here. */
async function setImageAlt(productId: string, imageId: string, alt: string) {
  const { endpoint, token } = config();
  const pid = productId.split("/").pop();
  const iid = imageId.split("/").pop();
  const url = endpoint.replace(/graphql\.json$/, `products/${pid}/images/${iid}.json`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ image: { id: Number(iid), alt } }),
  });
  if (!res.ok) throw new Error(`image alt ${res.status}: ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  console.log(APPLY ? "APPLY — writing to Shopify" : "DRY RUN — nothing will be written (pass --apply)");

  const shop = await admin<{ shop: { currencyCode: string } }>(`{ shop { currencyCode } }`);
  const currency = shop.shop.currencyCode;

  const collection = await admin<{ collectionByHandle: { id: string } | null }>(
    `query($h: String!) { collectionByHandle(handle: $h) { id } }`,
    { h: COLLECTION_HANDLE },
  );
  if (!collection.collectionByHandle) throw new Error(`Collection ${COLLECTION_HANDLE} does not exist`);
  const collectionId = collection.collectionByHandle.id;

  const reference = await productByHandle(REFERENCE_HANDLE);
  if (!reference) throw new Error(`Reference garment ${REFERENCE_HANDLE} not found`);
  const publications = reference.resourcePublicationsV2.nodes
    .filter((n) => n.isPublished)
    .map((n) => n.publication);
  console.log(`Channels (mirroring ${REFERENCE_HANDLE}): ${publications.map((p) => p.name).join(" · ")}\n`);

  // Find every product first — by new handle if a previous run renamed it.
  const found: { piece: Piece; product: Product }[] = [];
  for (const piece of MANIFEST) {
    const product = (await productByHandle(piece.handle)) ?? (await productByHandle(piece.from));
    if (!product) throw new Error(`Not found: ${piece.from} / ${piece.handle}`);
    found.push({ piece, product });
  }

  // Backup as found, before any write.
  const stamp = new Date().toISOString().slice(0, 10);
  const backupPath = path.join("docs", "shopify", `backup-${stamp}-loop-soul-drop.json`);
  let originals: Product[];
  try {
    originals = JSON.parse(await fs.readFile(backupPath, "utf8")) as Product[];
    console.log(`Backup already exists, keeping it: ${backupPath}`);
  } catch {
    originals = found.map((f) => f.product);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, JSON.stringify(originals, null, 2));
    console.log(`Backup written: ${backupPath}`);
  }
  const originalById = new Map(originals.map((o) => [o.id, o]));

  for (const { piece, product: p } of found) {
    console.log(`\n=== ${p.title}  (${p.handle}) → ${piece.title}  (${piece.handle})`);

    // 1. productUpdate — only the fields that differ.
    const input: Record<string, unknown> = { id: p.id };
    const want = {
      title: piece.title,
      handle: piece.handle,
      vendor: VENDOR,
      productType: piece.productType,
      descriptionHtml: buildDescription(piece, p.descriptionHtml, originalById.get(p.id)?.descriptionHtml),
    };
    // Shopify re-serialises stored HTML, so compare with whitespace collapsed
    // or every run would rewrite the description it just wrote.
    const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
    for (const [k, v] of Object.entries(want) as [keyof typeof want, string][]) {
      if (!same(p[k], v)) input[k] = v;
    }
    const seo = buildSeo(piece, p, currency);
    if (p.seo.title !== seo.title || p.seo.description !== seo.description) input.seo = seo;
    if (p.category?.id !== CATEGORY[piece.type]) input.category = CATEGORY[piece.type];
    if (!p.collections.nodes.some((c) => c.id === collectionId)) input.collectionsToJoin = [collectionId];
    if (input.handle) input.redirectNewHandle = true;

    const changes = Object.keys(input).filter((k) => k !== "id");
    if (changes.length) {
      console.log(`  productUpdate: ${changes.join(", ")}`);
      if (input.descriptionHtml) console.log(`  description →\n${String(input.descriptionHtml).replace(/^/gm, "    ")}`);
      if (input.seo) console.log(`  seo → ${JSON.stringify(seo)}`);
      if (APPLY) {
        const res = await admin<{ productUpdate: { userErrors: UserError[] } }>(
          `mutation($input: ProductInput!) { productUpdate(input: $input) { product { id handle } userErrors { field message } } }`,
          { input },
        );
        userErrors(res.productUpdate, "productUpdate");
      }
    } else {
      console.log("  productUpdate: nothing to change");
    }

    // 2. Tags — add only, never replace.
    const wantTags = [BRAND_TAG, DROP_TAG, `type:${piece.type}`];
    const missing = wantTags.filter((t) => !p.tags.includes(t));
    if (p.tags.includes("loop-pass")) throw new Error(`${piece.handle} carries loop-pass — a garment must never`);
    if (missing.length) {
      console.log(`  tagsAdd: ${missing.join(", ")}`);
      if (APPLY) {
        const res = await admin<{ tagsAdd: { userErrors: UserError[] } }>(
          `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`,
          { id: p.id, tags: missing },
        );
        userErrors(res.tagsAdd, "tagsAdd");
      }
    } else {
      console.log("  tags: already filed");
    }

    // 3. Sales channels — the step that makes the piece visible to the site.
    const on = new Set(p.resourcePublicationsV2.nodes.filter((n) => n.isPublished).map((n) => n.publication.id));
    const toPublish = publications.filter((pub) => !on.has(pub.id));
    if (toPublish.length) {
      console.log(`  publish to: ${toPublish.map((x) => x.name).join(" · ")}`);
      if (APPLY) {
        const res = await admin<{ publishablePublish: { userErrors: UserError[] } }>(
          `mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`,
          { id: p.id, input: toPublish.map((x) => ({ publicationId: x.id })) },
        );
        userErrors(res.publishablePublish, "publishablePublish");
      }
    } else {
      console.log("  channels: already published everywhere the label is");
    }

    // 4. Alt text.
    const alts = altTexts(piece, p).filter((a) => p.images.nodes.find((i) => i.id === a.id)?.altText !== a.alt);
    if (alts.length) {
      for (const a of alts) {
        console.log(`  alt: ${a.alt}`);
        if (APPLY) await setImageAlt(p.id, a.id, a.alt);
      }
    } else {
      console.log("  alt text: already set");
    }
  }

  console.log(APPLY ? "\nDone." : "\nDry run complete. Re-run with --apply to write.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
