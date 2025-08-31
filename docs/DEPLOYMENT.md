# Odubo Deployment Guide

This guide covers how to deploy Odubo to production with Vercel, including required environment variables, media (R2) configuration, HLS audio pipeline, and troubleshooting.

## 1) Prerequisites
- GitHub repository: `Mitus15/odubo-app`
- Vercel project linked to the repo
- Cloudflare R2 bucket for media (e.g., `odubo-studio-media`)
- Cloudflare D1 database and credentials

## 2) Environment Variables (Vercel → Project → Settings → Environment Variables)
Set for Production (and Preview if desired):
- Database (D1)
  - `DATABASE_URL`
  - `CLOUDFLARE_D1_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_D1_DATABASE_ID`
- R2 Storage
  - `CLOUDFLARE_R2_ENDPOINT`
  - `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - `CLOUDFLARE_R2_BUCKET_NAME` (e.g., `odubo-studio-media`)
  - `CLOUDFLARE_R2_PUBLIC_URL` (e.g., `https://media.odubo.studio`)
- Site / Auth
  - `NEXT_PUBLIC_SITE_URL` (e.g., `https://odubo.studio`)
  - `JWT_SECRET`
- Optional
  - `GEMINI_CACHE_TZ` (timezone for daily cache keys, default UTC)

## 3) Auto‑Deploys via Git
- Auto-deploys are triggered by pushing to `main`.
- Steps:
  1. Save changes locally
  2. Commit and push:
     ```bash
     git add -A
     git commit -m "chore: deploy"
     git push origin main
     ```
  3. Vercel → Deployments: verify the new build started and watch logs.

## 4) Manual Deploys (optional)
- CLI: `npx vercel --prod --confirm`
- Dashboard: Vercel → Deployments → Redeploy the latest commit on `main`.

## 5) Cloudflare R2 CORS (for HLS and media)
Configure CORS on your R2 bucket so the app can fetch `.m3u8` and `.aac` files from the browser.
- Allowed origins: your app origins (e.g., `https://odubo.studio`, and dev origins like `http://localhost:3000` / `http://localhost:3001` or your LAN dev origin)
- Allowed methods: `GET`, `HEAD`
- Allowed headers: `Range`, `Content-Type`, `Accept`
- Expose headers: `Content-Length`, `Content-Range`, `Accept-Ranges`, `ETag`, `Last-Modified`, `Cache-Control`
- Max age: `86400`

Quick test:
```bash
curl -I -H "Origin: https://odubo.studio" "https://media.odubo.studio/path/to/master.m3u8"
```
Ensure `Access-Control-Allow-Origin` echoes your origin.

## 6) HLS (Adaptive Bitrate) Audio Pipeline
- Generate HLS for a track/album/all and upload to R2:
  ```bash
  # one track
  npm run audio:hls:track <trackId>
  # by album ID
  npm run audio:hls:album <albumId>
  # all tracks
  npm run audio:hls:all
  ```
- Requirements (local): FFmpeg available. The script auto-resolves via `ffmpeg-static`, `@ffmpeg-installer/ffmpeg`, `FFMPEG_PATH`, or system `ffmpeg`.
- Outputs: multi-bitrate AAC (64k/128k/256k), variant playlists, and `master.m3u8` at `CLOUDFLARE_R2_PUBLIC_URL/.../*.hls/master.m3u8`.
- Frontend prefers HLS (native or hls.js) and falls back to progressive `/api/tracks/[id]/stream` automatically.

## 7) CSP (Content Security Policy)
The app sets CSP headers in `next.config.ts`. For HLS playback with hls.js:
- Ensure `media-src` allows `https:` and `blob:`
- Add `worker-src 'self' blob:`

This is already configured. If you customize CSP, keep those directives.

## 8) Production Health Checks
After a deploy:
- Open the site homepage and a few album pages
- Play a track (HLS first, fallback progressive)
- Verify media is served from `media.odubo.studio` with no CORS errors

## 9) Troubleshooting
- No deploy after push:
  - Vercel project → Settings → Git
    - Repo linked to `Mitus15/odubo-app`
    - Production Branch: `main`
    - Auto-Deploy: Enabled
  - GitHub → Settings → Applications → Installed GitHub Apps → Vercel → has access to `odubo-app`
  - GitHub repo → Settings → Webhooks: Vercel webhook present and deliveries are 200
- HLS not loading:
  - Check R2 CORS (ACAO present on `.m3u8` and `.aac`)
  - Confirm `media-src`/`worker-src` in CSP
  - Inspect Network for `.m3u8` and segment responses
- Progressive playback failing:
  - `/api/tracks/[id]/stream` should return 200 and support `Range`
  - Check upstream `audio_url` content type and reachability

## 10) Useful Scripts
- HLS generation: see section 6
- Cloudflare Pages deployment (alternative): `CLOUDFLARE_PAGES_DEPLOYMENT.md`
- Production setup details: `PRODUCTION_SETUP.md`

—
If you need a one‑click script for “stage → commit → push”, add:
```json
"deploy:push": "git add -A && git commit -m \"chore: deploy\" || echo \"No changes\" && git push origin main"
```
Then run:
```bash
npm run deploy:push
```
