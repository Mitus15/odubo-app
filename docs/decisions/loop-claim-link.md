# The claim link: why an email link may bind a device

**2026-09-16.**

## The problem
The pass email told a buyer: "Open /loop/album and enter this email address."
The link carried no token. So `/loop/album` saw an unbound device and rendered
"The record is for people who pre-ordered it" — the opposite of what the email
said. The real path was: type your email on /loop/code, wait for six digits by
email, type them back. **Seven taps and two emails, right after paying.**

## The decision
The link in the pass email now binds the device that opens it, with nothing to
type. The route `/loop/p/<token>` looks the token up, holds the pass on that
device, and redirects to the record.

The security argument is that **the email is proof of the inbox, and that is
the same proof the six digits give.** /loop/code sends six digits to the
checkout address and binds the device that types them back; possession of the
inbox is the whole proof. A link mailed to that same inbox proves the same
thing by the same logic. On another phone, the code on the ticket does the same
binding (`POST /api/loop/pass/enter`): the code IS the login, same trust as a
paper ticket. The six-digit OTP that used to live at /loop/code was removed the
same day (owner: a second login for people who had just been given one).
"Lost your ticket?" resends the pass email and shows nothing on screen.

## What makes it safe
- **The token is 32 random bytes, stored only as a peppered SHA-256 hash**
  (`loop_pass_links`, migration 165). A leaked table is useless; the plaintext
  exists in one email.
- **Take, not redeem.** A single-pass order runs `recoverForVerifiedOwner` (the
  same reclaim the six digits run). A multi-pass order moves ONE code per link
  with `takeCode`, which sets `redeemed_by` unconditionally. This is deliberate:
  mail scanners (Outlook SafeLinks and the like) GET links before the buyer
  does, and a buyer who opens Guest 2's link before forwarding it would
  otherwise dead-end their friend. Taking is idempotent and drops the previous
  holder only if it holds nothing else.
- **Only unit #1 claims the email.** In a multi-pass order, `shopify:<id>#1` is
  the buyer's own ticket. Only that link may write the checkout address onto the
  device's attendee. A friend's phone opening a forwarded Guest 2 link must not
  claim the buyer's address: `loop_attendees.email` is unique, so the buyer
  could then never own it, and a later six-digit proof would merge the buyer
  INTO the friend.
- **Anonymous never binds.** The middleware mints `ls_voter` on the same
  request; if it is still anonymous the page shows "expired" rather than
  binding nothing to nobody.
- **A resend revokes the old links.** `deliverPassEmail` mints fresh links and
  deletes the previous rows, so the email a host resends is the only one that
  works.

## The pass number
Every real pass also gets a running number per event (`serial`, migration 165),
rendered `Nº 042`. It is the human identity of the ticket; `LOOP-XXXX` shrinks
to a line under the QR. Simulated purchases (`sim:` orders) never take a number,
so the count on the tickets is the count of real people. `Nº` is a capital N
plus U+00BA, never U+2116, which Jost cannot draw.

See also `docs/sessions/2026-09-16-ready-today.md`.
