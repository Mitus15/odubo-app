# 2026-10-08: the store, fixed for social traffic

The scheduled run of 2026-10-06 (`odubo-commerce-loop-fixes`) started, stalled
on an approval after 15 seconds and changed nothing. The owner said "go ahead"
on 2026-10-08, four days before the Billie Jean release week sends people to
the site, so this session did the fifteen code fixes of
`docs/audits/2026-10-05-commerce-loop.md` by hand, on branch
`claude/commerce-loop-fixes` from `origin/main` (43161461).

## Done (the audit's numbering)

1. The red "CLIPS PAGE DESKTOP TEST" banner is gone from `/clips`.
2. The store grid shows each piece's name under its photo, the price on the
   photo (`ProductBrowse.tsx`). The second, dead store (`MaisonModal`) was
   left alone: nothing can open it (`openMaison` has no caller that renders).
3. Sizes in size order everywhere: one helper, `src/lib/store/sizes.ts`
   (`sortProductOptions`, `sortSizes`, `isSizeOption`, `sizeRank`), applied
   where each surface maps Shopify's product: `lib/store/api.ts` (the grid and
   its product view), `QuickShopModal.tsx`, `store/product/[handle]/page.tsx`.
   Test `storeSizes.test.ts`.
4. After "Add to Bag" in the grid's product view, a "View Bag" button (with
   the count) stands beside "Add Another" and opens the cart panel.
5. The `/store` door: the store now opens when the access check answers, not
   on a 100 ms timer (`openStore()` was a no-op before `/api/store/status`
   replied, so on a slow phone `/store` sometimes opened nothing). Closing it
   goes to `/clips`, never to the gate on `/`, and only once something was
   actually open (a first version fired on mount and bounced every visit).
   The cookie banner sits at z-[160], above the store, so it can be answered
   there. `/` keeps its gate and verse.
6. "Slow connection detected": `OfflineIndicator.tsx` fired on `saveData`
   (Data Saver is a setting, common on phones) and on `downlink < 1`, which
   Chrome reports on fine connections while its estimate settles. Now only
   the browser's own verdict counts (`effectiveType` slow-2g or 2g).
7. "Made to order. Produced in 3-7 business days, then shipped." with a link
   to `/legal?tab=shipping`, one constant (`src/lib/store/madeToOrder.ts`),
   on the grid's product view, QuickShop and the product page.
8. One bag: `src/lib/store/bag.ts` is the only reader and writer of
   localStorage (`odubo_cart`); `useCart` reads through it and folds the old
   `cart` key in once (same variant: quantities add), then removes it. The
   product page, QuickShop and `/store/cart` add and edit through
   `useStore()` now, so the badge, the panel and the bag page agree at once.
   `OmniShopContext` (the dead store) no longer persists anything, so it
   cannot resurrect the old key. `CartOverlay.tsx:59` read `cart.currency`
   with no `cart` in scope; it reads the item's. Test `storeBag.test.ts`.
9. The phone clips feed has a shop button (`SingleVideoPlayer.tsx`, the
   right-hand rail above the platform links, 44 px) for clips with a
   product, through `useClipShop`. No public clip carries a product today
   (the staged Billie Jean clips #553-558 do, hidden), so it was verified by
   type and by reading, not on screen.
10. QuickShop defaults a size option to M, shows the chosen value on the
    closed header, strikes through sizes that cannot be bought with the other
    options as chosen, and never falls back to the first variant: a
    combination that does not exist disables Add ("Unavailable"). The grid's
    product view lost the same fallback.
11. "Free shipping on orders over $150" and "Ships from Canada" are gone from
    the product page; the made-to-order line stands there.
12. A checkout that fails says so in place ("Checkout didn't open. Your bag
    is safe; give it another try.") with the button turning into "Try again":
    the cart panel (`StoreContext.checkoutError`) and `/store/cart`. The
    `alert()` and the `myshopify.com/cart/...` permalink fallbacks are gone
    (the permalink dropped attribution and could land on the password page;
    no config holds the checkout domain, and domains are never hard-coded).
13. The bag empties after an order: `createCheckoutSession` returns the
    Shopify cart id, remembered under `odubo_checkout_cart`; on the next
    load `useCart` asks Shopify `cart(id:)` (`cartExists`), and only a clear
    "no longer exists" empties the bag. "Still open" or "could not tell"
    leave it alone.
14. The demo checkout page `/store/checkout` is deleted. `GET`/`POST
    /api/orders`, `/api/intel/commerce` and `/api/analytics/attribution`
    answer 401 without an admin session (`requireAdmin` first thing).
15. Checkout starts count: the cart panel fires `trackCheckoutStart` (it
    never did), and the funnel counts them. Caveat below.

## What was found on the way

- **`fan_activity`'s CHECK constraint (migration 068) has no
  `checkout_start`, `modal_open`, `modal_close`, `clip_milestone`...** The
  events route maps `modal_open`/`modal_close` straight through, so every
  store open on the live site makes `POST /api/analytics/events` fail with
  500 (seen in the dev server's log against the live database). Not fixed
  here (it is a table rebuild; SQLite cannot alter a CHECK). For checkout
  starts the route keeps storing `page_view` of `/store/checkout`, and the
  dashboard counts by that path. A migration widening the CHECK is the
  proper fix for all of them.
- The browser pane re-opens a tab at the site root when it re-applies a
  phone viewport, which looked like the app bouncing `/store` and `/clips`
  to `/`. Watched untouched for 15 s, both stay put.
- `tsc --noEmit`: 849 errors against the 850 baseline (one fixed, none
  added). The two failing jest suites predate this work (`emailTemplates`,
  `videos.get`). 56 new tests pass.

## Verified at phone size (375x812) on the worktree's dev server

`/store` opens the grid with names; the cookie banner shows over it and
answers; a tap on the Infinity Hoodie shows Color, Size S M L XL 2XL with M
chosen, the made-to-order line, Add to Bag; after it, "Added to Bag" and
"View Bag 1", badge 1. `/store/cart` shows that item. The product page
shows the same sizes in order, "View Cart" (the one bag), the made-to-order
line and no shipping claims; Add to Cart there makes the bag x2 under
`odubo_cart`, no `cart` key. `/clips` has no banner. `/api/orders`,
`/api/intel/commerce`, `/api/analytics/attribution` answer 401,
`/store/checkout` 404.

## Not done, by design (the audit's "not for this run")

The Shopify webhook does not read the cart's attribution; no admin screen
shows which clip sold what; GA gets no ecommerce events; analytics run before
consent; the dead second store should be removed in its own change.

## Owner's settings

Unchanged from the audit: one real clothing order end to end, Tapstitch
auto-pay, shipping rates, the two policies, the ToS name, Printify,
orders #1001/#1002, support@ receiving, one order email.

## Then: the landing (/links), same day

The owner: "upon landing, the user should see a link tree typa thing. This
should feature a product that's set as featured. then links to other
platforms and also a home button that brings people to the actual home page
(clips, words, etc)." Built before the deploy so the two ship together.

- `/links` (`src/app/links/page.tsx`, server-rendered) replaces the old page
  that only opened `LinkTreeModal`: the Danceman mark, the featured product
  (cut out, name, price, one drawn shape: Shop, to its product page), one row
  of platform marks in the page's own colour, `Home →` (to `/`, the clips and
  the words) and `Shop all`, an email line, Contact · Shipping & returns ·
  Privacy. No product or store link while the store is unpublished. The share
  image (og:image) is the featured product's photo.
- The featured product is one Shopify handle in `site_settings`
  (`featured_product`, `src/lib/featuredProduct.ts`), chosen in a picker at
  the top of /admin/linktree (`FeaturedProductPicker.tsx`,
  `/api/admin/featured-product`, admin only, refuses a handle Shopify does not
  return). Set to `infinity-hoodie` on 2026-10-08.
- No entrance animation: framer-motion renders `initial` into the server
  HTML, so the first version was invisible until scripts ran, a blank page in
  a slow in-app browser. Checked: no `opacity:0` in the HTML now.
- `PlatformIcon` moved out of `LinkTreeModal` into its own file with a `mono`
  option; `getActiveLinks()` moved into `src/lib/linktree.ts` (the API and the
  page share it).
- Found and fixed on the way:
  - the link tree counted clicks at `/api/linktree/<id>/click`, which does not
    exist (every `click_count` is 0); the handler is `POST /api/linktree/<id>`.
  - creating, editing and deleting links (`POST /api/linktree`, `PATCH`/
    `DELETE /api/linktree/<id>`) and listing every link
    (`/api/admin/linktree/all`) had no admin check: anyone could have pointed
    the landing's Instagram link anywhere. All gated with `requireAdmin` now
    (401 verified).
  - attribution: `initAttribution()` checked `getAttribution()`, which falls
    back to localStorage, so a returning visitor arriving from a TikTok bio
    link was recorded with their first-ever source ("direct") and the post
    that brought them back never counted. Now a visit takes its own source;
    one with none (typed URL) inherits the stored one. Test
    `attributionInit.test.ts`; verified in the browser (fresh visit with the
    TikTok link: source tiktok, landing /links, kept on the product page).

Verified at 375x812: the page as above; Shop goes to the Infinity Hoodie's
page with S M L XL 2XL. The admin picker was not clicked through (no admin
sign-in in the preview); its route answers 401 without one.
