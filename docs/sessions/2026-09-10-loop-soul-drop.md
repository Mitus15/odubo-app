# 2026-09-10 — The Loop Soul drop lands: four garments filed, a shelf on the front door

## What arrived

Four Tapstitch pieces were imported into Shopify on Sept 10, raw: vendor `ODMPOD`,
no tags, no category, no SEO, empty alt text, supplier copy ("optimized for DTG and
DTF… Dropshipping and Print-on-Demand collections"), a 1024px inline-styled size
table. Only the jeans had been put in the `loop-soul` collection.

**The hole that mattered:** all four were published to the *Online Store* channel
only — not to either *Odubo Studio Headless* publication. The Storefront API could
not see them, so even the jeans in the collection never reached `/loop/store`
(measured before: collection → the pass alone; catalogue → 12). A product the
headless site cannot read is a product that does not exist.

## Decisions (owner)

- **Filing:** B.A.A.D makes the clothes the project wears. Vendor `B.A.A.D`, tags
  `brand:baad` · `drop:loop-soul` · `type:<garment>`, in the `loop-soul` collection.
  Loop Soul is a drop under the label, like Catching Light. Never `loop-pass` — that
  tag is admission, and it is what keeps a product *out* of the Odubo store.
- **Names:** mark-led, like Emblem Hoodie / Wordmark Spray Tee.
- **Where the mini-store goes:** the production single-screen poster on `main`, not
  the unmerged playbill branch (`claude/loop-soul-hub-overview-a5ac87`).

| Was | Now | Type · category | Price |
|---|---|---|---|
| Unisex Heavyweight Slim Fit T-Shirt | **Script Tee** `script-tee` | Tops · T-Shirts | $30 |
| Curved Panel Raglan Hoodie | **Infinity Hoodie** `infinity-hoodie` | Tops · Hoodies | $70 |
| Heavyweight Raglan Sleeve Zip Hoodie | **Infinity Zip Hoodie** `infinity-zip-hoodie` | Tops · Hoodies | $60 |
| Men's Vintage Wash Barrel Leg Jeans | **Barrel Jeans** `barrel-jeans` | Bottoms · Jeans | $80 |

Prices, variants, SKUs and option values untouched.

## Done in Shopify — `scripts/shopify/loop-soul-drop.ts` (`npm run shopify:loop-drop`)

A committed, re-runnable script this time (the Sept 4 clean-up was ad hoc). Dry run
by default, `--apply` writes; every step compares before it writes; a backup of the
products as found is at `docs/shopify/backup-2026-09-10-loop-soul-drop.json`.

Per piece: `productUpdate` (title, handle with `redirectNewHandle`, vendor, type,
category, SEO, description) → `tagsAdd` (add only, never replace) →
`publishablePublish` to every channel the reference garment (Manteau de Vin) is on
→ alt text on every image, colour derived from the variant-linked image (linked =
front of that colour, the unlinked one after it = back).

Descriptions are the house shape (one billing line about the piece, the care
sentence, a semantic size guide with `in / cm` in one cell), rebuilt from the
supplier's own numbers, so `ProductPageClient` renders a real table and
`ProductDetailFeed.parseDescriptionHtml` still finds care + size.

Setting a real category also put the pieces into the `clothes` smart collection, so
the Odubo store's clothes shelf carries them with no further work.

**Verified after (Storefront API):** `collection(handle:"loop-soul")` → the pass +
four handles; catalogue 12 → **16**; Odubo store (`tag_not:loop-pass`) → **15**.

### Three gotchas

- **The script bit itself on the second run.** It rebuilt the size guide from the
  *live* description, which after the first apply was already the house table —
  the parser saw a header with no supplier rows and wrote an **empty-body table**
  to the Script Tee. Fixed: a description already in house form is left alone,
  otherwise the guide is rebuilt from the backup taken on the first run; and
  descriptions are compared with whitespace collapsed, because Shopify
  re-serialises stored HTML. Proven with dry run → apply → dry run: the third
  run changes nothing.

- `fileUpdate` (the GraphQL way to set image alt) needs `write_files`, which this
  token does not have. The REST images endpoint
  (`PUT /products/{id}/images/{image_id}.json`) needs only `write_products` and does
  the same job — that is what the script uses.
- Introspection on 2024-07 does not list `collectionAddProductsV2` or
  `productUpdateMedia` for this token; `ProductInput.collectionsToJoin` joins the
  collection inside `productUpdate` instead.

## Done in code — the Pieces rail

- **`src/components/loop/store/PiecesRail.tsx`** (new) — four square thumbnails,
  image only, price beneath; eyebrow `PIECES` on a hairline; right-hand line is
  `THE STORE →` (`/loop/store`) until the bag has something, then `BAG · n`. Taps
  open the same `AddToBagSheet` and `LoopBag` the store uses, over the same
  `loop_soul_cart`, so a bag started on the poster is the bag found on the shelf.
  Type and a hairline only — the pass button stays the one drawn shape.
- **`GatheringHome.tsx`** — fetches the `loop-soul` collection with the same call
  and the same `.catch(() => null)` as `/loop/store` (a Shopify outage must not
  take the front door down), drops the pass by tag, passes the first four.
- **`GatheringPoster.tsx`** — mounts the rail between *What's included* and the
  module buttons: the sell comes before the navigation. The column is now
  `min-h-[100dvh]` with a `min-h-[140px]` floor on the figure: on a 390×844 the
  poster is still one screen (figure 208px); on a 375×667 the rail would have
  crushed the figure to 35px, so instead the poster grows ~105px past the fold and
  the root `<main>` scrolls it.

Checked in the browser at both sizes: rail renders all four with the new alt text;
tile → sheet (Coffee/Apricot, S–2XL) → Add to bag → bag drawer shows `Script Tee ·
Apricot / S · $30.00 CAD`, rail flips to `BAG · 1`; `/loop/store` lists the four
under *Pieces*; `/store/product/script-tee` carries the SEO description, the
`B.A.A.D by Odubo Studio` lockup and a real `<table>`.

## Not done / worth knowing

- **Handle renames:** `redirectNewHandle` was sent with each rename. Whether Shopify
  created the redirects is invisible to this token (no navigation scope); the old
  handles were one day old and never reachable from the headless site, so nothing
  is lost either way.
- The size order in `AddToBagSheet` reads `M L XL 2XL S` for the tee — pre-existing
  behaviour of the sheet, not the data (Shopify has S–2XL in order).
- `docs/decisions/brand-architecture.md` and `src/lib/brand/lines.ts`, referenced in
  the Sept 5 memory, exist on no branch in this repo. The tag namespace
  (`brand:` / `drop:` / `type:`) is real in Shopify and is what this session used.
- Two unrelated suites fail in this worktree (`videos.get`, `emailTemplates`) —
  see the check against the main checkout in the session transcript.
- The `.env.local` copy and `node_modules` symlink in this worktree are untracked
  conveniences (both gitignored). `.claude/launch.json` gained `loop-pieces-preview`
  on port 3114 because 3112 belonged to another session.
