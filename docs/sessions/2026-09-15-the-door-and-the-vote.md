# 2026-09-15 — the door, the vote, and deleting the unreachable

Branch `claude/loop-soul-the-room-b18a17`, which was opened for a feature
called "the room" and turned out to need no feature at all.

Full reasoning: [loop-the-door-and-the-vote.md](../decisions/loop-the-door-and-the-vote.md)

## Commits

| | |
|---|---|
| `109517b` | Delete Danceyokey (1,195 deletions) |
| `ec452b4` | Ballot copy: stop telling people in the room they are not in it |
| `84877ef` | Move `currentVoterId` out of the anthem |
| `c24e04a` | Move the redemption route out of `anthem/` |
| `fb78968` | Detach the Journal from the bracket |
| `bf6b951` | Stop loading a hidden module on every front-door hit |
| `cac5482` | Delete the anthem tournament (3,519 deletions) |

## Verification actually performed

Gates after every commit: `npm test` (251 passing at the end, down 2 because
the `tournamentSpec` suite was replaced by 3 direct tests of the rescued
helpers; same 3 pre-existing suite failures throughout) and `npx tsc --noEmit`
(851 errors / 10 `TS2307`, matching baseline).

Then a real dev server against D1, **read-only** — no code redeemed, no
`doors_open` toggled, because both would mutate production:

- `/loop`, `/loop/store`, `/loop/code`, `/loop/journal`, `/loop/pose`,
  `/loop/legacy` all 200, none mentioning Danceyokey or the anthem.
- `/api/loop/anthem`, `/api/loop/anthem/vote`, `/api/loop/danceyokey` → 404.
- `POST /api/loop/redeem` → 400 on a missing code, 404 on a bogus one. The old
  `/api/loop/anthem/redeem` shim returns identically.
- Phase `live`, no code: ballot API reports `open: true, canVote: false`, and
  the 403 reads "voting is for pass-holders. find your code at /loop/code".
- Browser: `/loop/legacy` renders **"STANDINGS ONLY. VOTING IS FOR
  PASS-HOLDERS."** with a **Find your code** link on both ballots; clicking it
  lands on the recovery page. No console errors.
- Portal with no code renders the gate, 250/250 capacity, the real programme
  (6:30 → 10:00), camera and Wall. No anthem or Danceyokey cards.

## Stale copy found along the way

Not planned for, but all of it was describing things that no longer exist:

- `PortalGate` promised a pass unlocks "the queue" — that was Danceyokey's.
  Now "the vote".
- The promoter **Playbook** still instructed the owner to run an 8-song
  bracket, and its rehearsal step said to "scroll to the anthem and nominate a
  song". Both rewritten around the tracklist and cover vote.
- The Journal's standfirst placeholder read *"Seventy-five people, one line,
  one anthem"* — wrong on the anthem, and wrong on the capacity, which is 250.

## Next

1. Delete the `/api/loop/anthem/redeem` shim next release.
2. Decide what the "In The Room" counter should say on an open-doors night: it
   counts pass sales, so it will read low while the room fills.
3. A manual pass over `/loop/admin` and `/loop/admin/posters` by the owner —
   the Poster Studio lost its Tournament piece, and nothing automated covers
   those screens.
