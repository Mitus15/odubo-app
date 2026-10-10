# 2026-10-10: the worktrees consolidated, the finished work on one branch

The owner had opened too many worktrees. All 13 were removed (about 21 GB) after
every one was checked: committed work stays on its branch, and six worktrees that
held uncommitted work had it committed to their own branch first as
`wip(parked): ...`. Their 12 sessions were archived (restorable).

The finished work, which had waited on separate unmerged branches since
2026-10-02, is now one branch: `claude/ship-2026-10-10`, built on origin/main
43161461 and pushed. It fast-forwards onto main. Merging it to main is the deploy.

## In this branch

| Merged | What it does |
| --- | --- |
| `claude/commerce-loop-fixes` | the 15 store fixes for social traffic + the `/links` landing (2026-10-08) |
| `claude/moments-loop-business-model-2d4cbf` | The Foundation, the business plan decisions (docs) |
| `claude/arsenal-sync-fail-closed` | holds `unruffled-goldstine` (D1 misreads, 58 write routes gated) and `clever-pare` (45 read routes gated), plus Arsenal and three cron jobs failing closed |
| `claude/mystifying-cannon-149bb7` | the unreleased record at every door (audio gate: HLS, every key form) |
| `claude/gifted-matsumoto-a1f193` | the Stream webhook verifies Cloudflare's signature |
| `claude/mystifying-hugle-0cde7d` | hidden videos stay hidden in the video API; crop, bulk update, description gated |
| `claude/epic-joliot-d0eb9b` | adding tracks from the album screens uploads the audio; the explicit mark is kept |
| `claude/epic-faraday-f0a742` | debug note: the production DeepSeek key is broken |
| `claude/signs-of-life` | the album is Signs of Life (two records), `/signsoflife` address; D1 was already renamed live |

Conflicts, all the same shape: two sessions gated the same route. The store
fixes and the read sweep both gated `analytics/attribution`, `intel/commerce`,
`orders`, `linktree` and `linktree/[id]`; the sweep and the hidden-videos branch
both gated `videos/bulk-update`, `videos/crop`, `videos/description/generate`.
Kept one gate (`const gate = await requireAdmin(...)`) and both sides' notes.
`/api/tracks` POST keeps the D1 fix and the explicit mark, and its GET keeps the
unreleased-audio gate (a whole-file "take theirs" would have dropped it; caught
and rebuilt). The route guards needed two list changes: `POST /api/orders` is
locked now, and `GET /api/game/fly/audio/[slug]` (on main after the sweep
branched) is listed as public with the reason.

## Checked

- tsc: 850 errors on main, 849 here, none new (compared by file + message).
- `npm test`: 1241 of 1245 pass. The 4 failures: `emailTemplates` (logo path) and
  `videos.get` (fallback schema) fail identically on a clean origin/main; the
  two route guards were fixed (above) and pass.
- `npm run build` passes.
- Dev server at phone size: `/links` (featured Infinity Hoodie, Shop, platforms,
  Home), `/store` (15 items, names and prices), `/signsoflife` (lands on 1984,
  "from Signs of Life"), `/clips` (no debug banner).

## Left out on purpose

- `claude/billie-jean-gloss` (holds `album-performance-social-plan-4084d5`, the
  Vol. 1/2 split): open calls on the record titles before `split-volumes.ts`,
  and the `track.album_id` merge trap with the audio gate.
- `claude/stem-player-live-c8f826`: Safari/iPhone untested, the pack fix not
  published to R2.
- `claude/beautiful-curran-ad6154`: duplicates the security stack; only the
  leaderboard emails and a middleware backstop are new, to be rebuilt on top.
- `claude/infallible-morse-0d84ed`: the leaderboard/RSVP leak fix, parked
  uncommitted work never finished by its session.
- The parked `wip(parked)` branches and the September branches the night's
  cancellation made obsolete.

## After the deploy (the owner's)

- Set `CLOUDFLARE_STREAM_WEBHOOK_SECRET` in Vercel; until then production
  answers the Stream webhook with 500 (the old handler's writes never ran, so
  nothing is lost meanwhile).
- The production `DEEPSEEK_API_KEY` is still broken (see the debug note).
- Bio links become `/links?utm_source=...`.
- Still live and not fixed here: `POST /api/analytics/events` 500s on store
  events (`fan_activity` CHECK from migration 068 needs a table rebuild).
