# The Faceless Hoodie replaces the Infinity Zip Hoodie

**2026-09-17** · Shopify only, plus the filer that writes it.

## What the owner asked

"Remove the infinity zip hoodie. Just added a new product to replace it."

## What was actually in Shopify

The new piece was there, imported that afternoon, and it was the real thing:
**Sunfaded Edge Fleece Hoodie** `sunfaded-edge-fleece-hoodie-1`, $75, Washed
Black, the ∞ small on the chest and **the Faceless mask across the back**.

It was also still raw, the way every Tapstitch import arrives: vendor `ODMPOD`,
no tags, no product type, no SEO, empty alt text, supplier boilerplate copy
("perfect for custom printing and bulk orders. Match it with sweatpants
#RK0005"), and published to the Online Store channel only. **The headless site
could not see it at all** — the same hole found and closed on 2026-09-10.

A second copy was sitting there too: `sunfaded-edge-fleece-hoodie` (no `-1`),
imported 2026-09-10 at **$70**, identical images, equally unfiled. Left alone it
would have become a second, cheaper Faceless Hoodie the moment anything
published it.

No garment has ever sold. The only two orders in the store are passes.

## Decisions (owner, this session)

- The Infinity Zip Hoodie is **archived**, not deleted. It leaves every sales
  channel and the `loop-soul` collection; the product, its cut-out photos and
  its written size guide stay in Shopify and come back in one click.
- The new piece is named **Faceless Hoodie** `faceless-hoodie` — named for what
  is on the back, in the same register as Script Tee and Barrel Jeans, and it
  ties the garment to The Faceless.

## What changed

`scripts/shopify/loop-soul-drop.ts` — the house filer — grew the other half of
its job. It could only ever put pieces ON the shelf; now it also takes them off:

- `RETIRED`: handles to unpublish from every channel, remove from the
  `loop-soul` collection, and archive. Idempotent, and never deletes anything.
  A handle that no longer exists is skipped rather than throwing.
- `MANIFEST`: the zip hoodie entry swapped for the Faceless Hoodie.

So the drop is now a list the shelf follows, not a one-time import.

Then, in Shopify (`npm run shopify:loop-drop -- --apply`):

| Piece | Result |
| --- | --- |
| Infinity Zip Hoodie | archived, off 6 channels, out of `loop-soul` |
| Sunfaded Edge Fleece Hoodie (Sept 10, $70) | archived, off Online Store |
| Faceless Hoodie | renamed, retitled, vendor B.A.A.D, Tops · Hoodies, house copy + rebuilt size guide, SEO, `brand:baad` `drop:loop-soul` `type:hoodie`, joined `loop-soul`, published to all 6 channels, alt text on both images |

Photos were then cut out (`scripts/shopify/cutout-photos.ts faceless-hoodie
--apply`, macOS Vision), both at 0.659 coverage, so the garment sits on the sand
with nothing painted behind it like the other three. Originals kept in
`.cutouts/faceless-hoodie/*.original.png`, and the archived Sept 10 duplicate
still holds its own copy in Shopify.

## Verified through the Storefront API

Not the Admin API — the endpoint the site itself reads:

```
Collection "Loop Soul":
 1. Loop Soul Pass    $5    2. Faceless Hoodie  $75
 3. Script Tee        $30   4. Infinity Hoodie  $70   5. Barrel Jeans $80

infinity-zip-hoodie         → null
sunfaded-edge-fleece-hoodie → null
faceless-hoodie             → Faceless Hoodie
```

The Pieces rail on the /loop poster takes `slice(0, 4)` **after** the pass is
filtered out (`GatheringHome.tsx:69`), so all four garments still show. Had the
zip hoodie stayed, the fifth piece would have fallen off the rail silently.

## Still open, not ours

The pass image's alt text still reads "Saturday September 26" — the night moved
to **Sat Oct 10**. That is the owner's artwork to re-export.
