# Cloudflare Worker Cron - MP4 Processing

**Free alternative to Vercel cron for triggering MP4 processing**

## Setup

1. **Install Wrangler**
   ```bash
   cd cloudflare-worker-cron
   npm install
   ```

2. **Set the Secret**
   ```bash
   # Use the same CRON_SECRET you added to Vercel
   npx wrangler secret put CRON_SECRET
   # Paste your secret when prompted
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

4. **Verify**
   - Check Cloudflare dashboard → Workers & Pages
   - Should see "odubo-mp4-processor-cron"
   - Check "Triggers" tab → Should show cron schedule

## How It Works

- Runs every 5 minutes (Cloudflare cron)
- Calls your API: `POST https://odubo.studio/api/arsenal/process-stream-downloads`
- Includes `x-cron-secret` header for authentication
- Completely free (Workers free tier: 100K requests/day)

## Testing

```bash
# Test locally
npm run dev

# Trigger cron manually in Cloudflare dashboard
# Workers & Pages → odubo-mp4-processor-cron → Triggers → Cron Triggers → Fire
```

## Monitoring

Check logs in Cloudflare dashboard:
- Workers & Pages → odubo-mp4-processor-cron → Logs

## Cost

**FREE** ✅
- Workers free tier: 100,000 requests/day
- Cron runs: ~288/day (every 5 minutes)
- Well within free limits
