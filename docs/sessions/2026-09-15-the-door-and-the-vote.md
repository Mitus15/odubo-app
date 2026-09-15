# 2026-09-15 — the door, the vote, and deleting the unreachable

Branch `claude/loop-soul-the-room-b18a17`, which was opened for a feature
called "the room" and turned out to need no feature at all.

Full reasoning: [loop-the-door-and-the-vote.md](../decisions/loop-the-door-and-the-vote.md)

## Commits

| | |
|---|---|
| `456679e` | refactor(loop): delete Danceyokey, a whole feature nobody could reach |
| `04dc16b` | fix(loop): the room told people in it that they were not in it |
| `a86e900` | refactor(loop): move currentVoterId out of the anthem |
| `1bc4ae1` | refactor(loop): the front door was filed under the anthem |
| `31badb5` | refactor(loop): the magazine stops printing a section that never printed |
| `db1d24c` | perf(loop): stop loading a hidden module on every front-door hit |
| `ffee44f` | refactor(loop): delete the anthem tournament, keep what was never its own |
| `5b8f872` | docs(loop): write down why the codes exist and what was deleted |
| `0e0ecd0` | docs(loop): stop the surviving comments describing a deleted feature |
| `05762bd` | fix(loop): reconnect /loop/album to currentVoterId after the rebase |

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

## Rebased onto origin/main

Another session shipped four Loop commits the same day (the album pre-order
ledger, the recording notice, and a "your pass" vocabulary pass). This branch
was rebased onto them. Four conflicts, resolved as:

- **`danceyokey/route.ts`** and **`AnthemBracket.tsx`** — they had tweaked copy
  inside files this branch deletes. Both were unreachable code. Deletion stands.
- **`BallotSheet` / the ballots 403** — they changed the same line, "event code"
  → "your pass", but kept *"Voting is for the room"*, which is the contradiction
  this branch exists to remove. Took this branch's wording, which already uses
  their "pass-holder" vocabulary; adopted their capitalisation.
- **`PortalGate`** — **took theirs.** Their rewrite is a deliberate vocabulary
  pass that already drops the stale "the queue" this branch had patched, and
  does it better.

**The rebase then introduced a silent break that merged without a conflict:**
their new `/loop/album` page imports `currentVoterId` from `anthem-server`,
which this branch deleted. Nothing collided textually, so git was happy, and
`npm run build` was happy too. `tsc --noEmit` caught it as an 11th `TS2307`
against a baseline of 10. Everything above was re-verified after the rebase.

## Next

1. Delete the `/api/loop/anthem/redeem` shim next release.
2. Decide what the "In The Room" counter should say on an open-doors night: it
   counts pass sales, so it will read low while the room fills.
3. A manual pass over `/loop/admin` and `/loop/admin/posters` by the owner —
   the Poster Studio lost its Tournament piece, and nothing automated covers
   those screens.
