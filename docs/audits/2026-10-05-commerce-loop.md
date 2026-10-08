# The commerce loop, audited (2026-10-05)

The owner's goal: someone sees the Odubo logo on TikTok, Instagram or YouTube,
comes to the site, finds well-presented clothes, orders without trouble and
receives them, and the loop sustains itself profitably with little supervision.

This file is the fix list. The scheduled run on 2026-10-06 reads it and does
the **Code fixes**; the **Owner's settings** are his to change in Shopify and
elsewhere (the admin token cannot reach them).

Live site: `https://www.odubostudio.com` (`odubostudio.com` redirects there;
`odubo.studio` does not resolve). Checkout: `shop.odubostudio.com`.

## Walked live (phone size, 375x812), 2026-10-05

What works, end to end:
- Product page `/store/product/infinity-hoodie` loads directly: two photos,
  "B.A.A.D by Odubo Studio", price in CAD. A good bio-link target.
- Add to bag, the bag (item, size, subtotal), Checkout.
- Shopify checkout titled "Odubo Studio": Shop Pay, PayPal, cards; ships
  worldwide; shipping methods appear after the address.
- The site's own policies at `/legal?tab=shipping` (and privacy, terms).

What hurts a stranger arriving from social:
1. **A debug banner is live on `/clips`**: a red bar reading "CLIPS PAGE
   DESKTOP TEST - CAN YOU SEE THIS?" (`src/app/clips/page.tsx`, the block under
   `{/* DEBUG: Big red text top of clips page */}`), there since 2026-05-04
   (commit 672a2d63).
2. **The front door is a gate.** `/` shows a "Slow connection detected"
   warning, a scripture verse (on this visit Psalms 22:15, "...into the dust of
   death"), a timestamp, the cookie banner, then "Enter the Studio". Two taps
   before any clothes. (The verse and the gate are the owner's design: do not
   remove them; give social traffic a door that skips them, see fixes.)
3. **The store grid shows prices, not names** (15 items, cut-out photos on
   black). A shopper cannot tell what a piece is without opening it.
4. **Sizes are out of order** on the product view: M, L, XL, 2XL, S.
5. **No way forward after "Add to Bag"**: the button turns into "Add Another";
   nothing offers Checkout or the bag. The shopper has to find the bag icon.
6. `/clips` opens on unrelated footage ("Aether", waves) rather than the newest
   piece; the feed order is random or seeded.

## Code fixes (the scheduled run does these)

Work in the main checkout. The owner has uncommitted brand files in
`public/brand-logos/` and `public/posters/loop_soul/`: never stage, commit,
move or delete them; add only the files you change.

1. Delete the debug banner block from `src/app/clips/page.tsx`.
2. Store grid: show each product's name with its price (the store door is
   `StoreOrchestrator` → `src/components/store/ProductBrowse.tsx`; the store is
   built twice, so check `src/components/shop/MaisonModal.tsx` too and keep the
   two consistent). Keep the look: small, quiet type under the photo.
3. Sizes in size order everywhere a product's sizes are listed (XXS, XS, S, M,
   L, XL, 2XL/XXL, 3XL...; anything unknown keeps its place after these): the
   product view opened from the grid, QuickShop (`src/components/shop/QuickShopModal.tsx`)
   and the product page (`src/app/store/product/...`). One shared helper, not
   three copies.
4. After a piece is added to the bag, offer the way forward: a clear "Checkout"
   (or "View Bag") action beside or in place of "Add Another", in the same
   visual language. QuickShop's "Go to Bag" pattern is the precedent.
5. A door for social traffic that skips the gate. The code audit found
   `/store` already skips the intro and opens the store (`src/app/store/page.tsx`,
   `HomePageClient` with `defaultModal="store"`), so verify that at phone size
   with storage cleared, and fix two things around it: closing the store there
   does `router.replace('/')` and drops the visitor onto the intro
   (`HomePageClient.tsx` ~224-234): send them to the clips or keep them in the
   store instead; and the cookie banner (`GDPRConsent.tsx`, z-40) is hidden
   under the store (z-100) on `/store`: it must be visible and answerable
   there. The home page `/` keeps its gate and verse exactly as they are.
6. The "Slow connection detected" warning: find what shows it. If it fires on
   ordinary phone connections or emulation, make it show only when the
   connection is genuinely poor, or drop it from the store and product pages.
   Report what you found either way.
7. Say it is made to order, where the buyer decides. Nothing on a product says
   so today (no Shopify description mentions it); only the site's legal page
   does (`src/app/legal/page.server.tsx`, the `shipping` tab: produced on demand
   by Tapstitch, 3-7 business days to produce, then shipping; all sales final
   except damaged or defective). Add one quiet line near Add to Bag on every
   product view (the grid's product view, QuickShop, the product page), for
   example "Made to order. Ships in 3-7 business days." linking to
   `/legal?tab=shipping`. One shared constant, worded from that policy; do not
   invent new promises.

### From the code audit (2026-10-05): the buying path, in priority order

The code audit (read-only, main checkout) found these. Do them after 1-7, in
this order; each one small and verified on its own. If time or a check fails,
stop at a clean, verified point and report what is left rather than shipping
half a change.

8. **One bag, not two.** The product page, QuickShop and `/store/cart` keep
   the bag under localStorage `'cart'` (`ProductPageClient.tsx` ~145-151,
   `QuickShopModal.tsx` ~151/168, `CartPageClient.tsx`); the store grid, its
   cart panel and the logo badge use `'odubo_cart'` (`src/hooks/useCart.ts:6`,
   `StoreContext.tsx`). Add on the product page, tap "Back to Shop", and the
   bag looks empty. Make every surface read and write one key through one
   module, and merge whatever a visitor already has under the other key into
   it once (same variant: add the quantities), so no bag is lost. Fix the
   latent `cart.currency` reference in `CartOverlay.tsx:59` while there.
9. **Shop buttons on the phone clips feed.** The engine stages every piece as a
   clip that opens its product (`videos.shopify_product_handle`), but the
   mobile feed (`ClipsFeed`, `SingleVideoPlayer`, `PosterCard`) has no shop
   button at all; only desktop does (`DesktopClipsGallery.tsx` ~345-359,
   `CinematicModal.tsx` ~288-300). Add one to the mobile feed for clips that
   have a product, through the existing `src/hooks/useClipShop.ts` (it opens
   QuickShop and records the tap), placed in the thumb zone and clear of the
   platform-style controls, 44px or more.
10. **The right size, every time, in QuickShop.** It defaults each option to
    its first value (often XS, `QuickShopModal.tsx` ~115-121), shows only the
    option's name on the collapsed section header so the chosen size is
    invisible (~312-319), and silently falls back to the first variant when a
    combination does not exist (`|| product.variants[0]`, ~140; the grid's
    product view does the same, `ProductDetailFeed.tsx` ~354). Show the chosen
    value in the header, default to M when there is one (as the grid's view
    does), and never add a variant the visitor did not choose: disable Add when
    the combination does not exist or is sold out, and mark sold-out sizes
    (the product page already strikes them through).
11. **Remove claims nothing backs.** The product page hard-codes "Free shipping
    on orders over $150" and "Ships from Canada"
    (`ProductPageClient.tsx` ~307-308). Shopify's rates are unknown and
    Tapstitch makes and ships the clothes, so neither is known to be true.
    Remove both (the made-to-order line from fix 7 replaces them).
12. **A checkout that fails, fails kindly.** The grid's cart panel shows only
    `alert('Failed to create checkout…')` (`StoreContext.tsx` ~331);
    `/store/cart` falls back to a `odubostudio.myshopify.com/cart/<id>:<qty>`
    link (`CartPageClient.tsx` ~121-137) that drops attribution and can hit
    the Shopify password page. Replace both with an in-place message and a
    "Try again" in the site's style; if a fallback link stays, build it on
    `shop.odubostudio.com`.
13. **The bag empties after a purchase.** Nothing clears either bag after a
    Shopify order, which invites a second order. Remember the Shopify cart id
    created at checkout; when the visitor comes back and that cart no longer
    exists (Storefront `cart(id:)` returns null once an order completes it),
    clear the bag. Do not clear it merely because checkout was started.
14. **Close the customer-data hole.** `GET /api/orders` returns
    `SELECT * FROM orders` (names, emails, addresses) with no authentication
    (`src/app/api/orders/route.ts` ~6-13; live it returns 200 and the table is
    empty today). The only writer is a leftover demo checkout,
    `src/app/store/checkout/page.tsx` ("This is a demo checkout. No payment
    will be processed.", unlinked but live at `/store/checkout`, collecting
    name, email and address). Delete the demo page and gate the route with
    `requireAdmin` first thing in the handler (the repo's rule: gate on an
    admin session, never on a header's presence). Gate
    `/api/intel/commerce` and `/api/analytics/attribution` the same way (they
    expose revenue). If tests named routeWriteAuth/routeReadAuth exist on main,
    keep them passing.
15. **Count checkout starts.** `/api/analytics/events` stores a checkout start
    as a page view (`events/route.ts` ~157) while the admin funnel counts the
    `checkout_start` type (`dashboard/route.ts` ~394), so checkout starts
    always read 0. Store it as `checkout_start`. Also fire `trackCheckoutStart`
    from the grid's cart panel checkout (`StoreContext.checkout`), which never
    does.

Not for this run (noted for later): the Shopify webhook does not read the
cart's attribution attributes (only the 05:00 UTC daily sync does; migration
169's `commerce_orders.source` column IS applied, checked live); no admin
screen shows which clip sold what (`/api/analytics/attribution` has the
numbers); GA gets no ecommerce events (helpers exist, never called, USD
hard-coded); site analytics and fingerprinting run before cookie consent; the
dead second store (`MaisonModal`, `CartModal`, `StorePageClient`) should be
removed in its own change; possible duplicate order emails (see owner item 9).

## Owner's settings (not code; listed in the run's report)

From the Shopify operations audit, 2026-10-05 (read-only; the admin token
cannot see shipping, locations, markets or policies, so these are his).

What is already solid: Shopify Payments with Shop Pay, Apple Pay and Google
Pay (two real sales went through on 2026-09-15); 15 clothing products, all 140
sizes and colours for sale, each with photos, a real description, a Tapstitch
SKU and a weight, published to the site's two Headless channels; every piece's
stock sits at the Tapstitch location (ODMPOD), which accepts orders and sends
tracking back; the store ships to 237 countries; the shop is named "Odubo
Studio".

His checklist, most important first:
1. **Run one real clothing order end to end.** No order has ever contained
   clothing (the only two are $5 passes), so Shopify → Tapstitch → tracking has
   never run. Buy one inexpensive piece to his own address, then refund it in
   Shopify after it ships if he likes.
2. **Tapstitch auto-pay.** Tapstitch makes an order only once his Tapstitch
   account pays for it. In the Tapstitch dashboard: a card on file and
   automatic payment/fulfilment on, or every order waits for him.
3. **Shipping rates.** Shopify → Settings → Shipping and delivery: check the
   profile holding the Tapstitch location has rates for Canada, the US and the
   rest of the world. An address with no rate cannot check out. (Or add the
   `read_shipping` and `read_locations` scopes to the "integration" app so this
   can be audited.)
4. **Refund and shipping policies.** Shopify → Settings → Policies: both
   return 404 though checkout links to them. The words already exist on the
   site (`/legal?tab=shipping`): paste them in. Add contact information too.
5. **Terms of service** still say "B.A.A.D by Odubo": regenerate or edit them.
6. **Printify** is installed with no products: uninstall it so no product is
   ever routed to it by mistake.
7. **The two $5 pass orders** (#1001, #1002) have sat unfulfilled for 20 days:
   mark them fulfilled.
8. **Support email receiving** (from the customer inbox build): Resend →
   Domains → odubostudio.com → enable receiving and add its MX record; Resend →
   Webhooks → `https://odubostudio.com/api/webhooks/resend/inbound`. Until then
   customer replies to support@ go nowhere.
9. **One order email, not two.** The app sends its own "Order Confirmed"
   email through Resend (`/api/shopify/webhooks/orders`) and Shopify sends
   its own if its notification is on, so a buyer may get two. Choose one:
   Shopify's (it also sends the shipping email with Tapstitch's tracking) is
   the simpler loop; say so and the app's can be switched off.

## Bio link

**From 2026-10-08: `https://www.odubostudio.com/links?utm_source=instagram&utm_medium=social&utm_campaign=bio`**
(swap `instagram` for `tiktok` or `youtube`). `/links` is now the landing: the
featured product (set in /admin/linktree), Shop, the platforms, Home, Shop all.
The older advice below stands as the fallback.


`https://www.odubostudio.com/store/product/infinity-hoodie?utm_source=instagram&utm_medium=social&utm_campaign=bio`
(swap `instagram` for `tiktok` or `youtube`): the piece in the current video,
no intro, one tap to the bag. In-app browsers usually send no referrer, so the
UTM tags are how an order is traced back to the platform. For the whole store:
`https://www.odubostudio.com/store?utm_source=...`. Avoid `/` (the gate) and
`/clips` (until fixes 1 and 9 ship).

## Done 2026-10-08

The scheduled run of 2026-10-06 stalled on an approval and changed nothing;
the owner said "go ahead" on 2026-10-08 and the fifteen code fixes above were
done by hand on `claude/commerce-loop-fixes`, verified at phone size, and
merged. The account of each, what was found on the way (the `fan_activity`
CHECK constraint that fails every `modal_open` event with a 500, untouched
here), and the proof: `docs/sessions/2026-10-08-commerce-loop-fixes.md`.
Decisions: `docs/decisions/commerce-loop.md`. The owner's settings stand as
listed; none of them is code.
