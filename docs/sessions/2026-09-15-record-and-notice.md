# 2026-09-15: the record is delivered, the notice tells the truth, debit explained

## What the owner asked, as a customer and as the host

Five questions before letting the Facebook event go live: what is "the room",
what does registration closing mean and what if I cannot come but want the
album, can we really promise to keep people out of shot, what is all this
about a code, and why is my debit card refused in Apple Pay.

## What was found

- **The album was a promise with no ledger.** Pass sheet, Shopify listing and
  the confirmation email all called the pass a pre-order and said the record
  is "yours when it lands". No table, no flag, no route. Meanwhile the album
  page at `/music/albums/<id>` is public and ungated, so nothing was exclusive
  to deliver either.
- **"We will keep you out of shot" was unkeepable.** The room is filmed all
  evening, guests shoot each other through the filter, and a featured Wall
  shot is public. The owner's call: coming in is the agreement, full stop.
- **One object had four names.** "event code" 16 times, "your code" 8, "pass
  code" 2, "entry code" 1, plus "pass", "Portal" and "room". Not yet changed;
  see below.
- **Debit.** Shopify's online checkout in Canada takes Visa, Mastercard, Amex
  and Discover, in a wallet or typed. It does not take Interac online, for
  any store. The owner's own client card was refused in Apple Pay for exactly
  this reason. Visa Debit and Debit Mastercard work. PayPal is on. The door
  takes $5.
- **The pass image's alt text still said September 26** at checkout. The
  admin token has no `write_files`, so this is the owner's to fix in Shopify.
- **Refund policy 404s**, though `/legal` already says a pass is not
  refundable but transferable, and refunded in full if the night is cancelled.

## What was built

**Migration 161**, `loop_album_entitlements`: one row per pass unit, unique
on the order id so a webhook retry cannot grant twice, keyed on the lowercased
email so the same inbox proof that recovers a pass opens the record.

**`src/lib/loop/album.ts`**: `grantAlbumForOrder` (never throws; the money
path is not at its mercy), `backfillFromCodes`, `isEntitled`, `albumReleased`
(a `loop_settings` switch the owner flips, nothing derives it from a date),
`albumAccessFor`, the pure `decideAlbumAccess`, `loadAlbum`.

**The pass webhook** writes the ledger row beside each minted code.

**`/loop/album`**: four states from one rule. Owed and not out: "It's yours.
It lands after the night", with the address it is recorded under. Owed and
out: the full `AlbumPlayer`, all 14 tracks, and the ledger marks it claimed.
Not proven: "The record is for people who pre-ordered it", with the same
That's me path as `/loop/code`. Holders of a redeemed pass count as owed too.

**Admin**: a "The Record" section with counts (pre-orders, inboxes, told,
listened), the release switch, "Tell N by email" (one email per inbox, once,
`sendAlbumReleaseEmail`), and Backfill.

**The notice**, rewritten as a condition of entry in `content.ts`, the pass
sheet, the confirmation email and both `/legal` tabs. The Shopify product
description was updated to match, and now also states what cards work.

**The pass sheet's payment line** names what works and what does not, and
tells anyone refused that PayPal works or the door takes $5.

## Verified

- Type-check and lint clean on every touched file; 13 tests pass (`loopAlbum`,
  `loopRecovery`); the same two pre-existing failures as `main`.
- On the preview against the live database, with a seeded simulated pass and
  pre-order under the owner's address: unproven device saw "prove"; after the
  six-digit recovery the page said "It's yours. It lands after the night.
  Pre-order recorded under maniodubo@gmail.com"; with the switch flipped it
  played all fourteen tracks and set `claimed_at`. Switch reset to not out,
  every fixture row removed.

## Not done, and why

- **The four names for the code.** A rename touches sixteen places and the
  email; it deserves its own pass with the owner choosing the word.
- **The public album page.** `/music/albums/<id>` still serves the draft to
  anyone with the URL. Gating it changes the whole music library's behaviour
  and is a separate decision.
- **Apple Wallet** still needs a pass certificate from the owner's Apple
  developer account.
