# Moments Subdomain Setup

## Overview
Moments has been moved from the master button dropdown to its own subdomain: `moments.odubo.studio`

## Changes Made

### 1. Middleware (src/middleware.ts)
- Added subdomain detection for `moments.odubo.studio`
- Rewrites `moments.odubo.studio/*` → `/moments/*` 
- Redirects `odubo.studio/moments/*` → `moments.odubo.studio/*` (production only)

### 2. Navigation Updates
- **Master Button** (`ExpandableLogoMenu.tsx`): Now redirects to subdomain instead of opening modal
- **Home Page** (`HomePageClient.tsx`): Updated auto-open logic to redirect
- **Featured Pages** (`FeaturedInteractive.tsx`): Updated RSVP/Moments button to redirect

### 3. Development Support
- Added `moments.localhost:3000` to allowed origins
- Local dev URLs work with `/moments` path
- Production uses `moments.odubo.studio` subdomain

## DNS Configuration Required

### Cloudflare DNS Setup
Add a new CNAME record in your Cloudflare dashboard:

```
Type: CNAME
Name: moments
Target: odubo.studio (or your main domain target)
Proxy status: Proxied (orange cloud)
TTL: Auto
```

### Vercel/Deployment Configuration
If using Vercel:
1. Go to your project settings
2. Navigate to "Domains"
3. Add domain: `moments.odubo.studio`
4. Vercel will provide DNS verification instructions if needed

## Testing

### Local Development
Test with either:
- `http://localhost:3000/moments` - Direct path access
- Add to `/etc/hosts`: `127.0.0.1 moments.localhost`
- Then visit: `http://moments.localhost:3000`

### Production
Once DNS is configured:
1. Visit `moments.odubo.studio` - Should show moments page
2. Click master button camera icon - Should redirect to moments subdomain
3. Visit `odubo.studio/moments` - Should redirect to subdomain

## Routes Available

All existing moments routes work under the subdomain:
- `moments.odubo.studio` - Main moments page
- `moments.odubo.studio/capture` - Capture page
- `moments.odubo.studio/gallery/[id]` - Gallery view
- `moments.odubo.studio/join` - Join page
- `moments.odubo.studio/rsvp/[id]` - RSVP page
- `moments.odubo.studio/admin` - Admin panel

## Rollback
To revert to modal-based moments:
1. Restore original `handleMoments` in `ExpandableLogoMenu.tsx`
2. Restore original switch case in `HomePageClient.tsx`
3. Remove moments subdomain logic from `middleware.ts`
