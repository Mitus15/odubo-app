# Audit findings

Security and integrity issues found while building Release Control (2026-08-22).
Items marked **FIXED** were closed in that work. The rest are recorded
deliberately: they are real, they are out of scope for one feature branch, and
they should not be rediscovered from scratch a third time.

---

## FIXED — `/api/command-center/**` was unauthenticated

**Severity: critical.** All eight route files under
`src/app/api/command-center/` — `releases`, `releases/[id]`, `video-releases`,
`video-releases/[id]`, `video-releases/[id]/assets`, `hub-videos`, `analytics`,
`analytics/comprehensive` — had no auth check on any method.
`src/middleware.ts` had no gate for the path either. `POST`, `PATCH` and
`DELETE` against the album's distribution release, its UPC, its 14 ISRCs and
its DSP targets were open to anyone on the internet.

This hole was found and fixed once before, in the 2026-08-21 session whose
branch was lost; the fix went with the code. That is why it is written down
here this time.

**Fix:** `requireAdmin()` (`src/lib/api/requireAdmin.ts`) on every handler,
plus `handleCommandCenterApi()` in `src/middleware.ts` as an edge-level
backstop so a newly added handler cannot reintroduce the hole by forgetting
the in-route check.

---

## OPEN — `getUserFromRequest` does not verify the JWT signature

**Severity: critical. Systemic.**

`src/lib/auth.ts:44` — `getUserFromRequest()` calls `decodeWithoutVerify()`,
which base64-decodes the JWT payload and trusts it. It never checks the
signature. Any client can mint an unsigned token whose payload is
`{"userId":"x","email":"x","is_admin":true}` and pass every admin gate built
on this helper.

`verifyUserFromRequest()` (`src/lib/auth.ts:55`) is the real one — it uses
`jose.jwtVerify` against `JWT_SECRET`.

**Census as of 2026-08-22:** 136 files import the unverified helper; 12 import
the verified one.

Release Control uses `verifyUserFromRequest` throughout, and
`src/lib/api/requireAdmin.ts` exists so new routes get the correct one by
default. Migrating the other call sites is its own project: it needs a sweep,
a check that every legitimate client actually sends a properly signed token,
and a staged rollout — a blind find-and-replace would lock the owner out of
their own admin.

**Suggested approach when it is taken on:** make `getUserFromRequest` async and
delegate to `verifyUserFromRequest`, keeping the name, so the 136 call sites
change only by adding `await`. Verify token minting in `/api/auth/*` signs
with the same secret first.

---

## OPEN — `/api/admin/ark/**` has no auth at all

**Severity: high.** All 28 route files under `src/app/api/admin/ark/` — the
Ark's projects, tasks, milestones, notes, assets and AI coach — have no
`getUserFromRequest`, no `isAdminUser`, nothing. Grepping the tree returns no
matches. `src/middleware.ts` does not gate `/api/admin/*` either.

Not fixed here because it belongs to a different feature and would balloon an
already-large diff. The fix is mechanical: `requireAdmin()` at the top of
every handler, exactly as the command-center routes now do.

---

## OPEN — `/loop/admin` accepts any password while `LOOP_ADMIN_PASSWORD` is unset

**Severity: high in production, deliberate in testing.**

`src/lib/loop/admin-auth.ts` uses `LOOP_ADMIN_PASSWORD` as the HMAC key. While
that variable is unset, login accepts anything — including an empty password.
This was the owner's explicit call on 2026-08-10 for the test-event phase.

It is one environment variable. It must be set before the event, because every
deep-link Release Control adds points into that realm. Release Control surfaces
it as a Runway warning rather than depending on it.

---

## OPEN — R2 CORS rejects the origin production actually runs on

**Severity: high. Breaks Arsenal too, not just the warehouse.**

Every large upload in this app goes browser → R2 directly, because a 100MB
request body cannot pass through a Function. That makes the browser do a
cross-origin PUT to a presigned URL, which needs two things from the bucket:
the page's origin in `AllowedOrigins`, and `ETag` in `ExposeHeaders` (without
the ETag a multipart upload cannot be completed).

Probed against `odubo-studio-media` on 2026-08-24:

| Origin | Preflight | ETag exposed |
|---|---|---|
| `https://odubo.studio` | 204 allowed | yes |
| `https://odubo-app.vercel.app` | **403 rejected** | — |
| `http://localhost:3113` | **403 rejected** | — |

The policy is correct for `odubo.studio` — but that domain is lapsed, and the
site is served from the vercel.app URL. **So browser uploads are currently
broken in production**, and have been since the domain went. It presents as
"Failed to fetch" on the first part, which reads like a dead connection and
is nothing of the sort.

Not fixed here because it cannot be: the R2 keys in `.env.local` can read and
write objects but not change bucket configuration, and this needs an R2 token
with admin rights.

**The fix**, once such a token exists:

```bash
node --env-file=.env.local scripts/release/set_r2_cors.mjs --apply
```

Run it without `--apply` first to print the policy. Failing that, paste the
printed JSON into R2 → the bucket → Settings → CORS Policy by hand.

**R2 gotcha, already learned once on this project:** unlike AWS S3, R2 does
**not** accept `"*"` in a header list. Every header must be named. A wildcard
there is silently rejected and looks exactly like a network failure.

The upload driver now names this cause explicitly when a part fails with a
CORS-shaped error, rather than reporting three failed retries.

---

## Context — production schema drift

Not a vulnerability, but it is how the Warehouse code came to be lost and is
worth knowing before writing another migration.

The `d1_migrations` ledger in production **stops at `065`**. Everything since
has been applied out-of-band by one-off scripts, so the ledger cannot tell you
what production has. Production carries the effects of migrations 153 and 154
even though those files did not exist in the repo until 2026-08-22, when they
were reconstructed from the live `sqlite_master` DDL.

The working contract:

- **Production is authoritative** for what exists.
- **The migration files are authoritative** for how a fresh database gets there.
- **The ledger is authoritative for nothing.**

Every new migration is therefore either pure `CREATE ... IF NOT EXISTS` or
paired with a `PRAGMA table_info()`-guarded runner (see
`scripts/release/apply_155_release_control.ts`). `152` is deliberately skipped
— the number may have been spent against production and the ledger cannot say.

Also: `scripts/apply_d1_migrations_via_api.mjs` is broken. It prefers
`CLOUDFLARE_D1_API_URL` from `.env.local`, which is missing the database id.
Use `DATABASE_URL` (which is what `src/lib/loop/db.ts` reads).
