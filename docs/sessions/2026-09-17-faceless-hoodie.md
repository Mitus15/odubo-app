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

## The pass image said the wrong night — fixed

Filed at first as "the owner's artwork to re-export", which was wrong twice
over. It was not only the alt text: **SAT SEPTEMBER 26 was baked into the
pixels** of the square the buyer looks at while paying, and the night is Sat
Oct 10. And it was never the owner's to re-export — this repo renders that
exact file.

`src/lib/loop/poster/volumes.ts` already derives the printed date from the event
record (`MOCK_CURRENT_EVENT.date`, 2026-10-10), so the engine had been correct
since the night moved. The PNG in Shopify was simply a render taken before it.
Exactly the drift the file's own header warns about: "the date has already moved
twice, and a piece that disagrees with the front door about the night cannot be
corrected once it is out."

    npx tsx --env-file=.env.local scripts/loop/poster-kit.ts --pieces=pass

Byte-for-byte the same artwork, one line different. Uploaded new-then-delete so
the product was never imageless, alt text rewritten to the real night, and the
superseded render archived outside the repo at
`~/Documents/Loop-soul-the-entertainment-room/superseded-2026-09/`.

Verified through the Storefront API and by reading the pixels back off the CDN:
the served 2000×2000 square reads **SAT OCTOBER 10 · DOORS 6:30 · ALBUM AT 8**.
(The file hash differs from the local render because Shopify re-encodes PNGs on
upload.)

`docs/loop/owner-checklist.md` item 4 asked the owner to hand-edit that alt
text; it is now marked done, minus the one part still theirs — unpublishing the
pass from the Meta and Microsoft channels.

## The pass came off Meta and Microsoft — and the API lied twice doing it

Item 4's leftover. It should have been one mutation. It took four, because both
the read and the write were wrong in the same direction:

**The read.** `resourcePublicationsV2` does not report app-owned channels.
Asked about the pass it answered *Online Store · Headless · Headless 02* — three
channels, confidently. `resourcePublications` (no V2) on the same product, the
same second, answered *Microsoft Copilot · Online Store · Headless · Headless 02
· Meta*. The first version of this fix read V2, printed "Already off both.
Nothing to do", and would have closed the task having changed nothing.

**The write.** `publishableUnpublish` on those two publications returns HTTP
200, `userErrors: []`, and **no change** — its own response payload comes back
still saying `isPublished: true`. Not a race with the channel's auto-sync; a
silent no-op. (`REST DELETE /product_listings` at least fails honestly:
`403 requires merchant approval for write_product_listings`.)

What works: **`publicationUpdate(id: <publication>, input: { publishablesToRemove: [<product>] })`**.

Verified with `resourcePublications(onlyPublished: false)` so an unpublished row
could not hide by absence:

```
Loop Soul Pass — every publication row, published or not:
  ON    Online Store
  ON    Odubo Studio Headless
  ON    Odubo Studio Headless 02
```

Still `availableForSale: true` at $5 through the Storefront API.

**The filer now checks instead of assuming.** `retire()` reads the non-V2 field
back after archiving and throws, naming the channels, if anything is still
published. Archiving *does* clear Meta and Microsoft today — both retired
hoodies verify clean — but the script no longer takes its own log's word for it.

⚠️ The merch is still on Meta and Microsoft, deliberately. Only the pass was
ever meant to be off the shopping feeds: it is admission to one night in one
room, not a product for a stranger's ad feed.