# 2026-09-15 — the whole day, consolidated

Twenty-two commits, all on `main` (`8662b8b`), all deployed and verified in
production. **118 files, +3,769 / −5,133.** The net is negative because the day
started by deleting more than it later added.

It began as "what is 'the room' in Loop Soul?" and ended with a working ticket
in the owner's pocket.

---

## The arc

**1. "The room" needed nothing built.** It was already the product's metaphor
and already implemented twice, as `hasRoomAccess` / doors / `InRoom`. The real
question underneath was the owner's: *why do codes exist, and has this been
overcomplicated?*

**2. It had been.** 3,520 lines were two complete features behind hardcoded
`false` — the anthem tournament and Danceyokey. Deleted. Three things filed
under the anthem were **not** the anthem and had to be rescued first:
`currentVoterId` (identity for all of `/loop`, 20 importers), the `ls_voter`
cookie minter, and the redemption route, which is the front door.

**3. The journey was rebuilt in the owner's order**: land → know there is a
night → ticket → hear 1984 → pre-order and hear more → sort the pass → cover
contest → camera → save on the Wall. Four of those seven steps were broken.

**4. Then the first real sale exposed the platform.** Shopify **Basic** never
gives an app the buyer's email — it is a plan tier, not a permission, and the
advice this repo gave about it was wrong. Fixed by collecting the address
ourselves and carrying it past the block, prefilling Shopify's own checkout so
nobody types it twice.

**5. The rest of the night was the owner reading his own product as a customer**
and finding what no test could.

---

## What exists now that did not this morning

| | |
|---|---|
| **The door** | `/loop/admin/door` scans a ticket, admits once, counts heads. Migration 162 |
| **The ticket** | A rendered PNG per pass, numbered *GUEST 2 OF 3*, in every pass email |
| **Pass delivery** | One field → prefilled checkout → address recovered from `note_attributes`. Migration 163 |
| **The guest list** | Opt-in consent + CSV export, owned outright. Migration 164 |
| **Early listening** | The single free, plus two dealt per listener, performed as a reveal |
| **Privacy** | The sales figure no longer leaves the server |
| **The release** | One sentence instead of three paragraphs |

---

## Four bugs found by looking rather than testing

Every one of these was green under the test suite.

1. **`Number(null)` is `0`, not `NaN`.** `album_early_extra` is unset in
   production, so the early rule resolved to "deal nobody anything".
2. **The free-track fallback handed out the intro** — the one track the rule
   exists to exclude — because `featured_track` is also unset.
   *Together these two would have given every buyer one song, the intro.*
3. **`AnimatePresence mode="wait"`** played a full exit before each entrance,
   leaving over a second of dead black between acts of the draw.
4. **`EMAIL_MODE` defaults to `mock`**, and the mock returns `ok: true`. A
   resend reported `"delivered": true` for an email that never left the
   machine. Caught only by checking the provider's own log afterwards.

The pattern: read the output, watch the animation, check the receipt. The
owner's own "I'm confused, do I have to scavenger hunt?" was worth more than
the suite that night.

---

## Rules this day established

- **`npm run build` cannot verify a deletion here.** `ignoreBuildErrors: true`
  plus `--no-lint`. Use `tsc --noEmit` against a baseline and a dev server.
- **Never drop a Loop table on name alone.** The table called `ballots` is the
  dead anthem's; the live Volume 1 votes are in `candidate_upvotes`.
- **Shopify Basic will never hand over a buyer's email.** Not a permission.
- **A success flag from a mock is a lie.** `delivered: true` meant nothing.

---

## State at close

- `main` = branch = worktree = `8662b8b`, tree clean, no stashes.
- Gates: `tsc` **850 / 10** (started at 855 / 10); **294 tests passing**, with
  the same 2 pre-existing failures that were red before today
  (`emailTemplates`, `videos.get`).
- Production: 11 guest routes 200, 9 admin surfaces 307/401, deleted routes
  404, capacity private, front door answering.
- Migrations 162, 163 and 164 applied to remote D1 and verified. All
  verification rows deleted.
- 2 passes sold, both the owner's, both on `emorris508@gmail.com`, both
  ticketed.

## The one thing never tested against real hardware

The door scanner, with a real camera on a real ticket. Open a ticket on one
phone and `/loop/admin/door` on another. Green **IN ✓** and the night is ready.
