# Session Log: Clerk Auth Migration & Admin Access Fix

**Date:** May 10, 2026
**Focus:** Fix MIDDLEWARE_INVOCATION_FAILED 500 error, migrate admin auth to Clerk, resolve admin "Access Denied"

---

## Summary

Fixed the Clerk v7 integration issues, resolved the middleware 500 error, and addressed the admin "Access Denied" page. The key changes involved:

1. Fixed Clerk v7 middleware pattern (`clerkMiddleware()` must be exported directly)
2. Added proper dual-auth support (legacy JWT + Clerk) in API endpoints
3. Fixed admin page to not assume `clerkUserId` means admin
4. Added proper access denied handling in admin page

---

## Issues Found & Fixed

### 1. Clerk v7 Middleware Breaking Changes

**Problem:** `MIDDLEWARE_INVOCATION_FAILED` 500 error on Vercel.

**Root Cause:** Clerk v7 has two breaking changes:
- `clerkMiddleware()` must be exported directly as default export (cannot be stored in variable then called)
- `auth()` from `@clerk/nextjs/server` is now async and must be awaited

**Files Modified:**
- `src/middleware.ts` - Fixed to export `clerkMiddleware()` directly
- `src/app/api/admin/permissions/route.ts` - Changed `auth()` to `await auth()`
- `src/app/api/me/route.ts` - Changed `auth()` to `await auth()`

### 2. Admin Page: Incorrect Assumption that Clerk User = Admin

**Problem:** The admin page assumed any authenticated Clerk user was an admin.

**Root Cause:** In `src/app/admin/page.tsx`, lines 318-321:
```tsx
if (clerkUserId) {
  setIsAdmin(true);  // BUG: Assumes Clerk user = admin
  return;
}
```

**Fix:** 
- Renamed `isAdmin` state to `isAuthenticated` for clarity
- Now uses `isAdmin` from `usePermissions()` hook for actual authorization
- Added proper Access Denied page when authenticated but not authorized
- Loading state now waits for both auth check AND permissions check

**Files Modified:**
- `src/app/admin/page.tsx` - Complete refactor of auth/authorization logic

### 3. Dual Auth Support in APIs

**Problem:** API endpoints needed to support both legacy JWT and Clerk auth.

**Fix:** Added `checkClerkAuth()` function in both:
- `src/app/api/admin/permissions/route.ts`
- `src/app/api/me/route.ts`

Both endpoints now:
1. First check for legacy JWT token
2. If no legacy token, check for Clerk auth via `await auth()`
3. For admin check: email in `ADMIN_EMAILS` env var OR DB user with `is_admin=1`

### 4. Admin Subdomain Login Redirect Loop

**Problem:** admin.odubo.studio `/login` → middleware 404 rewrite → `/login` → middleware rewrite...

**Fix:** Middleware now redirects admin subdomain login requests to main domain:
```tsx
if (url.pathname.startsWith('/login') || 
    url.pathname.startsWith('/sign-in') || 
    url.pathname.startsWith('/sign-up')) {
  if (isProduction) {
    const loginUrl = new URL(url.pathname, `https://odubo.studio`);
    return NextResponse.redirect(loginUrl);
  }
}
```

Also updated admin page to redirect to `https://odubo.studio/login` (full URL) instead of `/login` (relative).

### 5. Clerk Webhook Graceful Handling

**Problem:** User doesn't have `CLERK_WEBHOOK_SECRET` configured.

**Fix:** Made webhook endpoint return 200 OK when secret not configured:
```tsx
if (!WEBHOOK_SECRET) {
  console.log('[Clerk Webhook] CLERK_WEBHOOK_SECRET not configured. Endpoint disabled.');
  return new Response('OK (webhook not configured)', { status: 200 });
}
```

**Files Modified:**
- `src/app/api/webhooks/clerk/route.ts`

---

## Configuration Required in Vercel

### Environment Variables Already Set (Per User)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### Environment Variables That NEED to Be Set
**CRITICAL:** `ADMIN_EMAILS` - Comma-separated list of admin emails.

Example:
```
ADMIN_EMAILS=manio@odubo.studio,admin@odubo.studio
```

This is the simplest way to grant admin access. Without this:
- The permissions API will check if there's a DB user with matching email and `is_admin=1`
- If neither exists, user gets "Access Denied"

### Env Vars Marked as Sensitive (Per User)
- `GEMINI_API_KEY`
- `CLOUDFLARE_D1_API_TOKEN`
- `SHOPIFY_CLIENT_SECRET`
- `CRON_SECRET`
- `POSTFORME_API_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `JWT_SECRET`
- `ADMIN_JWT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `DEEPSEEK_API_KEY`

---

## How Admin Access Works Now

### Authorization Flow
1. **Authentication:** User logs in via Clerk on `https://odubo.studio/login`
2. **API Permission Check:** When accessing admin dashboard:
   - `usePermissions()` hook calls `/api/admin/permissions`
   - API checks:
     a. Is email in `ADMIN_EMAILS` env var? → Admin
     b. Is there a DB user with matching email and `is_admin=1`? → Admin
     c. Otherwise → Not admin
3. **Client-Side Check:**
   - `isAuthenticated`: Is user logged in? (shows loading spinner if not)
   - `isAdmin` (from usePermissions): Does user have admin access? (shows Access Denied if not)

### Subdomain Cookie Note
Clerk session cookies from main domain (`odubo.studio`) may not be accessible on admin subdomain (`admin.odubo.studio`). 

**Solution:** Configure Clerk cookie domain in Clerk Dashboard to `.odubo.studio` (with leading dot) for cross-subdomain access.

**Workaround:** After logging in on `https://odubo.studio/login`, manually navigate to `https://admin.odubo.studio`.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/app/admin/page.tsx` | Major refactor: renamed `isAdmin` → `isAuthenticated`, now uses `isAdmin` from `usePermissions()`, added proper Access Denied page, waits for permissions loading |
| `src/middleware.ts` | Already fixed in previous work: `clerkMiddleware()` direct export, public routes include admin paths, login redirects to main domain |
| `src/app/api/admin/permissions/route.ts` | Dual auth support, `await auth()` for Clerk v7, checks `ADMIN_EMAILS` env var |
| `src/app/api/me/route.ts` | Dual auth support, `await auth()` for Clerk v7 |
| `src/app/api/webhooks/clerk/route.ts` | Graceful when `CLERK_WEBHOOK_SECRET` not set |
| `src/lib/clerkSync.ts` | Clerk auth bridge, email-based admin check (already existed) |
| `src/lib/usePermissions.ts` | Returns `isAdmin` from API (already existed, now used properly) |

---

## Next Steps

### User Action Required
1. **Set `ADMIN_EMAILS` in Vercel** (Production AND Preview):
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add: `ADMIN_EMAILS=your@email.com` (replace with actual admin email)
   - Multiple admins: `ADMIN_EMAILS=admin1@example.com,admin2@example.com`

2. **Re-deploy Vercel** to pick up code changes and new env var.

3. **Test:**
   - Go to `https://odubo.studio/login`
   - Log in with the email in `ADMIN_EMAILS`
   - Navigate to `https://admin.odubo.studio`

### Optional (Recommended)
1. **Configure Clerk Cookie Domain:**
   - Go to Clerk Dashboard → Sessions → Settings
   - Set Cookie Domain to `.odubo.studio` (with leading dot)
   - This allows session cookies to work across subdomains

2. **Set up Clerk Webhook (Optional):**
   - Go to Clerk Dashboard → Webhooks → Add Endpoint
   - URL: `https://odubo.studio/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `session.created`, `session.ended`, `user.deleted`
   - Copy the Signing Secret and add to Vercel as `CLERK_WEBHOOK_SECRET`
   - This auto-syncs Clerk users to local DB

---

## Verification Checklist

- [x] `clerkMiddleware()` exported directly (not called then exported)
- [x] `auth()` calls are awaited with `await auth()`
- [x] Public routes include `/admin(.*)`, `/api/admin(.*)`, `/login(.*)`, `/sign-in(.*)`, `/sign-up(.*)`
- [x] Admin subdomain login requests redirect to main domain
- [x] Admin page uses `isAuthenticated` for auth check, `isAdmin` from `usePermissions()` for authorization
- [x] `/api/admin/permissions` supports both legacy JWT and Clerk auth
- [x] `/api/me` supports both legacy JWT and Clerk auth
- [x] Clerk webhook returns 200 OK when secret not configured

---

## Known Issues / Limitations

1. **Subdomain Cookies:** Without Clerk cookie domain configured as `.odubo.studio`, users may need to log in again when switching between main domain and admin subdomain.

2. **No `clerk_id` DB Column:** The current implementation uses email-based matching instead of `clerk_id`. This works but is less efficient. Adding a `clerk_id` column to `users` table would be better for long-term.

3. **Webhook Optional:** The webhook is optional. Admin access works via `ADMIN_EMAILS` env var or DB `is_admin` flag without webhook.

---

## Reference: Key Clerk v7 Changes

| Clerk v6 | Clerk v7 |
|----------|----------|
| `export default authMiddleware(...)` | `export default clerkMiddleware(...)` (export directly) |
| `auth()` | `await auth()` (now async) |
| `currentUser()` | `await currentUser()` (now async) |

**Middleware Pattern (Clerk v7):**
```tsx
// CORRECT: Export directly
export default clerkMiddleware(async (auth, req) => {
  // Custom logic here
});

// WRONG: Will cause MIDDLEWARE_INVOCATION_FAILED
const middleware = clerkMiddleware(async (auth, req) => { ... });
export default middleware;
```
