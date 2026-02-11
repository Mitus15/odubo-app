# Video MP4 URL Crisis - Root Cause & Fix

**Date:** 2026-02-11
**Severity:** CRITICAL
**Impact:** 112 out of 124 videos (90%) have incorrect MP4 URLs

---

## The Problem

### What Happened
The upload system was **silently failing** to generate Cloudflare Stream MP4 download URLs and falling back to R2 URLs without any warning or error.

### Why This is Critical
- **PostForMe REQUIRES** Cloudflare Stream MP4 download URLs
- R2 URLs don't work with PostForMe (may be MOV/AVI with .mp4 extension)
- 112 videos uploaded between Feb 7-11 have wrong URLs
- All social media deployments for these videos will fail

### Root Cause

The upload endpoint `/api/arsenal/multipart-upload` (lines 215-256) had this pattern:

```typescript
try {
  // Try to enable Stream MP4 downloads
  // ...polling logic...
} catch (error) {
  console.error('Failed to enable Stream downloads:', error);
  // Continue with R2 URL as fallback  ⚠️ SILENTLY FAILS
}
```

**The Silent Failure:**
1. Stream MP4 download generation could time out (was only 3 minutes)
2. Any errors were caught and logged but NOT propagated
3. Upload appeared to succeed but used wrong URL
4. No visible errors in the UI

---

## What I Fixed

### 1. Upload Endpoint (DONE ✅)
**File:** `src/app/api/arsenal/multipart-upload/route.ts`

**Changes:**
- ❌ Removed silent try-catch that hid errors
- ✅ Now FAILS LOUDLY if Stream MP4 download fails
- ✅ Increased timeout from 3 minutes → 5 minutes
- ✅ Added detailed logging at every step
- ✅ Throws errors that propagate to frontend

**Result:** Future uploads will FAIL if Stream MP4 URL cannot be generated (which is correct behavior - better to fail than succeed with wrong data)

### 2. Backfill Script (DONE ✅)
**File:** `scripts/backfill-stream-mp4-urls.ts`

**Changes:**
- ✅ Increased timeout from 60 seconds → 5 minutes
- ✅ Updated query to catch R2 URLs specifically
- ✅ Added progress indicators for long polls
- ✅ Better error reporting

---

## Action Plan

### Step 1: Deploy the Fix (DO THIS FIRST)
```bash
git add .
git commit -m "fix: make Stream MP4 download failures explicit, increase timeout to 5min"
git push origin main
```

Wait for Vercel deployment to complete (~2 minutes).

### Step 2: Fix ALL Affected Videos
```bash
npm run mp4:backfill
```

**What this does:**
- Finds all 112 videos with R2 URLs
- Enables Stream MP4 downloads for each
- Waits up to 5 minutes per video for generation
- Updates database with correct Stream URLs

**Time estimate:** ~10-15 minutes for all videos (runs sequentially)

**Optional - Test first:**
```bash
npm run mp4:backfill -- --dry-run --limit=5
```

### Step 3: Verify the Fix
```bash
npx tsx --env-file=.env.local scripts/audit-all-video-urls.ts
```

Should show:
- ✅ Correct URLs: 124
- ❌ Incorrect URLs: 0

### Step 4: Re-deploy Failed Videos
All videos with incorrect URLs need to be re-deployed:
1. Delete the stuck PostForMe posts (if possible)
2. Re-deploy from Arsenal
3. They will now use correct Stream MP4 URLs

---

## Prevention

### Upload Behavior Going Forward
**After this fix:**
- Upload will WAIT up to 5 minutes for Stream MP4 URL
- If generation fails or times out → **upload FAILS**
- Frontend will show error and upload can be retried
- No more silent failures with wrong URLs

### Monitoring
Check upload logs for these patterns:
- `[Arsenal Upload] Stream MP4 download ready:` ✅ Success
- `Timeout waiting for Stream MP4 download` ❌ Needs investigation
- `Failed to enable Stream downloads:` ❌ Needs investigation

### If Uploads Start Failing
If legitimate uploads start failing after this fix, it means:
1. Cloudflare Stream is having issues
2. Network connectivity problems
3. API token expired/invalid

**DO NOT** revert to silent fallback - investigate and fix the root cause.

---

## Affected Videos

### Critical Recent Uploads (Need Re-deployment)
All videos uploaded Feb 7-11 are affected, including:
- Take That (10 clips)
- Fish Out (16 clips)
- Pinnochio is in K-Town
- All other recent uploads

### Full List
Run audit script to see complete list:
```bash
npx tsx --env-file=.env.local scripts/audit-all-video-urls.ts > affected-videos.txt
```

---

## Lessons Learned

1. **Never fail silently** - Errors should be loud and visible
2. **Timeouts matter** - 3 minutes wasn't enough for large files
3. **Verify critical data** - Should have caught this in testing
4. **Monitor production** - Need better observability for uploads

---

## Testing the Fix

### Manual Test Upload
After deploying the fix:
1. Upload a test video via Arsenal
2. Check browser console / network tab
3. Wait for upload to complete (up to 5 minutes)
4. Verify video record has Stream MP4 download URL
5. Try deploying to PostForMe - should work

### Expected Behavior
- Upload progress shows "Processing..." for up to 5 minutes
- Success: Video has `https://customer-xxx.cloudflarestream.com/{uid}/downloads/default.mp4`
- Failure: Clear error message, upload can be retried

---

## Contact

If issues persist after running the backfill:
1. Check Vercel deployment logs
2. Check Cloudflare Stream dashboard
3. Verify API tokens are valid
4. Check if any videos are still stuck in "processed" status on PostForMe
