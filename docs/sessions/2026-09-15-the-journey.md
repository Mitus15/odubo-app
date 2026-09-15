# 2026-09-15 — the journey, in the order the owner said it

> Land on /loop, know there is a listening event and get a ticket. See you can
> listen to 1984. With a ticket, pre-order and hear a few more tracks before the
> night. Get your pass sorted. See the cover contest. Try the camera, take a
> cover, save it on the Wall.

That was the ask. This is what stood between the live site and it, and what
changed. Same branch as the morning's deletions (`claude/loop-soul-the-room-b18a17`).

## What was in the way

| Step | On production this morning | Now |
|---|---|---|
| Land, see the event | A **bare** visit (the Facebook link is bare) opened the four-screen 1984 takeover *first*; the date and the pass were two scrolls in | The poster, always. The single is one tap away. Only a gifted link (`?from=`) opens the song |
| Get a ticket | Fine | Unchanged |
| Hear 1984 | Fine (module) | Unchanged |
| Pre-order, hear more before the night | `/loop/album` was binary: nothing until the owner flips "released". A pass-holder was told *"It lands after the night"* | **Early tracks.** Owed listeners hear a chosen set now, the rest after. Default: the opening three. The owner changes it in admin, one tap per track |
| Get your pass sorted | `/loop/code` existed but the poster had no way to it; only the pass modal and the email linked it | **"Have a pass? · The record"** row under the pass button, to `/loop/code` and `/loop/album` |
| See the cover contest | Fine (module) | Unchanged |
| Camera → save on the Wall | Impossible before the night, twice over: the camera hid the Post button (`canPost` never passed) **and** the API refused any post unless `phase === "live"`. The contest copy said *"you decide afterwards whether it goes on the Wall"*, then there was no way to | Pass-holders post from the moment they buy. The API gate is `hasRoomAccess` (redeemed, or doors open) in any phase but archived. The poster gains a **The Wall** module for holders. Strangers are told plainly: *"Shooting is free. Putting it on the Wall takes a pass."* |

## The rule, extended

`decideAlbumAccess` gained one state. Pure, under test:

```
not owed              → prove
owed, released        → listen   (all 14, marks claimed)
owed, early tracks    → early    (the chosen set)
owed, nothing early   → wait
```

`album_early_tracks` in `loop_settings`: comma-separated track numbers. Never
set means `1,2,3`; set to empty means nothing until release. The admin's "The
Record" section shows all 14 as tap-to-toggle chips; they disable once the
record is out because they no longer apply.

## Verified

Gates: `tsc --noEmit` 851 / `TS2307` 10 (baseline); `npm test` **259 passed**
(+4: the early state, the not-owed case, the setting parser), same 3
pre-existing suite failures; eslint clean on all 12 touched files.

Against a dev server on the live database, **read-only** (no code redeemed, no
setting written):

- Bare `/loop`: the poster, with `HAVE A PASS? · THE RECORD` under the pass
  button. No overlay. No console errors.
- `/loop?from=test`: the single opens over the poster. Gift path intact.
- `POST /api/loop/gallery/post` as a stranger in phase `pre`: **403 "The Wall
  is for pass-holders. Enter your pass, or get one."** (was "The Wall opens
  during the event").
- `/loop/album` as a stranger: the prove state, linking `/loop/code`.
- Cover Contest module as a stranger: *"Shooting is free. Putting it on the
  Wall takes a pass."*

**Not verified end to end:** the holder's view of `/loop/album` (the early
player) and the holder's Post button. Both need a redeemed pass, which is a
write to production. The rule is unit-tested and the page compiles; the owner
can prove it in ten seconds with his own pass on the preview deployment.

## The email

Nothing needs a reply. Nine "New Customer / are you the store owner / can I
complete my order / bad experience review / commission" messages since the
13th are the standard Shopify store-owner scam wave: fresh Gmail accounts, no
order number, one of them cc'd to a different store entirely. Do not reply, do
not open attachments if any arrive. The eight "burst N" messages from
support@ are the owner's own inbox test from the 14th. Madison at Delta asked
"good to go for Facebook?" on the 14th; the owner answered yes on the 15th and
gave her `odubostudio.com/loop`, which resolves (308 to www, then the poster).
TRU Print has the flyer files and the poster counts. Nothing outstanding.

## Next

1. **The owner picks the early tracks** at `/loop/admin` → The Record. The
   default is tracks 1–3 (Welcome, 1984, Hallucinogen). If that is wrong, it is
   one tap per track to change, no deploy.
2. Prove the holder view on the preview with a real pass.
3. Merge. Production still opens the song takeover on every bare visit until
   this lands, and the Facebook event may already be live.

## The door (same day, later)

> They should also get a QR code ticket that I can scan at the door.

The guest side half-existed: `/loop/code` already drew a QR per pass, encoding
the bare code, captioned "show this at the door". There was no door.

**Built:**

- **The ticket.** The QR now encodes the door's own URL with the pass in it
  (`/loop/admin/door?c=LOOP-XXXX`, origin taken from the page, never typed).
  A scan from a plain camera app lands the host on the door page holding the
  pass. The same QR rides in the pass email as a PNG attachment, one per pass,
  so a buyer has the ticket without ever opening the site. `doorUrlFor` /
  `parseScannedCode` in `src/lib/loop/door.ts`, pure and tested, are the only
  place the ticket's shape lives.
- **The door.** `/loop/admin/door`, gated by the same middleware as the rest
  of admin. Rear camera, decoded in the page (native `BarcodeDetector` where
  the browser has it, `jsQR` where it does not — Safari does not). A clean
  scan **admits** the pass and says IN in green with a tone and a buzz; the
  same ticket again says ALREADY IN and the time, amber; a code that is not
  ours says NOT A PASS, red. Scanning never stops between guests. A pass
  arriving by URL or typed by hand is looked up first and admitted on a tap,
  because a page load must never admit anyone. A running count: heads in
  against real passes sold. Wake lock so the screen stays on.
- **The ledger.** Migration 162 adds `event_codes.admitted_at`, **applied to remote D1** and verified with `PRAGMA table_info`. Admission is
  its own act: a guest can be let in without opening the app, and open the app
  without reaching the door, so it does not reuse `redeemed_by`. `admitCode`
  is guarded (`WHERE admitted_at IS NULL`) so two phones at the door cannot
  both admit the same pass.

**Verified:** `tsc` at baseline (851 / 10); 268 tests pass (+4 for the
parser; `npm install jsqr` also refreshed node_modules and one of the two
`jose` suites now loads and passes); eslint clean. On a dev server:
`/loop/admin/door` 307s to the admin login, the API 401s without the cookie,
`/loop/code` compiles with the door URL in its chunk.

**Not verified:** the scanner itself with a real camera and a real ticket,
and an admission write. Both need the admin password on a phone. It is a
two-minute test on the preview: open `/loop/code`, prove a pass, then open
`/loop/admin/door` on a second phone and point it at the first.

## The first real sale arrived with no buyer (same night)

The owner bought a pass (#1001). The webhook minted the code, and then: no
pass email, no pre-order row, and `/loop/code` could not have found it. The
ledger row had `email: null`. Shopify's own Admin API, asked with the store's
token, returned `email`, `contact_email`, `phone` and `customer.email` all
null for a paid order. A checkout cannot complete without contact details, so
the data exists; **the app is not allowed to see it**. That is Shopify's
Protected Customer Data gate: until the custom app is granted access to
customer email, every webhook and every Admin API read arrives with the buyer
stripped out. Resend's log confirmed nothing was ever attempted.

**Only the owner can fix the cause**, in Shopify → Settings → Apps and sales
channels → Develop apps → the app → Configuration → Protected customer data
access → request Email (name/phone/address as wanted). Custom apps are
self-approved there.

**Built so the night survives either way:**

- `parseShopifyOrder` also reads `customer.email` (tested).
- The webhook logs a loud error and answers `reason: "no-email"` instead of
  minting silently into the void.
- Admin → Event codes shows a red box listing every paid pass with no
  address, with the Shopify path above and an **Attach & send pass** form per
  code: types the address off the order in Shopify, writes it to the ledger,
  writes the pre-order, and sends the pass email with the ticket QR. A search
  that lands on a pass with an address gets **Resend**.
- `attachEmail` in `event-codes.ts`; `POST /api/loop/admin/codes` gains
  `action: "attach" | "resend"`.

The owner's own pass is rescued by that button; nothing was written to the
ledger by hand.

## Shopify Basic will not hand over the buyer (the real cause)

The owner found it: Settings → Apps → App development → **Protected customer
data access** says *"API access to personally identifiable information (PII)
like customer names, addresses, emails, phone numbers is available on
Shopify, Advanced, and Plus plans"*, with an Upgrade button. The API confirms
`plan_name: basic`.

**So the earlier advice in this repo was wrong.** This is not a permission to
tick and custom apps do not self-approve it. On Basic, every webhook and every
Admin API read returns `email`, `contact_email`, `phone` and `customer` as
null, for a paid order, no matter which of the two custom apps is configured.

**What Basic DOES give us**, checked against the live store:

- `note_attributes` on an order: readable, not redacted (it is merchant data).
- `checkout[email]=` on a cart permalink **prefills Shopify's checkout email
  field** — verified by loading the real checkout and reading the input value.
- `attributes[...]` on the same permalink survives into the checkout URL.

**So the address is collected on our side and carried past the block:**

1. The pass sheet asks one question before checkout: *"Where should we send
   your pass?"* `POST /api/loop/pass/intent` records it (migration 163,
   `loop_pass_intents`) and returns the checkout link carrying
   `checkout[email]` and `attributes[loop_ref]=<token>`.
2. The buyer types it once. Shopify's checkout arrives prefilled.
3. The webhook reads `loop_ref` out of `note_attributes`, claims the intent,
   and has the address: code, pre-order, pass email and QR ticket all go out
   exactly as they would on a plan that shares emails.
4. If the reference never comes back, the intent row is still there with its
   timestamp. Admin → Event codes shows the unclaimed addresses as one-tap
   chips beside any pass with no address, so the manual path is a tap rather
   than a hunt through Shopify.

A failure anywhere in step 1 opens the plain checkout anyway: the sale is
never at the mercy of this.

**Also found:** the Facebook event went live at 15:53 the same day ("directing
people to your website"), so this was fixed with traffic already arriving. And
no *customer* order confirmation email for #1001 reached the owner's inbox,
only the merchant copy — either a different address was used at checkout or
Shopify's Order confirmation notification is off. Worth the owner checking.

## Your own list (same night, last)

> "I am the one bringing in this traffic after all."

The one-field consolidation already gave us the address. This makes it a
list the owner owns outright, and one he may legally write to.

- **Consent, opt-in.** A box under the address on the pass sheet: *"Keep me
  posted about Loop Soul. Optional, and you can stop it any time."* Off by
  default. Canada's anti-spam law wants express consent and a record of when
  and where; `loop_marketing_consent` (migration 164) is that record, keyed on
  the address, first tick wins, `withdrawn_at` for the day someone asks.
  Transactional mail (the pass, the album release) never needed it.
- **The Guests** in admin: passes sold, with an address, said keep me posted,
  through the door. Hairline rules, one drawn shape: **Export the list (CSV)**.
- `GET /api/loop/admin/guests` (JSON) and `?format=csv` (a file): one row per
  real pass with code, email, order, bought, opened the app, admitted,
  marketing consent, album claimed. `guestsCsv` / `csvCell` are pure and
  tested (RFC 4180 quoting).

Built from the ledger, the pass sheet and the door. Never from Shopify, so it
does not depend on a plan tier.

## Proven on a real sale

The owner bought a second pass through the new sheet, order `7088817537237`:

| UTC | |
|---|---|
| 22:20:13 | address typed on the pass sheet (`loop_pass_intents`) |
| 22:25:37 | order paid; webhook payload carried **no email**, as Basic always will |
| 22:25:37 | `loop_ref` found in `note_attributes`, intent claimed, code minted **with the address** |
| 22:25:38 | album pre-order written |
| 22:25:39 | Resend: "Your Loop Soul pass for Volume 1" **delivered**, QR ticket attached |

Two seconds, zero hands. This is the path every buyer now takes. It also
resolved the "missing" customer confirmation: the owner checked out as
`emorris508@gmail.com`, so Shopify's receipt went there. Nothing was off.

The first pass (`#1001`, bought before the fix) still has no address and is
the owner's to attach in Admin → Event codes.

## The ticket, several passes, and a draw

Four owner asks, late the same night.

1. **"The pass sucks… give them something to keep."** Every pass email now
   carries a rendered ticket PNG (1080×1620, Satori/`next/og`, brand face
   pinned into the bundle). Verified by rendering the owner's real pass and
   looking at it. Falls back to the bare QR if the render ever fails, so the
   email is never lost.
2. **Several passes on one order.** One numbered ticket each, *GUEST 2 OF 3*,
   forwardable, independent at the door. Previewable at
   `/api/loop/admin/ticket?c=CODE&n=2&of=3`.
3. **The early tracks.** The single free, plus two dealt per listener, never
   the intro and never a 35-second interlude. Proven over 400 simulated
   listeners: no intro, no interludes, stable per person, and across 300
   listeners every dealable track is reachable.
4. **The first pass got its address.** `emorris508@gmail.com` written to
   `shopify:7088745316565#1` directly in D1, since production admin is
   correctly password-locked and I do not hold that password. Both passes are
   now on one address and both are findable at `/loop/code`.

**A security check worth recording:** production `/api/loop/admin/login`
returns 401 to a junk password, so `LOOP_ADMIN_PASSWORD` is set on Vercel and
admin is locked. Locally it is unset, which puts the dev server in open mode
by design.
