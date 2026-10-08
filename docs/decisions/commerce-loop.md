# The commerce loop: decisions (2026-10-08)

Why the store is built the way it is after the 2026-10-05 audit
(`docs/audits/2026-10-05-commerce-loop.md`) and the fixes of 2026-10-08
(`docs/sessions/2026-10-08-commerce-loop-fixes.md`). The loop: someone sees
the Odubo logo on TikTok, Instagram or YouTube, lands on the site, finds the
clothes, orders without trouble, receives them.

## One bag, through one module

Two bags had grown: the grid, its cart panel and the logo badge under
`odubo_cart` (the `useCart` hook, rich items), and the product page, QuickShop
and `/store/cart` under `cart` (a thin `{ variantId, qty, title, price }`).
Add from a product page, go back to the shop, and the bag looked empty.

Decision: `src/lib/store/bag.ts` is the only code that touches storage, and
every surface adds, edits and reads through `useStore()` (the StoreProvider's
`useCart`). Alternatives: keep two keys and sync them (two writers, forever
drifting), or pick the thin format (loses the image, the handle and the
variant's name the panel shows). The rich format won; the old key is folded
in once at load (quantities add) and removed, so nobody's bag is lost by the
change. `useCart.addToCart` takes only what the bag keeps of a variant, so
surfaces with their own product shapes can add without building a full
`ProductVariant`.

The second store (`OmniShopContext`, `MaisonModal`, `CartModal`) is
unreachable and is due for removal in its own change; until then it persists
nothing, so it cannot write the old key back.

## The bag empties after an order, not after a click

Nothing cleared the bag after a Shopify order, which invites a second order.
Clearing on "Checkout" would lose the bag of anyone who backs out of
checkout. Decision: remember the Shopify cart id made at checkout
(`createCheckoutSession`), and on the next load ask Shopify whether that cart
still exists; a completed cart does not. Only a clear "no" empties the bag;
"still open" or "could not tell" (offline, a bad answer) leave it alone.

## A failed checkout fails in place

The panel said `alert('Failed to create checkout…')`; the bag page bounced
to `odubostudio.myshopify.com/cart/<id>:<qty>`, which drops the attribution
attributes and can land on the shop's password page. Decision: say it in
place, keep the bag, turn the button into "Try again". No permalink fallback:
no config holds the checkout domain, and domains are never hard-coded here.

## The /store door

Social traffic must reach the clothes without the home page's gate and
verse, which stay exactly as they are on `/`. `/store` opens the store over
the clips; three things were wrong around it:

- it opened on a 100 ms timer, and `openStore()` is a no-op until the access
  check answers, so on a slow phone it sometimes opened nothing. Now it opens
  when `isStoreAccessible` turns true, once.
- closing it did `router.replace('/')`, the gate. Now `/clips`, the room
  behind the store, and only once something was actually open (an effect
  that fires on mount, when nothing is open yet, bounces every visit; that
  was the first version, caught in the preview).
- the cookie banner (z-40) sat under the store (z-100, footer z-115, bag
  z-121, details z-151). It is z-[160] now: above the store, under the link
  tree and the music player, so it can be answered where social traffic
  lands.

## Say only what the policy says

"Free shipping on orders over $150" and "Ships from Canada" were on the
product page with nothing behind them (the rates are Shopify's and unknown;
the clothes are made and shipped by the fulfilment partner). The one line
every product view now says is worded from the site's own shipping policy and
links to it: `src/lib/store/madeToOrder.ts`. Change the policy first, then
the constant.

## Sizes in size order, once

Shopify returns option values in variant-creation order (M, L, XL, 2XL, S).
One helper (`src/lib/store/sizes.ts`) sorts a size option where each surface
maps the product, so the order is fixed in three places by one function, not
three copies. Unknown values keep their place after the known sizes. QuickShop
defaults to M and never falls back to the first variant: a combination that
is not made is nothing to add, not somebody else's size.

## The funnel's checkout starts, and the CHECK constraint

`fan_activity.activity_type` has a CHECK (migration 068) that lists no
`checkout_start`, and no `modal_open`/`modal_close` either, though the events
route maps those straight through: on the live site every store open makes
`POST /api/analytics/events` fail with 500. SQLite cannot alter a CHECK; it
is a table rebuild. Decision for now: a checkout start stays a `page_view` of
`/store/checkout` (the path `trackCheckoutStart` sends; no page lives there
since the demo checkout was deleted) and the dashboard counts by that path.
A migration widening the CHECK is the proper fix for all of them.

## "Slow connection" is the browser's verdict only

`saveData` is a setting (Data Saver, common on phones), not a slow line, and
Chrome reports `downlink < 1` on fine connections while its estimate settles.
Either put "Slow connection detected" over the store for visitors whose
connection was fine. Only `effectiveType` slow-2g or 2g counts now.

## The landing: /links, the piece first (2026-10-08)

The bio link lands on `/links`, not on `/` (the gate and the verse stay the
home page's own) and not on a product page (which tells a stranger nothing
about the rest). The page: the featured product with one drawn shape (Shop),
the platforms as one row of marks, then the way into the site (Home, Shop
all). Alternatives: the old link tree (an icon grid in boxes, no product, its
store tile opening the store over a black page), or a full storefront (too
much for a first tap).

- The featured product is a setting (`site_settings.featured_product`), not
  code and not a Shopify tag: it changes with each release, from a picker in
  the admin the owner already uses for the links. Alternatives: a `linktree`
  row with a 'product' platform (the live link tree would have shown it as a
  blank icon before the deploy), a Shopify tag (another admin to visit).
- Server-rendered with no entrance animation, so the first paint in an
  in-app browser is the page. The marks are one colour: five platform
  colours would outshout the piece.
- It extends the existing link tree (same table, same admin, the shared
  `PlatformIcon` and `getActiveLinks`); the in-app modal stays for the Share
  menu.
