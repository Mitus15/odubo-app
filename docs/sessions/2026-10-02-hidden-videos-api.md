# 2026-10-02 · A hidden video stays hidden in the video API

On 2026-09-29 `/media/[videoId]` learned to show only public, live videos
(`publicVideoWhere`, `src/lib/publicVideos.ts`). The same leak was still open
in the API, and the crop route had no login check at all. Both closed here, on
branch `claude/mystifying-hugle-0cde7d`, **not yet deployed**.

## What was open

- `GET /api/videos` listed every row to anyone: D1 holds 126 videos, 63 of them
  hidden (all `is_public = 0` and archived), and all 126 went out with `url`,
  `uid` and `stream_video_id`.
- `GET /api/videos/[id]` served any row by id. Checked live on 2026-10-02: an
  anonymous `GET www.odubostudio.com/api/videos/445` (`is_public = 0`) answered
  200 with its stream URL.
- Why it matters now: `scripts/loop/film/publish.ts` uploads the Loop Soul film
  and its clips hidden (`is_public 0`, `publication_status 'archived'`) ahead of
  release. Without this fix the film is one request away the moment it lands.
- `POST /api/videos/crop` ran ffmpeg on any URL for anyone.

## What changed

- `src/lib/adminRequest.ts`: `isAdminRequest` moved here, unchanged, from
  `src/lib/loop/audioAccess.ts`, which still re-exports it (the Loop pages and
  any unmerged branch import it from there). Its own commit.
- `GET /api/videos`: ANDs `publicVideoWhere('v')` onto the query unless
  `isAdminRequest`. The `uid`, `publication_status` and `exclude_type` filters
  can no longer fish a hidden row out.
- `GET /api/videos/[id]`: the same rule; a hidden video is 404, as on
  `/media/[videoId]`, so the response does not even confirm it exists.
- `POST /api/videos/crop`: `requireAdmin` (`src/lib/api/requireAdmin.ts`, the
  gate 31 routes already use) before ffmpeg: 401 without a valid session, 403
  for a signed-in non-admin. Odubo admins only, not the Loop team cookie: its
  one caller is the admin Video Library's social export.

**Who counts as an admin** for the two GETs (`isAdminRequest`): an Odubo admin's
JWT, signature verified, from the `token` cookie or a Bearer header (`is_admin`
claim or `ADMIN_EMAILS`); or the Loop team's `ls_admin` cookie, verified against
`LOOP_ADMIN_PASSWORD` (set in Production).

## Every caller, checked

- Admin Video Library list (`src/app/admin/videos/page.tsx`, `loadVideos`):
  sends the `token` cookie only. Every login path (`POST /api/users`) sets that
  cookie, so it still sees hidden videos.
- The upload flow's lookup of its new row by `?uid=` (same page): Bearer, still
  finds the row it just created hidden.
- Crop (same page, twice): cookie, passes `requireAdmin`.
- Public: `MediaHubModal` (live list), `DesktopLanding` media section,
  `VideoPlayerModal` (by id; a 404 shows its existing error state). Now public
  rows only, which is the point.
- Every other `/api/videos/[id]` caller is PUT or DELETE, already admin-gated.
  The sibling GETs (`download`, `clips`, `markers`, `analysis`, `status`,
  `stream/details`) were already admin-gated.

## Verification

- `npx tsc --noEmit`: 850 errors before and after, line-for-line identical.
- `npm test`: 411 passed (387 + 24 new), the 2 known failures unchanged
  (`emailTemplates`, `videos.get`).
- The new tests fail on the old code: 9 of the visibility tests, 3 of the crop
  tests. The admin cases pass on both, guarding against over-blocking.
- Live, `next dev` against the real D1: video 445 is 404 for an anonymous and a
  signed-in non-admin caller, 200 with its playback URL for an admin JWT and for
  the Loop team cookie. The list gives 63 rows anonymously and 126 to an admin;
  `?uid=<445's uid>` gives 0 rows anonymously and 1 to an admin. Crop: 401, 403,
  and an admin passes the gate (the handler's own 400 for a missing URL, so
  ffmpeg never started).

**Testing note.** `videos.visibility.test.ts` runs the routes' own SQL against
`node:sqlite` (Node 22.13 or later, no flag) behind a mocked `@/lib/db`, so the
rule is tested by the rows that come back. `@types/node` here is 20.x without
sqlite typings, so the test loads it with `require` and a two-method type.

## Not changed, on purpose

- No client changes: the admin screens already send the credentials the gate
  reads.
- The list still reports `COALESCE(publication_status, 'archived')`, so a legacy
  row with a NULL status reads "archived" in the response while the rule counts
  it live. Display only.

## Found in passing, not fixed

- `PATCH /api/videos/bulk-update` has no auth check: anyone can set `status` on
  any video, for instance archive the whole library. Nothing in `src/` calls it.
- `POST /api/videos/description/generate` has no auth check and calls paid AI
  APIs (Gemini, DeepSeek).
- SocialOps sends `PATCH /api/videos/[id]`, which has no PATCH handler, so
  those calls answer 405.
- `NEXT_PUBLIC_JWT_SECRET` and `ADMIN_NEXT_PUBLIC_JWT_SECRET` are set in Vercel
  for every environment. Nothing reads them today; the day something does,
  Next inlines the secret into the browser bundle. Worth deleting.
- Preview deployments get the D1 credentials but no `LOOP_ADMIN_PASSWORD`, so
  the Loop admin is in open mode there and its cookie passes `isAdminRequest`
  (hidden videos, and already the unreleased album audio). Vercel deployment
  protection answers anonymous preview requests with a login redirect today,
  so this stays closed while that setting is on.
- Crop still takes any URL scheme from an admin. Allowing only `https:` would
  stop ffmpeg reading local files if an admin session ever leaked.
- `videos.get.test.ts` (a known failure) asserts a "fallback schema" the route
  dropped on purpose ("fail loudly if schema is wrong"). Rewrite or delete it.

## Next

- Merge and deploy before the film is uploaded. Production still leaks until then.
