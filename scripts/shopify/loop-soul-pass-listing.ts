/**
 * File the Loop Soul pass in Shopify the way a guest reads it.
 *
 * As found: title "Loop Soul — Volume 1 Pass", vendor "Odubo" (so the store
 * lockup read "Odubo by Odubo Studio"), a description that promised "the
 * anthem" (a deleted feature) and a code that "arrives by email", no SEO.
 * The product a guest buys is called Loop Soul. This sets the words and
 * touches nothing that the sale depends on: not the SKU (the webhook's
 * matcher), not the variant (the checkout permalink), not the handle, not the
 * price, not the inventory.
 *
 *   npx tsx --env-file=.env.local scripts/shopify/loop-soul-pass-listing.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/shopify/loop-soul-pass-listing.ts --apply   # writes
 *
 * A JSON backup of the product as found is written to docs/shopify/ first.
 */
import fs from "node:fs/promises";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const API_VERSION = "2024-07";

const PASS_PRODUCT_ID = "gid://shopify/Product/9530389397717";

const WANT = {
  title: "Loop Soul Pass",
  vendor: "Odubo Studio",
  descriptionHtml:
    "<p>Admits one. Saturday 10 October, Scott's Inn, Kamloops, from 6:30. Your ticket and your record follow by email.</p>",
  seo: {
    title: "Loop Soul Pass · Odubo Studio",
    description: "Admits one. Saturday 10 October, Scott's Inn, Kamloops, from 6:30. Your ticket and your record follow by email.",
  },
};

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

type Product = {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  tags: string[];
  descriptionHtml: string;
  seo: { title: string | null; description: string | null };
  variants: { nodes: { id: string; sku: string | null; price: string }[] };
};

async function main() {
  console.log(APPLY ? "APPLY: writing to Shopify" : "DRY RUN: nothing will be written (pass --apply)");

  const data = await admin<{ product: Product | null }>(
    `query($id: ID!) { product(id: $id) {
       id title handle vendor tags descriptionHtml seo { title description }
       variants(first: 5) { nodes { id sku price } }
     } }`,
    { id: PASS_PRODUCT_ID },
  );
  const p = data.product;
  if (!p) throw new Error(`Pass product ${PASS_PRODUCT_ID} not found`);
  if (!p.tags.includes("loop-pass")) throw new Error(`${p.handle} is not tagged loop-pass; refusing to touch it`);

  const stamp = new Date().toISOString().slice(0, 10);
  const backupPath = path.join("docs", "shopify", `backup-${stamp}-loop-soul-pass.json`);
  try {
    await fs.access(backupPath);
    console.log(`Backup already exists, keeping it: ${backupPath}`);
  } catch {
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, JSON.stringify(p, null, 2));
    console.log(`Backup written: ${backupPath}`);
  }

  console.log(`\n=== ${p.title}  (${p.handle}) · vendor ${p.vendor} · ${p.variants.nodes.map((v) => `${v.sku} $${v.price}`).join(", ")}`);

  const input: Record<string, unknown> = { id: p.id };
  const changes: string[] = [];
  if (p.title !== WANT.title) { input.title = WANT.title; changes.push(`title "${p.title}" → "${WANT.title}"`); }
  if (p.vendor !== WANT.vendor) { input.vendor = WANT.vendor; changes.push(`vendor "${p.vendor}" → "${WANT.vendor}"`); }
  if (p.descriptionHtml.trim() !== WANT.descriptionHtml) { input.descriptionHtml = WANT.descriptionHtml; changes.push(`description → ${WANT.descriptionHtml}`); }
  if (p.seo.title !== WANT.seo.title || p.seo.description !== WANT.seo.description) {
    input.seo = WANT.seo;
    changes.push(`seo → "${WANT.seo.title}"`);
  }

  if (changes.length === 0) {
    console.log("  nothing to change");
    return;
  }
  for (const c of changes) console.log(`  ${c}`);

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write.");
    return;
  }
  const res = await admin<{ productUpdate: { userErrors: UserError[] } }>(
    `mutation($input: ProductInput!) { productUpdate(input: $input) { product { id title vendor } userErrors { field message } } }`,
    { input },
  );
  const errs = res.productUpdate.userErrors ?? [];
  if (errs.length) throw new Error(`productUpdate: ${errs.map((e) => `${(e.field ?? []).join(".")} ${e.message}`).join("; ")}`);
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
