/**
 * Put a Loop Soul record in the store as a pre-order, hidden until the owner
 * shows it. Loop Soul is two albums on two records (Vol. 1 and Vol. 2,
 * src/lib/loop/vinyl.ts), each its own product with its own price and ship date.
 *
 *   npm run shopify:loop-vinyl                                              # dry run: both records
 *   npm run shopify:loop-vinyl -- --volume=1 --price=30 --ships="in December" --apply
 *
 * Creates ONE product per run, `loop-soul-vol-<n>-vinyl`, as a DRAFT: nobody
 * sees it until it is set Active in Shopify (with its photos, and its price
 * checked). It is:
 *   - vendor Odubo Studio, not B.A.A.D: B.A.A.D is the clothing label; the
 *     record is the house's (docs brand architecture);
 *   - tagged `drop:loop-soul` (the Loop store reads the loop-soul collection),
 *     `type:vinyl`, `preorder` and `ships:<when>`, which is what makes it read
 *     "Pre-order" and "Ships ..." in the store (src/config/preorder.ts);
 *   - allowed to sell before stock exists (inventory policy CONTINUE): a
 *     pre-order has no stock yet;
 *   - in the `loop-soul` collection.
 *
 * It never guesses a price (--price is required to apply) and never touches a
 * vinyl that already exists: once it is there, it is edited in Shopify.
 */
import { vinylProduct } from "../../src/lib/loop/vinyl";
import { albumOfVolume, type Volume } from "../../src/lib/loop/songs";

const APPLY = process.argv.includes("--apply");
const API_VERSION = "2024-07";
const COLLECTION_HANDLE = "loop-soul";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

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

function check(payload: { userErrors?: UserError[] } | null | undefined, what: string) {
  const errs = payload?.userErrors ?? [];
  if (errs.length) throw new Error(`${what}: ${errs.map((e) => `${(e.field ?? []).join(".")} ${e.message}`).join("; ")}`);
}

async function main() {
  const volumeArg = arg("volume");
  if (!volumeArg) {
    if (APPLY) throw new Error("--volume=1 or --volume=2: one record per run, each with its own price");
    for (const v of [1, 2] as const) await one(v);
    return;
  }
  if (volumeArg !== "1" && volumeArg !== "2") throw new Error("--volume is 1 or 2");
  await one(Number(volumeArg) as Volume);
}

async function one(volume: Volume) {
  const price = arg("price");
  const ships = (arg("ships") ?? "after the album").trim();
  const tags = ["drop:loop-soul", "type:vinyl", "preorder", `ships:${ships}`];
  const record = vinylProduct(volume);
  const HANDLE = record.handle;
  const sides = record.sides.map((s) => `Side ${s.side}: ${s.titles.join(", ")}.`).join("<br>");
  const product = {
    title: record.title,
    handle: HANDLE,
    vendor: "Odubo Studio",
    productType: "Vinyl",
    status: "DRAFT",
    tags,
    descriptionHtml:
      `<p>${albumOfVolume(volume).title} by Mani Odubo, pressed to vinyl. A pre-order: yours is made and sent when the pressing is ready.</p>` +
      `<p>${sides}</p>`,
  };

  const existing = await admin<{ productByHandle: { id: string; status: string; title: string } | null }>(
    `query($h: String!) { productByHandle(handle: $h) { id status title } }`,
    { h: HANDLE },
  );
  if (existing.productByHandle) {
    console.log(`${HANDLE} already exists (${existing.productByHandle.status}): edit it in Shopify. Nothing changed.`);
    return;
  }

  console.log(APPLY ? "APPLY: creating the vinyl as a DRAFT" : "DRY RUN (pass --price=<amount> --apply)");
  console.log(JSON.stringify({ ...product, price: price ?? "(required to apply)", inventoryPolicy: "CONTINUE" }, null, 2));
  if (!APPLY) return;
  if (!price || !/^\d+(\.\d{1,2})?$/.test(price)) throw new Error("--price=<amount> is required, e.g. --price=40");

  const created = await admin<{
    productCreate: { product: { id: string; variants: { nodes: { id: string }[] } } | null; userErrors: UserError[] };
  }>(
    `mutation($input: ProductInput!) {
       productCreate(input: $input) { product { id variants(first: 1) { nodes { id } } } userErrors { field message } }
     }`,
    { input: product },
  );
  check(created.productCreate, "productCreate");
  const id = created.productCreate.product!.id;
  const variantId = created.productCreate.product!.variants.nodes[0]?.id;

  if (variantId) {
    const upd = await admin<{ productVariantsBulkUpdate: { userErrors: UserError[] } }>(
      `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
         productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
       }`,
      { productId: id, variants: [{ id: variantId, price, inventoryPolicy: "CONTINUE" }] },
    );
    check(upd.productVariantsBulkUpdate, "price and inventory policy");
  }

  const col = await admin<{ collectionByHandle: { id: string } | null }>(
    `query($h: String!) { collectionByHandle(handle: $h) { id } }`,
    { h: COLLECTION_HANDLE },
  );
  if (col.collectionByHandle) {
    const add = await admin<{ collectionAddProducts: { userErrors: UserError[] } }>(
      `mutation($id: ID!, $ids: [ID!]!) { collectionAddProducts(id: $id, productIds: $ids) { userErrors { field message } } }`,
      { id: col.collectionByHandle.id, ids: [id] },
    );
    check(add.collectionAddProducts, "collection");
  }
  console.log(`created ${HANDLE} as a DRAFT (${id}). Add its photos, check the price, set it Active in Shopify.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
