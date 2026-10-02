# 2026-10-02: the Arsenal audit, and four jobs that failed open

Branch `claude/arsenal-sync-fail-closed`, stacked on `claude/clever-pare-7d5cfb` (which sits on `claude/unruffled-goldstine-331edc`). Committed locally. **Not pushed, merged or deployed.**

## The Arsenal audit

The six routes flagged as having "no auth" were `reorder`, `update`, `woda`, `sync-from-stream`, `videos` and `link-parent`. **All six were already fixed on `claude/unruffled-goldstine-331edc` and `claude/clever-pare-7d5cfb`**, neither merged:
- Four of them had only checked that some `Authorization: Bearer` header was present, which is no check at all.
- Each now opens with `requireAdmin`.
- `videos` and `release-order` GET are gated as reads.

This pass read every handler under `src/app/api/arsenal` on that branch:

| Route | Gate on clever-pare | Verdict |
|---|---|---|
| `deploy`, `multipart-upload`, `stream-to-r2`, `upload`, `upload-poster`, `feed-order` PUT, `release-order` PUT | `getUserFromRequest` + `isAdminUser` | Closed. `getUserFromRequest` verifies the signature since 2026-10-02. |
| `link-parent`, `reorder`, `update`, `woda`, `sync-from-stream`, `videos`, `release-order` GET | `requireAdmin` first | Closed |
| `transcode`, `transcode/[job_id]` | `verifyUserFromRequest` + `user.is_admin` | Closed. It is stricter than `isAdminUser`: it ignores `ADMIN_EMAILS`. |
| `process-stream-downloads` | `x-cron-secret` only when it matches a set secret, else admin | Closed |
| `feed-order` GET | none | Public by design. It returns only live public clips, and the read guard lists it. |
| **`sync` GET** | **`if (cronSecret && header !== ...)`** | **Open wherever `CRON_SECRET` is unset.** Fixed here. |

## Failing open

`GET /api/arsenal/sync` checked the cron secret **only when one was set**. `vercel env ls` shows `CRON_SECRET` exists in **Production only**. On every Preview deployment, which gets the live D1 credentials, anyone could run the whole sync:
- flip parent videos and their clips to `is_public = 1, publication_status = 'live'`
- schedule Instagram posters through Post for Me

Production is closed today only because the variable happens to be set there.

The same shape appeared in three cron jobs:
- `/api/cron/email-sequences`: sends the Day 3 and Day 7 welcome emails
- `/api/cron/cleanup-uploads`: aborts R2 multipart uploads and deletes expired galleries
- `/api/cron/social-sync`: drives `process-scheduled`

`/api/cron/sync-shopify` already failed closed and needed no change.

### Fix
- All four GETs now open with `requireCronOrAdmin`. It accepts `Bearer $CRON_SECRET` when the secret is set, otherwise an admin session, and nothing else. Vercel Cron in Production behaves exactly as before.
- `POST /api/arsenal/sync`, the Arsenal tab's Sync button, now uses `requireAdmin`. It was already safe, but answered a stranger 403 where the house gate says 401.
- `social-sync` still reads `CRON_SECRET` to forward it to `process-scheduled`, which checks it again.

### Tripwire
`src/lib/api/routeHandlers.ts` counted the bare name `CRON_SECRET` as a verifier, which is how these four passed the `routeWriteAuth` and `routeReadAuth` guards. It no longer counts.
- Against the old route code, the guard now flags exactly these four.
- Against the fixed code, every remaining cron route still passes, because each also names a real verifier.

## Verification
- **Tests:** `src/__tests__/adminWriteGates.test.ts` gains the five handlers in `GATED` (stranger 401, fan 403, nothing reached).
  - A new block deletes `CRON_SECRET`, the Preview state, and checks that no header, `Bearer ` and `Bearer undefined` all get 401 with nothing reached. An admin session still runs the job.
  - With the secret set, a wrong bearer gets 401 and the right one runs.
  - Against the old routes, 13 of these fail. Against the new ones, all 148 pass.
- **Full `npm test`:** 2 failed and 649 passed. The 2 failures are the known pre-existing `brandedEmailHTML` and `GET /api/videos` fallback. Before this work it was 2 failed and 630 passed.
- **`npx tsc --noEmit`:** 850 before and 850 after, with identical per-file counts.
- **ESLint on touched files:** the only hits are pre-existing `any` lines.

## For the owner
1. **Merge order:** `unruffled-goldstine` → `clever-pare` → this branch.
   - `claude/beautiful-curran-ad6154` (c9ebc40) gated many of the same routes from `main` in parallel: customers, social posts, expenses, orders GET and upload. It **will conflict** with `unruffled` and `clever-pare`.
   - What c9ebc40 has that the stack lacks:
     - the leaderboard no longer returns emails (the stack lists that in `KNOWN_OPEN`, waiting on you)
     - the middleware backstop for `/api/customers` and `/api/bi/expenses`
   - Best path is to rebuild those two pieces on top of this branch rather than merge c9ebc40 as is.
2. **`NEXT_PUBLIC_JWT_SECRET` and `ADMIN_NEXT_PUBLIC_JWT_SECRET`** are still set in Vercel for all three environments. Nothing reads them today. The day something does, Next puts the value in the browser bundle, and if it matches `JWT_SECRET` anyone can sign an admin token. First noted 2026-10-02 in `docs/sessions` (hidden videos); still worth deleting.
3. **Consider setting `CRON_SECRET` for Preview too.** It is no longer needed for safety, but Preview crons can then be exercised.
