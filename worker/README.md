# Arsenal Transcoding Background Worker

Perpetual background service that processes video transcoding jobs with FFmpeg.

## Overview

This worker:
- ✅ Runs 24/7 on Railway (free tier)
- ✅ Polls database every 30 seconds for queued jobs
- ✅ Transcodes videos with FFmpeg (MOV/AVI/any → MP4)
- ✅ Updates real-time progress in database
- ✅ Uploads transcoded videos to R2
- ✅ Zero manual intervention required

## Architecture

```
User uploads video → Vercel creates job → Railway worker processes → Database updates → UI shows progress
```

## Railway Setup (5 minutes)

### Step 1: Get Cloudflare D1 REST API Credentials

You need a Cloudflare API token with D1 access:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: **"Edit Cloudflare Workers"** (includes D1 access)
4. Or create custom with these permissions:
   - Account / D1 / Edit
   - Account / Cloudflare Workers Scripts / Edit
5. Copy the API token (starts with `Bearer ...`)
6. Get your Account ID from Cloudflare dashboard home
7. Get your D1 Database ID:
   ```bash
   npx wrangler d1 list
   ```
   Copy the UUID for the `odubo` database

### Step 2: Deploy to Railway

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select your `odubo` repository
5. Railway will detect the repo

### Step 3: Configure Railway Service

1. In Railway dashboard, click "Add Service" → "New Service"
2. Choose "Deploy from GitHub"
3. Select your repo
4. **Important:** Set root directory to `/worker`
   - Go to Settings → Build → Root Directory → `/worker`
5. Set Start Command: `npm start`
   - Go to Settings → Deploy → Start Command → `npm start`

### Step 4: Set Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```bash
# Cloudflare D1 (from Step 1)
CLOUDFLARE_API_TOKEN=your_api_token_from_step_1
CLOUDFLARE_ACCOUNT_ID=835a09fb1a9d192ae03fc64b602fcc47
CLOUDFLARE_D1_DATABASE_ID=c63953e2-82b5-407f-b10d-831fc7e5e85e

# Cloudflare R2 (same as Vercel)
CLOUDFLARE_R2_ACCOUNT_ID=835a09fb1a9d192ae03fc64b602fcc47
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_key
CLOUDFLARE_R2_BUCKET_NAME=odubo
```

**Where to find these:**
- R2 credentials: Same as your Vercel environment variables
- Copy from Vercel dashboard → Settings → Environment Variables
- Or from `.env.local` file

### Step 5: Deploy

1. Railway will auto-deploy after you save variables
2. Watch the logs in Railway dashboard
3. You should see:
   ```
   [Worker] Starting transcoding worker...
   [Worker] Poll interval: 30000ms
   [Worker] D1 Database: c63953e2-82b5-407f-b10d-831fc7e5e85e
   [Worker] R2 Bucket: odubo
   [Worker] No jobs found, sleeping for 30s...
   ```

### Step 6: Test It

1. Go to Arsenal tab in your app
2. Upload a video (K-Town)
3. Watch the transcoding progress appear live
4. Check Railway logs - you'll see the worker pick up the job:
   ```
   [Worker] Found job 1, starting processing...
   [Worker] Job 1 downloading from R2: videos/source/2026/02/...
   [Worker] Job 1 → analyzing (5%)
   [Worker] Job 1 → transcoding (10%)
   [Worker] Job 1 → transcoding (45%)
   [Worker] Job 1 → transcoding (95%)
   [Worker] Job 1 COMPLETE! Video 123 ready to deploy.
   ```

## Railway Free Tier

- $5/month credit (500 execution hours)
- This worker uses ~1-2 hours/month idle time
- Plus transcoding time (depends on upload volume)
- Typical usage: $0-2/month (well within free tier)

## Monitoring

### Check Worker Status
Railway dashboard → Logs tab → Real-time logs

### Check Job Queue
Query your D1 database:
```bash
npx wrangler d1 execute odubo --remote --command="SELECT * FROM transcoding_jobs ORDER BY created_at DESC LIMIT 5;"
```

### Restart Worker
Railway dashboard → Settings → Redeploy

## Troubleshooting

### Worker Not Starting
- Check environment variables are set
- Verify D1 API token has correct permissions
- Check Railway logs for error messages

### Jobs Stuck in "queued"
- Worker might be processing a long video
- Check Railway logs to see current job progress
- Restart worker if stuck

### FFmpeg Errors
- Check source video is valid (not corrupted)
- Check R2 URL is accessible
- Verify R2 credentials are correct

### Out of Memory
- Large videos (>2GB) might exceed Railway memory limit
- Upgrade to Railway Pro plan ($5/month) for more memory
- Or use smaller source files

## Cost Optimization

The worker sleeps 30 seconds between polls (zero CPU usage). You only pay for:
1. Idle time (minimal)
2. Transcoding time (actual processing)

Typical monthly cost: **$0-2 (free tier)**

## Development

Run locally:
```bash
cd worker
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

## Logs

Worker logs everything for visibility:
- Job discovery
- Download progress
- Transcoding progress (every 5%)
- Upload progress
- Completion status
- Errors with retry attempts

All visible in Railway dashboard real-time.
