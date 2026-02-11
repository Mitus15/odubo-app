# Deployment Checklist - MP4 Processing System

**Complete these steps in order**

---

## ✅ Step 1: Generate CRON_SECRET

```bash
openssl rand -hex 32
```

**Copy the output** - you'll need it for Steps 2 and 4.

Example output: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`

---

## ✅ Step 2: Add CRON_SECRET to Vercel

```bash
vercel env add CRON_SECRET
```

When prompted:
1. **Value:** Paste the secret from Step 1
2. **Environments:** Select all 3:
   - Production ✓
   - Preview ✓
   - Development ✓
3. Press Enter

Also add to local `.env.local`:
```bash
echo "CRON_SECRET=your-secret-here" >> .env.local
```

---

## ✅ Step 3: Deploy Code Changes

```bash
git add .
git commit -m "feat: robust MP4 processing with Cloudflare Workers cron"
git push origin main
```

Wait for Vercel deployment to complete (~2 minutes).
Check: https://vercel.com/your-project/deployments

---

## ✅ Step 4: Deploy Cloudflare Worker

```bash
cd cloudflare-worker-cron
npm install

# Set the secret (same one from Step 1)
npx wrangler secret put CRON_SECRET
# Paste your secret when prompted

# Deploy
npm run deploy
```

Should see:
```
✨ Success! Uploaded odubo-mp4-processor-cron
🌎 https://odubo-mp4-processor-cron.your-subdomain.workers.dev
```

---

## ✅ Step 5: Verify Worker is Running

1. Go to Cloudflare Dashboard
2. Click **Workers & Pages**
3. Find **odubo-mp4-processor-cron**
4. Click **Triggers** tab
5. Verify cron: `*/5 * * * *`
6. Click **Send test event** → **Cron**

Check logs in **Logs** tab - should see API call.

---

## ✅ Step 6: Run Database Migration

```bash
# Go back to main project
cd ..

# Run migration
npx wrangler d1 execute odubo --remote --file=database/migrations/106_add_mp4_processing_status.sql
```

Should see:
```
🌀 Executing on remote database odubo
🌀 To execute on your local development database, remove the --remote flag

🚣 Executed 10 commands in 0.5s
```

---

## ✅ Step 7: Fix All 112 Existing Videos

```bash
npm run mp4:backfill
```

This will take **~10-15 minutes**. It processes videos sequentially.

You'll see progress for each video:
```
[1/112] Processing [MOV]: "Take That Intro"
  Stream UID: 462ef7...
  Enabling downloads...
  Waiting for download to be ready...
  ✅ MP4 URL: https://customer-xxx.cloudflarestream.com/.../downloads/default.mp4
  ✅ Updated!
```

---

## ✅ Step 8: Monitor Status

```bash
npm run mp4:monitor
```

Should show:
```
📊 Status Summary:
✅ READY: 124 videos
⏳ PROCESSING: 0 videos
❌ FAILED: 0 videos
⏸️  PENDING: 0 videos
```

---

## ✅ Step 9: Test Upload

1. Go to Arsenal tab
2. Upload a test video (small file)
3. Should complete in ~30 seconds
4. Run `npm run mp4:monitor`
5. Should show video as READY or PROCESSING
6. Within 5 minutes, should be READY
7. Try deploying to PostForMe

---

## ✅ Step 10: Verify Cron is Working

Wait 5 minutes, then check:

```bash
npm run mp4:monitor
```

Any videos in PROCESSING should get updated automatically.

**Check Cloudflare Worker logs:**
1. Cloudflare Dashboard → Workers & Pages
2. Click **odubo-mp4-processor-cron**
3. Click **Logs (Real-time)**
4. Wait for next 5-minute mark
5. Should see API call logged

---

## 🎉 All Done!

Your system is now:
- ✅ Uploads complete in 10-30 seconds
- ✅ Background processing every 5 minutes (free)
- ✅ Full status tracking
- ✅ Monitoring dashboard
- ✅ All 112 videos fixed

---

## Quick Commands

```bash
# Monitor processing status
npm run mp4:monitor

# Reset stuck videos
npm run mp4:reset-stuck

# Process all pending videos manually
npm run mp4:backfill

# Check all video URLs
npx tsx --env-file=.env.local scripts/audit-all-video-urls.ts
```

---

## Troubleshooting

### Worker not triggering?
- Check Cloudflare Dashboard → Workers → Logs
- Verify CRON_SECRET matches in Vercel and Worker
- Trigger manually: Workers → Send test event

### Videos stuck in PROCESSING?
```bash
npm run mp4:monitor
npm run mp4:reset-stuck
```

### Backfill failing?
- Check Cloudflare Stream dashboard
- Verify CLOUDFLARE_STREAM_API_TOKEN is set
- Check individual video UIDs exist in Stream

---

## Next Steps

After everything is working:
1. Re-deploy all 112 affected videos to PostForMe
2. They now have correct Stream MP4 URLs
3. Deployments should succeed
