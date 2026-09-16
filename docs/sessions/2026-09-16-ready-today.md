# 2026-09-16 — Loop Soul, made shippable

The owner asked for the whole customer experience to be simplified and made
real: the pass journey was long-winded and, at one point, false. Four phases,
each committed and pushed to main and deployed.

## A. The journey (guest-facing)
- **The claim link** removes the OTP from the happy path. The pass email's
  button (`/loop/p/<token>`) binds the phone and lands on the record. One tap,
  was seven. Migration 165 (`loop_pass_links` + `event_codes.serial`), applied
  to remote D1. See `docs/decisions/loop-claim-link.md`.
- **Pass numbers.** Every real pass is `Nº 001`, `Nº 002`… on the ticket, in
  the email, at /loop/code. The owner's two passes read 1 and 2.
- **The emails.** The pass email went from 283 words / 7 headings of plain text
  to a designed sand-and-ink email: the ticket inline, the night in one line,
  one button, one instruction. Release email carries a claim link. The odubo
  order-confirmation webhook (`Your Odubo piece is on its way / Browse More
  Pieces`) now stands down for pass orders.
- **The pass sheet** went from ~450 words to the night in two lines and one
  promise; times read from the run of show, never a literal.
- **Naming.** "Volume 1" left every guest surface; the product is Loop Soul.
- **Design.** Poster module pills became hairline rows (one drawn shape, the
  pass button); the Cover sheet shows the cover and a Shoot button instead of
  three steps and a prize box; the record page uses the vault tokens; the
  live-room panels are rows; every em dash in guest copy is gone.
- **Shopify.** `scripts/shopify/loop-soul-pass-listing.ts` (npm run
  shopify:loop-pass) set the pass to "Loop Soul Pass", vendor "Odubo Studio",
  a one-line description and SEO. Applied. SKU, variant, handle, price
  untouched.

## B. Security — the JWT repair
`getUserFromRequest` decoded the JWT without verifying the signature; 142 files
called it, 94 routes outside /api/admin gated on it, all forgeable. It now
verifies with `jose.jwtVerify` (async); all 131 call sites await;
`decodeWithoutVerify` deleted. A bare await in a non-async function is a syntax
error, so tsc holding at baseline proves every call landed in async scope. A
forged unsigned admin token is rejected by the moments routes; a signed token
still passes. `src/__tests__/auth.test.ts` locks it.

## C. The customer inbox
Merged the finished `claude/shopify-customer-messaging-crm-0f1a53` branch (had
been sitting unmerged despite the owner's notes saying it shipped). Migration
renumbered 159 → 166 (159 was taken on main), applied; four `inbox_*` tables
verified. Its admin routes ride the now-verified JWT gate.

## D. The cover contest, made decidable
The contest advertised $50 with no way to name or pay a winner. Frozen results
(`loop_ballot_results`, migration 167), a declare action in the admin with the
contact for each shortlisted shot (refusing to declare a shot with no reachable
person), and `resolveCover` now reads the frozen winner first so the Single
shows it. Carried by hand from the unmerged contest branch onto the 2026-09-15
rewrites. Deferred: holding three covers per person (needs a table rebuild).

## Gates at close
- `tsc --noEmit`: 850 errors / 10 TS2307 — the pre-existing baseline, zero new.
- `npm test`: passing, plus the 2 pre-existing failures (emailTemplates,
  videos.get) that were red before this work.
- Migrations 165, 166, 167 applied to remote D1 and verified.
- Verified in a running dev server: the claim link binds and opens the draw;
  /loop/code shows the number and QR; the poster shows "Your record · Your
  ticket"; the ballot declare API refuses off-ballot options and flows the
  result to the guest; the contact form lands a thread.

## The owner's part
`docs/loop/owner-checklist.md` — the Shopify clicks, the real-purchase test,
the door test, 19+ on the artwork, the inbox DNS. None of it is code.
