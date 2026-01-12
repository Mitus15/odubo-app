# Odubo Intelligence Platform - Future Tasks & Setup Guide

This document tracks all manual setup tasks, future development work, and configuration steps needed to fully activate the Intelligence Platform.

---

## IMMEDIATE SETUP TASKS (Do Now)

### 1. Shopify Admin API Setup
**Required for:** Commerce Analytics (Phase 2)

1. Go to Shopify Admin → Settings → Apps → Develop apps
2. Click "Create an app" → Name it "Odubo Intelligence"
3. Configure Admin API scopes:
   - `read_orders` (required)
   - `read_customers` (optional, limited on Basic)
   - `read_products` (optional)
4. Install the app and copy the Admin API access token
5. Add to `.env.local`:
   ```
   SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 2. Shopify Webhooks Setup
**Required for:** Real-time order updates

1. In your Shopify app settings, go to "Webhooks"
2. Add these webhooks pointing to `https://yourdomain.com/api/webhooks/shopify`:
   - `orders/create`
   - `orders/updated`
   - `orders/cancelled`
   - `refunds/create`
3. Copy the webhook signing secret
4. Add to `.env.local`:
   ```
   SHOPIFY_WEBHOOK_SECRET=your_webhook_signing_secret
   ```

### 3. Initial Data Sync
**Required for:** Populating commerce analytics

1. Navigate to Admin → Intelligence → Commerce
2. Click "Sync Orders" to import your order history
3. This will sync the last 60 days of orders (Shopify Basic limit)
4. Set up a cron job to run daily: `POST /api/cron/sync-shopify`

---

## PLATFORM CONNECTIONS SETUP (Phase 3)

### YouTube Analytics API
**Status:** Ready to implement

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing
3. Enable "YouTube Analytics API" and "YouTube Data API v3"
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `https://yourdomain.com/api/connections/callback`
6. Add to `.env.local`:
   ```
   YOUTUBE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
   YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
   ```

### Instagram Graph API
**Status:** Ready to implement

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create an app (Business type)
3. Add Instagram Graph API product
4. Configure OAuth redirect: `https://yourdomain.com/api/connections/callback`
5. Request permissions: `instagram_basic`, `instagram_manage_insights`
6. Add to `.env.local`:
   ```
   INSTAGRAM_APP_ID=xxxxxxxxxxxxx
   INSTAGRAM_APP_SECRET=xxxxxxxxxxxxx
   ```

### TikTok Creator API
**Status:** Requires business verification

1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Create an app
3. Apply for Creator API access (requires verification)
4. Once approved, configure OAuth
5. Add to `.env.local`:
   ```
   TIKTOK_CLIENT_KEY=xxxxxxxxxxxxx
   TIKTOK_CLIENT_SECRET=xxxxxxxxxxxxx
   ```

### Spotify for Artists API
**Status:** Requires artist verification & app approval

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Request access to Spotify for Artists API (limited access)
4. This requires:
   - Verified artist account
   - App review and approval
   - Business justification
5. Add to `.env.local`:
   ```
   SPOTIFY_CLIENT_ID=xxxxxxxxxxxxx
   SPOTIFY_CLIENT_SECRET=xxxxxxxxxxxxx
   ```

---

## STREAMING ANALYTICS SETUP (Phase 4)

### CSV Import from Distributors
**Status:** To be built

Since direct API access to streaming platforms is limited, we support CSV imports:

#### UnitedMasters
1. Log into UnitedMasters dashboard
2. Go to Analytics → Export
3. Download streaming report CSV
4. Upload to Admin → Intelligence → Streaming → Import

#### DistroKid
1. Log into DistroKid
2. Go to Stats → Download Spreadsheet
3. Upload the CSV file

#### TuneCore
1. Log into TuneCore
2. Go to Reports → Download
3. Select date range and download

**File Format Expected:**
```csv
date,platform,territory,track_name,isrc,streams,revenue
2024-01-15,spotify,US,Track Name,USXXX1234567,1500,0.45
```

---

## CRON JOBS TO CONFIGURE

Set up these scheduled jobs in your hosting platform (Vercel Cron, Cloudflare Workers, etc.):

| Job | Endpoint | Frequency | Purpose |
|-----|----------|-----------|---------|
| Shopify Sync | `POST /api/cron/sync-shopify` | Daily at 2am | Sync order data |
| Social Sync | `POST /api/cron/sync-social` | Every 4 hours | Sync social metrics |
| Compute Insights | `POST /api/cron/compute-insights` | Daily at 4am | Run correlation engine |
| Aggregate Metrics | `POST /api/cron/compute-aggregates` | Hourly | Pre-compute dashboards |

### Vercel Cron Example (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-shopify",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/sync-social",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/cron/compute-insights",
      "schedule": "0 4 * * *"
    }
  ]
}
```

---

## ENVIRONMENT VARIABLES CHECKLIST

Add these to your `.env.local` and production environment:

### Required Now
```bash
# Shopify (Phase 2)
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_WEBHOOK_SECRET=xxxxx

# Already configured
SHOPIFY_STORE_URL=https://odubostudio.myshopify.com
NEXT_PUBLIC_SHOPIFY_API_KEY=xxxxx
```

### Required for Platform Connections (Phase 3)
```bash
# YouTube
YOUTUBE_CLIENT_ID=xxxxx
YOUTUBE_CLIENT_SECRET=xxxxx

# Instagram
INSTAGRAM_APP_ID=xxxxx
INSTAGRAM_APP_SECRET=xxxxx

# TikTok (when approved)
TIKTOK_CLIENT_KEY=xxxxx
TIKTOK_CLIENT_SECRET=xxxxx

# Spotify (when approved)
SPOTIFY_CLIENT_ID=xxxxx
SPOTIFY_CLIENT_SECRET=xxxxx
```

### Required for Security
```bash
# Token encryption key (generate with: openssl rand -base64 32)
TOKEN_ENCRYPTION_KEY=xxxxx

# OAuth state signing
OAUTH_STATE_SECRET=xxxxx
```

---

## FUTURE DEVELOPMENT PHASES

### Phase 4: Streaming Analytics (To Build)
- [ ] CSV import UI and parser
- [ ] Streaming dashboard with charts
- [ ] Track performance views
- [ ] Territory breakdown map
- [ ] Playlist tracking

### Phase 5: Social Analytics (To Build)
- [ ] YouTube sync service
- [ ] Instagram sync service
- [ ] TikTok sync service (when approved)
- [ ] Social dashboard UI
- [ ] Post performance comparison

### Phase 6: Fan Intelligence (To Build)
- [ ] Fan profile creation from multiple sources
- [ ] Activity tracking across platforms
- [ ] Fan directory with search/filter
- [ ] Segment builder UI
- [ ] Fan journey visualization

### Phase 7: Correlation Engine (To Build)
- [ ] Cross-domain correlation algorithms
- [ ] Insight generation service
- [ ] Recommendation engine
- [ ] Insight cards in dashboard
- [ ] Automated alert system

---

## DATABASE MAINTENANCE

### Regular Tasks
1. **Backup D1 Database** - Export weekly via Wrangler
2. **Clean Old Sync Logs** - Delete logs older than 30 days
3. **Aggregate Old Metrics** - Roll up daily data to weekly/monthly

### Cleanup Queries
```sql
-- Delete old sync logs (keep last 30 days)
DELETE FROM sync_logs WHERE started_at < datetime('now', '-30 days');

-- Delete old system metrics (keep last 7 days)
DELETE FROM system_metrics WHERE recorded_at < datetime('now', '-7 days');
```

---

## SHOPIFY PLAN UPGRADE PATH

### Currently on Basic ($39/month)
**Limitations:**
- No customer PII (emails/addresses) via API
- No Reports API access
- 60-day order history default
- 50 pts/sec rate limit

### Upgrade to Advanced ($299/month)
**Unlocks:**
- Reports API for advanced queries
- Custom report builder
- Higher rate limits

### Upgrade to Plus ($2,000+/month)
**Unlocks:**
- Full customer PII access
- 10x API rate limits (500 pts/sec)
- Checkout customization
- Multi-store support
- Shopify Flow automation

**No code changes needed** - the architecture is designed to scale automatically.

---

## SECURITY CHECKLIST

- [ ] Enable HTTPS on all endpoints
- [ ] Store OAuth tokens encrypted (use TOKEN_ENCRYPTION_KEY)
- [ ] Verify webhook signatures
- [ ] Rate limit public endpoints
- [ ] Audit API access logs
- [ ] Rotate tokens periodically
- [ ] Set up error alerting

---

## MONITORING & ALERTS

### Recommended Setup
1. **Uptime Monitoring** - Monitor `/api/health` endpoint
2. **Error Tracking** - Use Sentry or similar
3. **Sync Failure Alerts** - Check `sync_logs` for failed status
4. **Rate Limit Warnings** - Log when approaching API limits

### Health Check Endpoint (To Create)
```
GET /api/health
Returns: { status: 'ok', database: 'connected', lastSync: '...' }
```

---

## CONTACTS & RESOURCES

### API Documentation
- [Shopify Admin API](https://shopify.dev/docs/api/admin-graphql)
- [YouTube Analytics API](https://developers.google.com/youtube/analytics)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [TikTok Creator API](https://developers.tiktok.com/doc/login-kit-web)

### Support
- Shopify Partner Support (for API issues)
- Meta Business Help (for Instagram API)
- Google Cloud Support (for YouTube API)

---

*Last Updated: January 2026*
*Platform Version: Intelligence v1.0*
