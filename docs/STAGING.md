# Staging and Preview Deployments

This app uses Vercel Preview deployments for staging. Every push to a non-main branch creates a unique HTTPS URL you can open on mobile for camera testing and QA.

## Branch workflow

- Create a feature/staging branch:
  - Example: `staging/moments-scroll-fix`, `feat/capture-ux`.
- Push commits to the branch → Vercel creates a Preview deployment automatically.
- Open a Pull Request to `main` when ready to merge.
- Use branch protection on `main` (optional) to require reviews and passing checks.

### Quick commands

```bash
# create and push a staging branch
git checkout -b staging/<short-desc>
git push -u origin staging/<short-desc>
```

## Environments and variables

Set environment variables in Vercel → Project → Settings → Environment Variables. Vercel supports three environments: Development, Preview, and Production.

Recommended Preview variables:

- GEMINI_API_KEY
- THUMBNAIL_JOB_SECRET
- Cloudflare: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_D1_API_TOKEN,
  CLOUDFLARE_STREAM_API_TOKEN, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL, CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_S3_API
- SHOPIFY keys (if testing store)
- RESEND_API_KEY, RESEND_FROM_EMAIL (if testing email)

Notes:
- You can omit `NEXT_PUBLIC_APP_URL` in Preview. The app will use Vercel's `VERCEL_URL` automatically for server-side fetches (we added an env-based fallback).
- Never commit secrets to `.env.local` in the repo. Keep them in Vercel.

## Testing on mobile (camera)

- Use the HTTPS Preview URL (e.g. https://<deployment>.vercel.app). Mobile browsers require HTTPS for camera.
- Moments → Capture will request camera permission and work in secure context.

## Promoting to Production

1. Open a Pull Request targeting `main`.
2. Confirm:
   - Build succeeds (no dynamic-server errors on `/`).
   - Pages render as expected on the Preview URL.
   - Core flows (login, upload, playback) work.
3. Merge to `main` → Vercel creates a Production deployment.

## Rollback

- Revert the PR or redeploy a previous build in Vercel → Deployments.

## Troubleshooting

- Dynamic server usage error on `/`: ensure no `headers()`/`cookies()` are used during prerender; use ISR with `export const revalidate = 86400`.
- Upload function timeouts on Vercel: prefer local uploads or direct-to-Stream client uploads for large files.
- Camera doesn’t start on mobile: confirm HTTPS; the page now surfaces `play()` errors if autoplay fails.

## Checklist before merging

- [ ] Tests pass in Preview (main user flows)
- [ ] Env vars set in Production environment
- [ ] DB migrations applied (D1) if needed
- [ ] Error monitoring enabled (optional)
