# 2026-09-14: a ticket follows its owner

## The question

The owner, before letting the Facebook event go live: when someone buys a
ticket, do they own it? Can they always find it, on any phone? Can anyone in
the code, the back end, or the world take it away from them?

## What was true before

The code itself was durable: one per pass, written before any email, never
deleted or revoked by anything in production. But holding it was welded to the
first browser that used it. `redeem()` bound the code to one `ls_voter` cookie
for good; a second phone, a cleared Safari, or the flyer QR opening in
Instagram's browser first meant "already in use on another device" and no
room, no votes, no Legacy. The identity doc promised recovery by checkout
email (rung 4); the function existed (`bindDevice`) and had no callers, and the
error copy told people to do a thing that did not work.

Worse, `/loop/code` handed the raw pass code to anyone who typed the buyer's
email, with a button that bound it to the stranger's browser. Knowing an
address was enough to take a night. No admin path could give it back.

## What was built

**Migration 160**, `loop_email_verifications`: six-digit codes stored hashed
(sha256 of email, code and a pepper), fifteen-minute expiry, burned after five
wrong tries.

**`src/lib/loop/recovery.ts`**
- `createVerification` / `checkVerification`: the one-time code lifecycle.
- `planReclaim` (pure, under test): for every pass bought with the email, who
  holds it afterwards. Unredeemed passes come to this device. Passes on a device
  bound to the same attendee are the owner's other phone and are left alone.
  Passes on any other device are taken back, and that device loses holder
  status if it holds nothing else.
- `recoverForVerifiedOwner`: resolves the attendee who owns the email (claimed;
  else the unnamed record of the device that first redeemed; else this
  device's own, which takes the email), folds this device's stray record into
  it without dropping credits, cover choice, attendance or gift codes, binds
  the device, applies the plan, records attendance.

**API.** `POST /api/loop/pass/lookup` now sends the six digits and reveals
nothing; the response is identical whether or not a pass exists. New
`POST /api/loop/pass/verify` checks them and runs the recovery. Rate limits:
8 lookups per IP and 3 per address per 15 minutes; 12 verifies per IP.

**`/loop/code`** is two steps: email, then six digits. After that the page
says "This phone is yours now", shows each code as text and as a QR for the
door, and offers "Into the room".

**Also fixed on the way:** the pass email said "Out by 10:30"; it now says
"Out by 10", matching the 10pm licence hard stop set today.

## Verified

- 9 pure tests on the OTP and the reclaim rule; full suite otherwise unchanged
  (the same two pre-existing failures as `main`).
- Locally against the live database, with a seeded pass deliberately redeemed
  by a made-up stranger and given a holder row: email sent (mock outbox), a
  wrong code counted one attempt, the right code moved `redeemed_by` to this
  device, deleted the stranger's holder row, created the attendee with the
  email bound to this device, recorded attendance, and `/api/loop/gallery/list`
  answered 200 on this device. Fixture and every row it created were removed.

## Still true, and worth knowing

- The stranger's browser keeps whatever it did while it held the pass. The
  pass itself is back with the owner.
- Whether Resend sends the verification email in production depends on
  `EMAIL_MODE=live`, set on Vercel on 2026-08-11 per the memory notes. The
  owner's test purchase proves it.
- Apple Wallet is not built; that needs a pass-type certificate from the
  owner's Apple developer account. The QR plus a screenshot is the wallet for
  Volume 1.
