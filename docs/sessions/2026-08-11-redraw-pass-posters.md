# 2026-08-11 — The Redraw, Pass Sales live, Poster Studio

Branch `claude/loop-redraw-poster-studio` (off main after PR #5/#6 merged).
Owner-approved plan: `~/.claude/plans/users-maniodubo-claude-uploads-978f8eda-steady-treehouse.md`.

## 1. "The Redraw" — vectorized Pose filter

On-device screenshots showed the pixel filter's failure modes (blobby mask
edges, scratchy Sobel lines). Replaced with a trace-and-redraw pipeline:

- `src/lib/loop/pose/geometry.ts` — pure geometry (box blur, box-average
  downsample, marching squares w/ linear interpolation + centre-sample saddle
  rule, closed-loop RDP, Chaikin). **9 unit tests** in
  `src/__tests__/loopPoseGeometry.test.ts`.
- `src/lib/loop/pose/vectorize.ts` — mask → silhouette Path2D (outer/hole via
  **containment parity**, NOT winding sign — border-touching figures flip
  winding; that bug cost an hour) → sparse sand tone-cuts from in-mask
  luminance quantiles (0.86 / 0.95 — tight, per owner's "too many lines")
  → `renderScene`.
- Photo: `stylizePoster()` in stylize.ts (pixel `stylize()` stays as the
  no-mask/bad-coverage fallback). Video: `video-engine.ts` visible canvas is
  now **2D**; silhouette re-traced per new mask, cuts every 2nd frame,
  threshold EMA'd; `gl-stylize.ts` demoted to offscreen maskless fallback
  with 15/10-frame hysteresis. All tunables in `palette.ts` `VECTOR_DEFAULTS`.
- The paid `/api/loop/pose/stylize` route is now holder-or-admin gated +
  rate-limited (10/10min); the "Make it a poster" button shows only in the
  Portal (`posterEnabled && wallEnabled`).

Verified on repo photos via a temp harness (deleted): smooth clean silhouette,
few bold cuts, photo/video engines consistent.

## 2. Pass sales — admin-configured (no env vars)

- Migration **146** `loop_settings` KV (applied to remote D1 via
  `scripts/loop/apply_146_loop_settings.ts`).
- `src/lib/loop/pass/settings.ts` — D1-first, env-fallback config:
  checkout URL, SKU, product id, mode (mock|shopify).
- Rewired: webhook matcher, `getPassCapacity()` (replaces getPassProvider at
  call sites), Get Pass modal checkout link (server-passed prop).
- Admin **Pass sales** section: sold/remaining readout, in-place Shopify
  checklist, save fields, go-live/pause toggle.
- Verified live: save → capacity flips mock(44)→ledger(0/75) → webhook order
  with D1-configured SKU mints + emails a code → pause restores mock. Test
  data cleaned.

## 3. Poster Studio

- `/loop/admin/posters` (+ link card on admin): figure from brand cut-outs /
  uploaded PNG / Wall shot; arc tagline (per-char quadratic, auto-shrink);
  real wordmark SVG; event details block; Scott's mark; **QR** (new `qrcode`
  dep) ink-on-sand, default URL `https://odubo-studio-app.vercel.app/loop`.
- Exports print 2400×3300 / feed 1080×1350 / story 1080×1920 via file-saver.
- `src/lib/loop/poster/compose.ts` is the engine.

## Gotchas for future sessions

- **SVG via blob URL fails `img.decode()`** in Chromium-based panes
  ("EncodingError") — use `data:image/svg+xml;charset=utf-8,` +
  encodeURIComponent. Brand SVGs are viewBox-only → inject width/height or
  natural size is wrong/zero.
- **Marching-squares winding**: don't classify outer/hole by area sign;
  border-closed loops flip. Containment parity is robust.
- Wall media for canvas use: `?stream=1` on `/api/loop/gallery/media/...`
  pipes same-origin (redirect target would taint the canvas).
- Worktrees: no node_modules → symlink main's + `npx next dev` (no turbopack).
- New deps installed in the MAIN checkout (shared node_modules), package.json
  + lock copied into the worktree.

## Owner steps to finish activation

1. **Vercel env** (for the AI poster button): `POSE_STYLIZE_MODE=live`,
   `NEXT_PUBLIC_POSE_GENERATIVE=1` (GEMINI_API_KEY already set) → redeploy.
2. **Shopify**: create pass product (SKU `LOOP-PASS-VOL1`, inventory 75) +
   orders/paid webhook → `/api/loop/pass/webhook`; paste checkout link + SKU
   in admin → Pass sales → Go live.

## Pending / next

- On-device pass over the Redraw (photo, live video, recorded clip, Wall post).
- Poster Studio: scan an exported QR with a real phone (library-verified only).
- Consider a Pinyon-script arc option and figure-scale slider in Poster Studio.
