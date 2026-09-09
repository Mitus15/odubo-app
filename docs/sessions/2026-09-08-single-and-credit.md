# 2026-09-08 — the single ships, and the credit promise gets fixed

**18 days to Sept 26.** Started with the owner overwhelmed and unable to name a
task; ended with the single live behind the flyer's QR, the paper corrected, and
the contest's credit promise made true.

## Shipped (merged to main)

| Commit | What |
|---|---|
| `a825e3e` | QR caption → SCAN FOR THE SINGLE; **flyer bleed** (was print-only, so the piece that actually goes to a shop had none) |
| `52b803b` | Feature credit `WITH AMEN THE DJ` under the record line; own field, own slot in the air budget |
| `efc393e` | **The single behind the QR** + the gift chain (migration 157) |
| `c84d2ae` | Consent modal → bottom bar; cut the "4:54 of your day" price line; playing state; footer copy |
| `ae80ac1` | The cover is **fluid** — his version, the room picks the official one |
| `05879ea` | **80s dress code**; honest pass copy; print-matched headline; `Play 1984` |
| `48cd97a` | Single as **three snap screens**; player split out; **vinyl scrub** |
| `42d2bc2` | **Credit every shot**; one author everywhere |

## The two findings that mattered

**A cookie wall stood in front of the song.** Every first-time visitor — every
stranger scanning the flyer — hit a full-screen blurred consent modal before
reaching anything. Now a dismissible bottom bar.

**The contest's credit promise was not true.** `gallery/post` resolved the
author with `attendeeForVoter`, and attendee records are only minted on code
redemption. On a doors-open night a guest could post to the Wall and **no
credit row would ever be written** — and royalties are paid on that record. The
people most likely to lose credit were the ones who never bought a code. Now
`ensureAttendee`, guarded on `"anonymous"`.

Related: the ballot titled options from the typed name while the Journal used
the durable record, so one photo could be credited two ways. `CREDIT_JOIN` /
`CREDIT_EXPR` in `lib/loop/identity` are now the single source.

## Verified, not assumed

- Audio: `readyState 4`, 294s, plays unauthenticated; magic bytes `ftyp M4A`.
- Scrub: tap at 3 o'clock → 73.5s of 294 (exactly 25%); quarter-turn drag →
  147.0s (50%); anticlockwise past twelve from 3% → clamps to 0:00, no wrap.
- Player isolation: 5s of playback → **25 mutations in the player, 0 in the doors**.
- Headline: 316px at 375 wide; clamps to 12.8px at 320 wide (270px inside 280px).
- Credit join against prod D1: no credit row → typed name; credit row →
  attendee name. Test rows removed.
- Gift chain: repeat visitor counted once; unknown code degrades to the song.

## Known state / gotchas

- **Deploy of `42d2bc2` had not appeared in production when the session ended**
  — `/loop` was still serving `Hear the Single`. The Vercel CLI token here is
  invalid (`vercel ls` → "The specified token is not valid"), so build status
  could not be checked. **First thing next session: confirm the deploy landed
  or find the failed build.**
- One local build printed `Failed to collect page data for /account`; it did not
  reproduce on two subsequent runs. Transient, but worth knowing if Vercel fails.
- Pre-existing test failures, unchanged by this work: `emailTemplates`,
  `videos.get`, `deliveryFieldMap` (verified identical with the work stashed).
- Pre-existing tsc errors: sentry configs, `src/_archived/**`, and
  `loopPosterLayout.test.ts:50` (`volume` not on `EventDetails`).
- `pass_webhook_secret` is unset in D1 and `SHOPIFY_ADMIN_API_SECRET` is
  reportedly missing from Vercel prod → **a real $5 order may mint no code and
  the webhook returns 200 anyway.** Unverified. This is the highest-risk
  unknown before the 26th.

## Next session (plan: `~/.claude/plans/plan-first-wise-hamming.md`)

S3 — P2.3–P2.6 and P3:
- Migration 158: `loop_cover_choices`, `loop_gift_codes.attendee_id`
- `official_cover:<eventId>` setting + admin action; `resolveCover()` precedence
  mine → official → owner, failing loud
- `ClaimRow` ("this is me") — first name + email, no password, wiring the
  already-built `POST /api/loop/me` which nothing calls
- Clothing: link `/loop/store` (built, unreachable), pre-order copy, and a
  bundle as **one two-line checkout** (pass variant + garment) so the pass line
  keeps SKU `LOOP-PASS-VOL1` and the webhook still mints the code

## Owner's list, unchanged

1. Order the flyers (bleed files, `~/Documents/Loop-soul-the-entertainment-room/print-2026-09-flyers/`)
2. Text Amen about his billing on the poster
3. Add the garments to the `loop-soul` Shopify collection (blocks bundles)
4. The invitations — still the thing that fills the room
