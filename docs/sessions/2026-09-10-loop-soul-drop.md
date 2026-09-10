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

---

## Same evening — the photos come off the white

Owner: "the product photos need cut-out backgrounds." The supplier renders sit on
flat white; on the sand poster and the near-black Odubo store a white square reads
as a card, which is exactly the bubble the design rules forbid. The cream hoodies
are within a few values of white, so a "remove white" pass would have eaten them.

**Tool:** `scripts/shopify/liftsubject.swift` — macOS Vision's
`VNGenerateForegroundInstanceMaskRequest` (the Photos "lift subject" engine),
mask applied with `CIBlendWithMask` onto transparent, RGBA PNG out. No model
download, no Python. `scripts/shopify/cutout-photos.ts <handle…> [--apply]`
compiles it on first run, downloads each image, cuts it out, re-uploads with the
same alt text, position and **variant links** (REST `POST /products/{id}/images`
with `variant_ids` — `write_products` is the only media scope this token has),
and only then deletes the original, so a failure half-way leaves more photos,
never fewer. Work files go to `.cutouts/` (gitignored).

Reviewed every edge on sand and on dark before applying — no halo on the
white-on-white hoodie seams. Verified after from the Storefront: 10/10 images
`png` with alpha reaching 0, alt text intact, every variant linked to its colour.

Originals and cut-outs archived outside the repo at
`~/Documents/Loop-soul-the-entertainment-room/tapstitch-2026-09-photos/`
(`original/`, `cutout/`, a contact sheet, a README). Shopify's CDN copies of the
originals are gone with the delete — that folder is the only copy.

Code: `PiecesRail` and the `LoopStore` grid no longer paint a tint behind the
image and use `object-contain`, so the garment sits on the field like everything
else. `AddToBagSheet`/`LoopBag` thumbnails were left as they were.

---

## Same evening, part three — the whole catalogue comes off the white, and the pieces get their own light

Owner: cut out the B.A.A.D pieces too, and instead of a tinted square behind
each garment, "a branded glow around the perimeter… as if emerging from the
screen."

### The other eleven garments

All 46 remaining B.A.A.D images cut out with the same tool. Three hardenings
were needed before it could be trusted on a catalogue rather than four files:

- **It reports coverage now.** `liftsubject.swift` prints the fraction of the
  frame the subject occupies, and the runner refuses anything outside 3–92% —
  a cut that ate the garment or removed nothing never reaches Shopify.
- **A failure no longer kills the run, or half-cuts a product.** An image that
  cannot be cut is reported and skipped, and a product is left entirely alone
  unless *every* one of its photos cut cleanly. No garment ends up half
  transparent and half white.
- **Already-transparent photos are left alone** (PNG colour type 6/4), so
  re-running does not churn the ids of pieces already done. The four Loop
  pieces were correctly skipped.

**The white-on-white case.** The Wordmark Spray Tee in White is a pure white
garment on a pure white ground, and Vision does not consider it a subject at
all — the one image the guard refused. Measuring it showed the body is
240,240,250 against a flat 255, so there *is* signal, just not where a subject
detector looks. `liftsubject` now retries with the near-white range
(0.90–1.00) stretched across the full scale; the stretch is used **only to find
the mask**, which is then applied to the untouched original. It cut at 0.620
coverage, in line with its siblings. `--vendor="B.A.A.D"` also added, so the
run is one command.

Every one of the 46 was reviewed on sand and on near-black before applying —
the black pieces are where a bad matte shows a white fringe, and none did.
Verified after: **56 of 56** garment images transparent, **0** missing alt
text, **141 of 141** variants still linked to an image.

### The glow

`.piece` in `globals.css`. The cut-outs are what make it possible: `drop-shadow`
traces the **alpha**, so the light follows the shoulder line and the hem rather
than ringing a box. Two layers, because one reads as a sticker — a tight halo
rimming the garment, and a wider ambient falling beneath it. Hover widens and
brightens the halo while the piece rises, so coming forward reads as stepping
out of the surface. `.piece-sm` tightens the radius for thumbnails, and
`.piece-still` takes the lift off large heroes. Reduced motion drops the
movement and keeps the light.

The tokens are per-surface because the grounds are opposites: the sand field is
already light, so depth does the lifting and the halo only rims; the studio's
near-black takes the sand itself as a rim light, which is what finally makes
the black B.A.A.D pieces visible there at all — they used to disappear into the
tinted tile behind them.

Applied on the Loop rail and shelf, the add-to-bag sheet, the bag, the studio
grid (`ProductBrowse`, the one actually mounted at `/store`), its detail view,
the QuickShop modal and the product page hero. Tinted tiles and card borders
removed at each — including the shelf's `rounded-xl border bg-ink/[0.03]`,
which the cut-outs made redundant and the design language rejects anyway.
`object-cover` became `object-contain` everywhere a product renders, since
cropping a cut-out clips the garment.

**Two traps worth recording.** A tile with `overflow-hidden` clips the halo
into a hard rectangle — the tinted square back again, just inverted; every
product tile had to stop clipping. And a halo radius fixed in pixels floods a
small tile: at 12px on an 82px thumbnail the bloom fills the square. Hence
`.piece-sm`.

Checked at 390 and at desktop: base glow, hover (halo 13px → 22px, piece lifts
5px), the sheet, the bag, `/loop`, `/loop/store`, `/store` and
`/store/product/script-tee`.

**Cache notes, neither a bug:** `getShopifyProduct` holds `revalidate: 60`, so
product pages served the pre-swap image for a minute. And a bag saved before
the swap keeps the old image URL in `loop_soul_cart` until that line is
removed — the store has never had an order, so no customer is holding one.

---

## Same evening, part four — the glow calmed, the hub's dead ends closed, the masthead rebuilt

### The resting glow was too strong on the dark store

Owner's call, and right: at 0.4 alpha the halo read as an effect applied to
every tile rather than as light. Resting halo is now **0.17 at 11px**; the
brightness moved to hover (0.6, ×1.7 radius), where it is a response to the
viewer instead of a constant. The black B.A.A.D pieces still separate from the
near-black page, which is the only job the resting light has.

### Navigation — two real faults

- **`/loop/pose` was a dead end.** No nav, no mark, not a single `<a>` on the
  page. It is reached from the Cover Contest, which is reached from a flyer's
  QR, so a phone can land there with **no back stack at all** and no way home.
  It now carries `HubNav` like every other public Loop page.
- **The store hung off one conditional link.** `/loop/store` was linked from
  exactly one place — the Pieces rail — which renders nothing when the shelf is
  empty or the Shopify call fails (`.catch(() => null)`). A shop that vanishes
  with its stock is a shop nobody can find their way back to. `HubNav` now
  carries **Store** beside Legacy, so it is reachable from every inner page
  regardless of what Shopify returns.

Audited the rest: `/loop/journal`, `/loop/legacy` and `/loop/code` all have a
way back, and every public route is reachable from the front door.

### The masthead

Owner: "the album by mani is awkward with the loop soul."

Diagnosis, by comparing the page against the printed flyer: the page had the
**parts** of the poster's masthead but not its **structure**. The wordmark was
pinned hard right at 116px while the credit was centred beneath it — two
objects on two axes, so the eye went right then jumped back to the middle. And
the mark was the *smaller* element, which inverted the hierarchy: the byline
looked like the headline, and the record's own name looked like a logo parked
in a corner. On the flyer the mark anchors top-left and the credit gets its own
centred band with real air between them, which is why it works there.

Three options were rendered at phone width with the real assets and the owner
picked **one centred lockup**: the mark, larger and centred, with the credit
hung directly beneath it. Loop Soul *is* the album's name, so the mark is the
title and the credit is its byline — a sleeve, not a letterhead. The credit
keeps the printed treatment exactly (Jost 500, one wide-tracked run, the
feature at about two thirds beneath), so page and flyer still state the record
identically, and the name is **stated, not shouted** — the poster rule holds.

The mark is sized as a share of the column (`47%`, capped 196px, floored 136px)
so it holds its proportion from a 320px phone to the 448px cap, and it was
trimmed until the dancers below still read as a crowd: at 54% the figure fell
to 143px, at 47% it holds 164px on a 390×844 and the page is still one screen.

Come Dance stays off the page (owner): the slogan is an invitation, never the
headline, and the album credit is the centrepiece.
