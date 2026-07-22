# 2026-07-22 — Loop Soul merge, PR 1 (the port)

**Branch:** `feat/loop-soul-merge` · **Source:** `Mitus15/loop-soul-hub` @ `3f093ea`
**Plan:** `~/.claude/plans/odubo-studio-is-not-coming-inherited-cookie.md` (supersedes
loop-soul-hub `docs/plans/odubo-merge-execution.md`)

Loop Soul lands as a self-contained surface at **`/loop`** inside odubo — one repo, one
Vercel deploy, one Cloudflare account. This PR is the *co-location* half; the *integration*
half (State 2/3 gallery built on moments' `StorageService`) is PR 2.

## What shipped (one commit per phase)

| Commit | Phase |
|---|---|
| `8163d85` | 1 — deps (`zustand`, `@mediapipe/tasks-vision`, `clsx`) + `public/loop/` assets |
| `d3442a2` | 2 — lib → `src/lib/loop/*` (26 modules, imports rebased) |
| `5a2e0e0` | 3 — pages → `src/app/loop/*`, APIs → `src/app/api/loop/*`, components → `src/components/loop/*` |
| `665923a` | 4 — middleware merge, strictly `/loop`-scoped |
| `927903c` | 5 — theme merged into `globals.css`, scoped under `.loop-theme` |
| `54a0d5c` | 3 fix — late-staged lib asset paths |
| `31150ee` | 7 — D1 migrations `142_loop_soul_init.sql`, `143_loop_soul_event_phase.sql` (**files only, NOT applied**) |

## Deliberate deviations from the older execution doc

1. **Loop Soul's `db.ts` was KEPT** (`src/lib/loop/db.ts`), not repointed to odubo's.
   Same-named functions have different contracts — odubo's `executeQuery` returns the raw
   D1 envelope as `any`; Loop Soul's returns `D1Meta`. Repointing would make
   `event-codes.ts`'s `meta.changes === 0` check silently pass on `undefined` → **event
   codes redeemable twice**. Both clients read the same `DATABASE_URL`, so the one-DB FOLD
   is unaffected.
2. **Real `/loop` segment, not a `(loop)` route group** — groups add no URL path.
3. **Middleware branches all guard on `/loop` / `/api/loop`** — the naive merge would have
   put odubo's own `/admin` behind Loop Soul's `ls_admin` cookie.
4. **VaultMode flips `data-mode` on the `.loop-theme` wrapper**, not `document.body`
   (which is odubo's in the merged app).

## Env vars — needed on Vercel before /loop is live

New: `LOOP_ADMIN_PASSWORD` (renamed from `ADMIN_PASSWORD` — generic name is a landmine in
the shared app), `ANTHEM_VOTE_SECRET`, `ANTHEM_SUGGEST_GATE=open`, `EMAIL_MODE=mock`,
`EVENTBRITE_MODE=mock`, `POSE_STYLIZE_MODE=mock`, `NEXT_PUBLIC_DEFAULT_PHASE=pre`,
`NEXT_PUBLIC_POSE_GENERATIVE=0`, optional `LOOP_RESEND_FROM_EMAIL` (falls back to shared
`RESEND_FROM_EMAIL`), optional `MOCK_PASSES_SOLD`/`MOCK_PASSES_TOTAL`, `EVENTBRITE_*`,
`GEMINI_IMAGE_MODEL`, `CLOUDFLARE_AI_API_TOKEN`. Leave `ENABLE_ANTHEM_SIM` unset in prod.
Shared already-set vars reused as-is: `DATABASE_URL`, `CLOUDFLARE_D1_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `GEMINI_API_KEY`, `RESEND_API_KEY`.

## Verified

- `npm run build` clean — all 23 `/loop` + `/api/loop/*` routes registered. (Only warning:
  MediaPipe dynamic-import, inherent to the package, same in standalone Loop Soul.)
- `npm test` — 18/20 pass; the 2 failures (`/api/videos` tests) **fail identically on
  `main`** — pre-existing, unrelated.
- Lint: loop files add 2 warnings (inherited from source), zero errors.
- Dev-server smoke (curl):
  - odubo `/`, `/moments`, `/store` → 200; **no `ls_voter` minted outside `/loop`**
  - odubo `/admin` → 200, **not** captured by the loop gate
  - `/loop` → mints `ls_voter`; `/loop/pose`, `/loop/legacy` → 200
  - `/loop/admin` unauth → 307 to login; `/api/loop/admin/*` unauth → 401
  - login with dev password → session cookie → middleware admits `/loop/admin`
  - `/loop/posters/spin.png` → 200 (asset rebase works)

## Known state / next steps

- `/loop` and `/loop/admin` 500 with `no such table: event_phase` — **expected**: the D1
  migration apply is intentionally held until this PR is reviewed. Apply order after
  approval: run 142 then 143 against remote D1, add the env vars, redeploy:
  `npx wrangler d1 execute odubo --remote --file=database/migrations/142_loop_soul_init.sql`
  `npx wrangler d1 execute odubo --remote --file=database/migrations/143_loop_soul_event_phase.sql`
- After migration, verify the **event-code double-redeem** flow (redeem once → ok; same
  code again → `"used"`): this is the regression test for keeping Loop Soul's `db.ts`.
- The fresh loop-soul D1 (`047508df…`) becomes redundant after FOLD; delete when confident.
- PR 2 (gallery on moments) is sketched in the plan file; the integrity rule: **Loop Soul
  may import from moments; moments never imports from Loop Soul** — divergence goes
  through `galleries.config`, never a conditional naming Loop Soul.
