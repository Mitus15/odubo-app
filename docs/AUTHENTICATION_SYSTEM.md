# Odubo Authentication & Accounts System

**Document Type:** Architecture & Implementation Plan
**Author:** CTO
**Date:** May 10, 2026
**Status:** Active

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Domain Topology](#3-domain-topology)
4. [Implementation Roadmap](#4-implementation-roadmap)
   - [Phase 1: Admin Hotfix](#phase-1-admin-hotfix)
   - [Phase 2: Legacy Cleanup](#phase-2-legacy-cleanup)
   - [Phase 3: Production Hardening](#phase-3-production-hardening)
   - [Phase 4: RBAC System](#phase-4-rbac-system)
   - [Phase 5: Unified Accounts](#phase-5-unified-accounts)
   - [Phase 6: Testing & Quality](#phase-6-testing--quality)
   - [Phase 7: Documentation](#phase-7-documentation)
5. [Technical Reference](#5-technical-reference)
6. [Technical Debt Register](#6-technical-debt-register)
7. [Architecture Decision Records](#7-architecture-decision-records)

---

## 1. Executive Summary

### Vision
A single identity powers all Odubo Studio experiences — admin dashboard, store, moments gallery, media hub, and future applications — with proper role-based access control, seamless cross-domain sessions, and a scalable architecture.

### Principles
- **One account, many experiences** — Authenticate once, roam freely
- **Role-based, not binary** — Beyond admin/not-admin with fine-grained permissions
- **Clerk-first** — Clerk handles auth complexity; we handle business logic
- **Clean boundaries** — Auth system provides APIs consumed by applications
- **Future-proof** — Supports multi-tenant, API keys, and embedded SSO

### Current State
Two parallel auth systems (Clerk + legacy JWT) with incomplete migration, missing production configuration, and orphaned code.

### Target State
Single Clerk-powered auth system with proper RBAC, cross-domain sessions, and a clean codebase.

---

## 2. Architecture Overview

```
                        ┌─────────────────────┐
                        │    Clerk Dashboard   │
                        │  (User Mgmt, Config) │
                        └──────┬──────────────┘
                               │ SDK
                               ▼
┌─────────────────────────────────────────────────┐
│              clerkMiddleware (middleware.ts)      │
│  - Protects routes                                │
│  - Handles subdomain routing                      │
│  - Configures satellite domains                   │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│              ClerkProvider (layout.tsx)            │
│  - Auth context for the entire app                 │
│  - Wraps all pages                                 │
└────────────────────┬─────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│  Public Routes   │   │  Protected Routes │
│  (store, clips,  │   │  (admin, account) │
│   music, etc.)   │   └────────┬─────────┘
└──────────────────┘            │
                                ▼
                    ┌──────────────────────┐
                    │   Admin Dashboard    │
                    │  ┌────────────────┐  │
                    │  │ clerkSync.ts   │  │
                    │  │ (Clerk ↔ DB)   │  │
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ usePermissions │  │
                    │  │ (RBAC hook)    │  │
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ UserProvider   │  │
                    │  │ (session data) │  │
                    │  └────────────────┘  │
                    └──────────────────────┘

```

### Key Components

| Component | Role | Status |
|-----------|------|--------|
| Clerk Dashboard | Auth provider, user management, configuration | External |
| `clerkMiddleware()` | Route protection, subdomain routing, satellite config | ✅ Done |
| `ClerkProvider` | Client-side auth context for all pages | ✅ Done |
| `clerkSync.ts` | Syncs Clerk users to local D1 database | ✅ Done |
| `usePermissions()` | Client hook for RBAC, section-based access control | ✅ Done |
| `auth()` (server) | Server-side auth check for API routes and server components | ✅ Done |
| `useAuth()` (client) | Client-side auth state hook | ✅ Done |
| Legacy `auth.ts` | Deprecated JWT auth library | ❌ Needs removal |
| Legacy `AuthContext.tsx` | Deprecated auth context | ❌ Needs removal |

### Auth Flow: Admin Access

```
User visits odubo.studio/sign-in
  → Clerk handles authentication
  → Session cookie set for odubo.studio

User navigates to odubo.studio/admin
  → Middleware detects /admin path
  → Rewrites to serve admin content on main domain
  (OR if direct to admin.odubo.studio:)
  → Middleware detects admin subdomain
  → Applies satellite domain Clerk config
  → Rewrites /admin/content paths
  → Routes to admin page

Admin page loads
  → ClerkProvider establishes session
  → useAuth() returns userId
  → UserProvider fetches /api/me (user profile)
  → usePermissions() fetches /api/admin/permissions
  → canAccess() controls what sections render
  → TabContent renders based on permissions
```

---

## 3. Domain Topology

```
                        ┌─────────────────┐
                        │   Clerk Cloud    │
                        │  (Auth Source)   │
                        └────────┬────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   odubo.studio   │  │admin.odubo.studio│  │moments.odubo.stu.│
│   (PRIMARY)      │  │  (SATELLITE)     │  │  (SATELLITE)     │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ - Main site      │  │ - Admin dashboard│  │ - Photo galleries│
│ - Store          │  │ - Content mgmt   │  │ - Event pages    │
│ - Music          │  │ - User mgmt      │  │ - RSVPs          │
│ - Clips/feed     │  │ - Analytics      │  │                  │
│ - Media hub      │  │                  │  │                  │
│ ✓ SIGN-IN PAGE  │  │  (no sign-in)    │  │  (no sign-in)    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Cookie Strategy
- Primary domain (`odubo.studio`) owns the session
- Satellite domains (`admin.odubo.studio`, `moments.odubo.studio`) read session from primary
- Clerk's satellite domain feature handles the cross-domain handshake
- No custom cookie domain configuration needed (Clerk handles it)

### Clerk Configuration

**Clerk Dashboard → Domains:**
```
Primary Domain: odubo.studio
Satellite Domains:
  - admin.odubo.studio
  - moments.odubo.studio
```

**Allowed Origins (Clerk Dashboard → Sessions → Settings):**
```
- https://odubo.studio
- https://admin.odubo.studio
- https://moments.odubo.studio
```

**Middleware Configuration (dynamic, based on host):**
```typescript
// For admin.odubo.studio and moments.odubo.studio:
{
  isSatellite: true,
  domain: 'odubo.studio',
  signInUrl: 'https://odubo.studio/sign-in',
  signUpUrl: 'https://odubo.studio/sign-up',
}

// For odubo.studio (primary):
// default Clerk behavior (no satellite config needed)
```
*See `src/middleware.ts` → `getClerkMiddlewareOptions()`*

### Middleware Routing Rules

| Request | Rule | Result |
|---------|------|--------|
| `odubo.studio/admin` | Redirect to admin subdomain | `→ admin.odubo.studio` |
| `odubo.studio/moments` | Redirect to moments subdomain | `→ moments.odubo.studio` |
| `admin.odubo.studio/*` | Rewrite to `/admin/*` | Internal routing |
| `admin.odubo.studio/login` | Redirect to main domain login | `→ odubo.studio/login` |
| `admin.odubo.studio/sign-in` | Redirect to main domain | `→ odubo.studio/sign-in` |
| `admin.odubo.studio/_next/*` | Pass through | Static assets |
| `admin.odubo.studio/api/*` | Pass through | API routes |

---

## 4. Implementation Roadmap

---

### Phase 1: Admin Hotfix

**Goal:** Get admin working end-to-end with production Clerk keys and proper cross-subdomain sessions.
**Priority:** Critical
**Estimated effort:** 2-3 hours
**Dependencies:** Clerk Dashboard access, Vercel access

#### Tasks

##### 1.1 Obtain Production Clerk Keys
| Attribute | Detail |
|-----------|--------|
| Story | As system admin, I need production Clerk API keys so the app works securely in production |
| Effort | 10 min |
| Acceptance | Console no longer shows "Clerk has been loaded with development keys" |

**Current state:** ⚠️ Development keys (`pk_test_...`, `sk_test_...`) in Vercel

**Do this:**
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **API Keys** (left sidebar)
4. Toggle **"Production"** at the top of the page
5. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts `pk_live_...`)
6. Copy `CLERK_SECRET_KEY` (starts `sk_live_...`)

---

##### 1.2 Update Vercel Environment Variables
| Attribute | Detail |
|-----------|--------|
| Story | As system admin, I want Clerk keys deployed to production so the app authenticates correctly |
| Effort | 5 min |
| Acceptance | Vercel has production Clerk keys |

**Do this:**
```bash
# Add production publishable key
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
# Paste pk_live_... value

# Add production secret key  
vercel env add CLERK_SECRET_KEY production
# Paste sk_live_... value

# Also add to preview environment
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY preview
vercel env add CLERK_SECRET_KEY preview
```

---

##### 1.3 Configure Clerk Dashboard for Production
| Attribute | Detail |
|-----------|--------|
| Story | As system admin, I want Clerk configured for my production domains so sessions work across subdomains |
| Effort | 10 min |
| Acceptance | Sessions persist across odubo.studio, admin.odubo.studio, and moments.odubo.studio |

**In Clerk Dashboard:**

**Domains:**
1. Navigate to **Domains** in Clerk Dashboard
2. Ensure `odubo.studio` is added as the **Primary Domain**
3. Add `admin.odubo.studio` as a **Satellite Domain**
4. Add `moments.odubo.studio` as a **Satellite Domain**

**Sessions & Allowed Origins:**
1. Navigate to **Sessions → Settings**
2. Add these to **Allowed Redirect Origins:**
   - `https://odubo.studio`
   - `https://admin.odubo.studio`
   - `https://moments.odubo.studio`
3. Add these to **Allowed Origins:**
   - `https://odubo.studio`
   - `https://admin.odubo.studio`
   - `https://moments.odubo.studio`

**Verify:**
- Custom domain DNS is configured and verified
- Production SMTP is configured for email sending

---

##### 1.4 Re-deploy & Verify
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want to log in and access the admin dashboard so I can manage my site |
| Effort | 10 min |
| Acceptance | End-to-end login to admin works seamlessly |

**Do this:**
1. Push to main (auto-deploys Vercel):
   ```bash
   git push origin main
   ```
2. Wait ~2 minutes for deployment
3. Test:
   - Visit `https://odubo.studio/sign-in`
   - Sign in with `maniodubo@gmail.com`
   - Navigate to `https://admin.odubo.studio`
   - Admin dashboard should load with full permissions
   - All navigation sections should render
4. Verify no errors in browser console

**If it doesn't work, check:**
- [ ] Clerk Dashboard shows production keys (not test)
- [ ] Vercel has production keys (not test)
- [ ] Vercel re-deployed (check Vercel dashboard for latest deployment)
- [ ] Browser has no cached service worker (hard refresh or incognito)

---

##### 1.5 Fix Remaining Admin API Routes for Clerk Auth
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want all admin API routes to recognize my Clerk session so I can manage roles and users |
| Effort | 2-3 hours |
| Files | `src/app/api/admin/roles/route.ts`, `src/app/api/admin/user-roles/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/invite/route.ts` |
| Acceptance | All admin API routes work with Clerk auth |

**Current problem:** Admin API routes only check legacy JWT auth via `getUserFromRequest()`. Since the legacy system is dead, these routes return 403 to everyone.

**Do this:**
1. Audit all `/api/admin/*` routes for their auth method
2. Add Clerk auth fallback using `await auth()` from `@clerk/nextjs/server`
3. Create a shared `checkAdminAuth()` utility function
4. Test each route with Clerk session

**Route inventory:**

| Route | Auth Check | Clerk Status | Action |
|-------|-----------|-------------|--------|
| `GET /api/admin/permissions` | Legacy + Clerk | ✅ Working | No change needed |
| `GET /api/admin/roles` | Legacy only | ❌ Broken | Add Clerk auth |
| `GET /api/admin/user-roles` | Legacy only | ❌ Broken | Add Clerk auth |
| `POST /api/admin/user-roles` | Legacy only | ❌ Broken | Add Clerk auth |
| `DELETE /api/admin/user-roles` | Legacy only | ❌ Broken | Add Clerk auth |
| `GET /api/admin/users` | Legacy only | ❌ Broken | Add Clerk auth |
| `PATCH /api/admin/users` | Legacy only | ❌ Broken | Add Clerk auth |
| `POST /api/admin/invite` | Legacy only | ❌ Broken | Add Clerk auth |
| `GET /api/me` | Legacy + Clerk | ✅ Working | No change needed |

---

### Phase 2: Legacy Cleanup

**Goal:** Remove the dead legacy JWT auth system entirely.
**Priority:** High
**Estimated effort:** 4-6 hours
**Dependencies:** Phase 1 complete

#### Tasks

##### 2.1 Centralize Auth Helpers
| Attribute | Detail |
|-----------|--------|
| Story | As developer, I want a single source of truth for auth helpers so the codebase is maintainable |
| Files | `src/lib/adminAuth.ts` (new), `src/clerkSync.ts` |
| Acceptance | No duplicated `isEmailInAdminList()` or `checkClerkAuth()` functions |

**Do this:**
1. Create `src/lib/adminAuth.ts` with:
   - `getCurrentUser()` — wraps `await auth()` from Clerk
   - `isCurrentUserAdmin()` — centralized admin check
   - `isEmailInAdminList(email)` — shared function
   - Returns typed `{ userId, email, isAdmin, roles }` object

```typescript
// src/lib/adminAuth.ts
import { auth } from '@clerk/nextjs/server';
import { getUserByEmail } from '@/lib/db';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export function isEmailInAdminList(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function getCurrentUser() {
  const authResult = await auth();
  const userId = authResult.userId;
  if (!userId) return null;
  
  const email = authResult.user?.emailAddresses?.[0]?.emailAddress;
  if (!email) return { userId, email: null, isAdmin: false, roles: [] };
  
  let dbUser = null;
  try { dbUser = await getUserByEmail(email); } catch {}
  
  const isAdmin = isEmailInAdminList(email) || dbUser?.is_admin === true || dbUser?.is_admin === 1;
  
  return { userId, email, isAdmin, roles: [] };
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.isAdmin ?? false;
}
```

2. Replace all inline `isEmailInAdminList()` calls with shared import
3. Update all admin API routes to use `isCurrentUserAdmin()`

---

##### 2.2 Remove Legacy JWT Library
| Attribute | Detail |
|-----------|--------|
| Story | As developer, I want the legacy JWT auth code removed so there's no confusion about which auth system is active |
| Files | `src/lib/auth.ts` |
| Acceptance | No remaining references to `getUserFromRequest()` or `isAdminUser()` from legacy auth |

**Do this:**
1. Review all imports of `getUserFromRequest`, `isAdminUser`, `createToken`, `verifyUserFromRequest`
2. Replace with Clerk equivalents
3. Remove `src/lib/auth.ts`
4. Remove `jose` dependency from `package.json`

**Files that import from `src/lib/auth.ts`:**
- `src/app/api/admin/permissions/route.ts` — uses `getUserFromRequest`, `isAdminUser`
- `src/app/api/me/route.ts` — uses `getUserFromRequest`
- Various `/api/admin/*` routes
- Any other files found during scan

---

##### 2.3 Remove AuthContext
| Attribute | Detail |
|-----------|--------|
| Story | As developer, I want the dead AuthContext removed so the component tree is clean |
| Effort | 1 hour |
| Acceptance | No remaining code references to `AuthContext` |

**Do this:**
1. Remove `src/contexts/AuthContext.tsx` (already commented out in layout)
2. Fix orphaned imports in:
   - `src/components/OrderHistory.tsx`
   - `src/components/UserRightsManager.tsx`
   - Any archived files referencing it
3. Replace with Clerk hooks (`useAuth`, `useUser`) where needed

**Note:** `UserRightsManager.tsx` is in the active `src/components/` directory and must be fixed. `OrderHistory.tsx` can use Clerk's `useUser()` hook if auth is needed.

---

##### 2.4 Clean Up Configuration
| Attribute | Detail |
|-----------|--------|
| Story | As developer, I want env vars and configuration cleaned up so the project is maintainable |
| Effort | 30 min |
| Acceptance | Legacy env vars removed, example file updated |

**Do this:**
1. Remove `JWT_SECRET` and `ADMIN_JWT_SECRET` from `.env.example`
2. Remove legacy vars from Vercel if they exist
3. Update `.env.example` to reflect Clerk-only configuration
4. Update any documentation referencing legacy auth

---

### Phase 3: Production Hardening

**Goal:** Make the admin auth system production-ready with proper security, error handling, and reliability.
**Priority:** High
**Estimated effort:** 3-5 days
**Dependencies:** Phase 2 complete

#### Tasks

##### 3.1 Add Auth Guard to Admin Layout
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want the admin layout to not render until auth resolves so I never see an empty shell |
| Effort | 4 hours |
| Files | `src/app/admin/layout.tsx` |
| Acceptance | Admin layout never renders for unauthorized users |

**Do this:**
```typescript
// src/app/admin/layout.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/lib/adminAuth';

export default async function AdminLayout({ children }) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) redirect('https://odubo.studio');
  
  return <ToastProvider>{children}</ToastProvider>;
}
```

This provides a **server-side auth guard** so unauthorized users never even see the admin page shell.

---

##### 3.2 Add clerk_id to Database Schema
| Attribute | Detail |
|-----------|--------|
| Story | As developer, I want users identified by Clerk ID natively in the database so lookups are efficient |
| Effort | 2 hours |
| Files | `database/schema.sql`, `database/migrations/`, `src/lib/db.ts` |
| Acceptance | Users can be looked up by Clerk ID |

**Do this:**
1. Confirm `clerk_id` column exists (it's referenced in `clerkSync.ts`)
2. If it exists, add it to `database/schema.sql` for documentation
3. If it doesn't exist, create a migration:
   ```sql
   ALTER TABLE users ADD COLUMN clerk_id TEXT;
   CREATE INDEX idx_users_clerk_id ON users(clerk_id);
   ```
4. Update `User` type in `src/lib/db.ts` to include `clerk_id`
5. Backfill existing users via webhook or manual migration

---

##### 3.3 Configure Clerk Webhook
| Attribute | Detail |
|-----------|--------|
| Story | As system admin, I want user accounts to sync automatically between Clerk and the local database |
| Effort | 1 hour |
| Acceptance | New Clerk users auto-sync to local `users` table |

**Do this:**
1. In Clerk Dashboard → **Webhooks**:
   - Add endpoint: `https://odubo.studio/api/webhooks/clerk`
   - Subscribe to events: `user.created`, `user.updated`, `session.created`, `session.ended`, `user.deleted`
   - Copy the **Signing Secret**
2. Add to Vercel:
   ```bash
   vercel env add CLERK_WEBHOOK_SECRET production
   ```
3. Verify webhook fires correctly by creating a test user

---

##### 3.4 Admin Page UX Improvements
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want clear loading states and error handling so I know what's happening |
| Effort | 4 hours |
| Files | `src/app/admin/page.tsx` |
| Acceptance | Smooth loading UX with clear feedback |

**Do this:**
1. Improve loading state (skeleton UI vs spinner)
2. Handle edge cases:
   - Network failure on permission fetch
   - Expired session during use
   - Permission denied (differentiate from not authenticated)
3. Add retry button on failed permission fetch
4. Proper error boundaries for admin tabs

---

##### 3.5 Admin Logout
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want to securely log out of the admin dashboard |
| Effort | 2 hours |
| Files | `src/app/admin/page.tsx` |
| Acceptance | Logout clears session and redirects appropriately |

**Do this:**
1. Implement Clerk `signOut()` in admin footer
2. Clear cached session data (`sessionStorage`)
3. Redirect to main site with `{ redirectUrl: 'https://odubo.studio' }`
4. Verify no session persistence after logout

---

### Phase 4: RBAC System

**Goal:** Build a proper role-based access control system with user and role management UIs.
**Priority:** Medium
**Estimated effort:** 2-3 weeks
**Dependencies:** Phases 1-3 complete

#### Tasks

##### 4.1 Build User Management UI
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want to see all users and manage their roles from the admin dashboard |
| UI Tab | "Users" in System section |
| Acceptance | Admins can view, invite, and manage users |

**Requirements:**
- User listing with search and pagination
- User detail view: email, name, roles, last login, status
- Invite user form (email-based)
- User deactivation/reactivation
- Display user's Clerk ID, auth provider, and status

**UI Components:**
- `<UsersTable />` — sortable, filterable table
- `<UserDetailModal />` — full user info drawer
- `<InviteUserForm />` — email invite form
- `<UserStatusBadge />` — active/inactive indicator

**API Dependencies:**
- `PATCH /api/admin/users/:id` — update user (role, status)
- `DELETE /api/admin/users/:id` — remove user (soft delete)
- `POST /api/admin/invite` — create invite (exists, needs Clerk fix)

---

##### 4.2 Build Role Management UI
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want to create, edit, and assign roles with specific section permissions |
| UI Tab | "Roles" in System section |
| Acceptance | Admins can create, edit, delete roles and assign them to users |

**Requirements:**
- Role listing with permissions summary
- Role editor: name, description, section permissions (checkboxes)
- User-to-role assignment (multi-select)
- System roles cannot be deleted or renamed
- Permission visualization (what sections each role covers)

**Data Model (current):**
```sql
-- admin_roles: id, name, display_name, description, sections (JSON array), color, is_system
-- admin_user_roles: user_id, role_id (unique constraint)
```

**UI Components:**
- `<RolesTable />` — listing with permission badges
- `<RoleEditorModal />` — create/edit role with permission checkboxes
- `<UserRoleAssignment />` — transfer list for assigning roles to users

**API Dependencies:**
- `POST /api/admin/roles` — create role (new endpoint)
- `PUT /api/admin/roles/:id` — update role (new endpoint)
- `DELETE /api/admin/roles/:id` — delete role (new endpoint)

---

##### 4.3 Permission Visualization
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want to see my permissions clearly in the UI |
| Effort | 2 days |
| Acceptance | Users can see what they have access to |

**Requirements:**
- Permission summary card on dashboard
- Each section shows whether user has access
- Navigation only shows accessible sections
- Clear messaging for restricted areas (not just "Access Denied")

---

##### 4.4 Audit Trail
| Attribute | Detail |
|-----------|--------|
| Story | As business owner, I want to see who changed what permissions |
| Effort | 3 days |
| Acceptance | All permission changes are logged and viewable |

**Database:**
```sql
CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  metadata TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Actions: role_assigned, role_revoked, admin_granted, admin_revoked,
--          user_created, user_deactivated, user_activated, invite_sent
```

**UI:**
- `<AuditLogViewer />` — filterable by action, user, date range
- `<AuditLogDetail />` — full metadata view

---

##### 4.5 Admin Notifications
| Attribute | Detail |
|-----------|--------|
| Story | As admin, I want to be notified when permissions change |
| Effort | 2 days |
| Acceptance | Admins are notified of important auth events |

**Events to notify:**
- Role assigned/revoked
- Admin access granted/revoked
- New user signed up
- New admin accepted invite

---

### Phase 5: Unified Accounts

**Goal:** A single account that works across all Odubo properties with profile management and future SSO.
**Priority:** Medium
**Estimated effort:** 3-4 weeks
**Dependencies:** Phases 1-4 complete

#### Tasks

##### 5.1 Session Architecture for All Subdomains
| Attribute | Detail |
|-----------|--------|
| Story | As user, I want one session that works across all Odubo subdomains |
| Effort | 2 days |
| Acceptance | Users authenticated on any subdomain are authenticated on all |

**Do this:**
1. Audit all subdomains: main, admin, moments, future (account, api)
2. Ensure every subdomain that needs auth has Clerk satellite config
3. Test cross-subdomain session persistence
4. Handle edge cases: first visit, expired session, private browsing

---

##### 5.2 Account Portal
| Attribute | Detail |
|-----------|--------|
| Story | As user, I want to manage my profile, preferences, and account settings |
| Effort | 2 weeks |
| Acceptance | Users can manage their account from one place |

**Pages:**
- Profile: name, email, avatar
- Security: password change, 2FA, linked accounts
- Preferences: notifications, privacy, language
- Subscription: plan, billing, history
- Orders: order history, downloads

**Location options:**
- `account.odubo.studio` — dedicated subdomain
- `/account` — path on main site

---

##### 5.3 Multi-Tenant Architecture (Design Phase)
| Attribute | Detail |
|-----------|--------|
| Story | As architect, I want the auth system to support future multi-tenant needs |
| Effort | 1 week (design only) |
| Acceptance | Design document exists, architecture supports tenancy |

**Evaluate:**
- Clerk Organizations feature for built-in multi-tenant
- Data model for organizations, teams, memberships
- Role scoping (org-level vs global roles)
- Personal vs business account separation

**Decision needed:** Implement multi-tenant or defer to future.

---

##### 5.4 API Key System (Design Phase)
| Attribute | Detail |
|-----------|--------|
| Story | As a developer, I want API keys to integrate with Odubo services |
| Effort | 1 week (design only) |
| Acceptance | Design document exists for API key system |

**Evaluate:**
- API key generation and hashing
- Scoped permissions per key
- Rate limiting per key
- Key rotation and revocation
- Usage tracking and quotas

---

### Phase 6: Testing & Quality

**Goal:** Comprehensive test coverage for the auth system.
**Priority:** High
**Estimated effort:** 1-2 weeks
**Dependencies:** Phases 1-2 complete (can start in parallel)

#### Tasks

##### 6.1 Unit Tests: Auth Helpers
- Test `isEmailInAdminList()` with various inputs
- Test `getCurrentUser()` with mocked Clerk auth
- Test `isCurrentUserAdmin()` with mocked responses

##### 6.2 Unit Tests: Permission API
- Authenticated admin → `sections: ['*']`
- Authenticated non-admin → limited sections
- Unauthenticated → `isAdmin: false`
- Unknown email in `ADMIN_EMAILS` → admin
- DB user with `is_admin=1` → admin

##### 6.3 Unit Tests: Middleware
- Route public vs protected
- Subdomain redirect rules
- Satellite domain config applied correctly
- Auth protect called for protected routes

##### 6.4 Integration Tests: Admin API Routes
- All routes return correct status with Clerk auth
- All routes return 403 without Clerk auth
- Role CRUD operations work correctly

##### 6.5 E2E Tests: Auth Flows (Playwright)
- Sign-in → admin access
- Sign-in → store access (no admin)
- Sign-out clears session
- Session persistence across subdomains
- Role-based UI rendering

---

### Phase 7: Documentation

**Goal:** Comprehensive documentation of the auth system.
**Priority:** Low
**Estimated effort:** 2-3 days
**Dependencies:** All phases

#### Tasks

##### 7.1 Architecture Document
- System architecture diagram
- Auth flow documentation
- Data model documentation
- Configuration guide

##### 7.2 Admin Onboarding Guide
- How to grant admin access
- How to use role management
- How to configure Clerk settings
- Troubleshooting common issues

##### 7.3 Developer Runbook
- How to add a protected API route
- How to add a new permission section
- How to configure a new satellite domain
- How to debug auth issues
- How to test auth changes

---

## 5. Technical Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key (pk_live_... in production) |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key (sk_live_... in production) |
| `CLERK_WEBHOOK_SECRET` | Optional | Clerk webhook signing secret |
| `ADMIN_EMAILS` | ✅ | Comma-separated list of admin emails |

### Key Files Reference

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Route protection, subdomain routing, satellite config |
| `src/app/layout.tsx` | Root layout with ClerkProvider |
| `src/app/(auth)/layout.tsx` | Auth layout with ClerkProvider (dark theme) |
| `src/app/admin/layout.tsx` | Admin layout (needs auth guard) |
| `src/app/admin/page.tsx` | Admin dashboard page |
| `src/lib/clerkSync.ts` | Clerk-to-DB user sync bridge |
| `src/lib/adminAuth.ts` | **NOT YET CREATED** - centralized auth helpers |
| `src/lib/usePermissions.ts` | Client hook for RBAC |
| `src/app/api/admin/permissions/route.ts` | Permission check API |
| `src/app/api/me/route.ts` | Current user profile API |
| `src/app/api/webhooks/clerk/route.ts` | Clerk webhook handler |

### Database Schema (Auth-related)

```sql
-- Core user table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'viewer',           -- admin/editor/viewer
  is_admin BOOLEAN DEFAULT FALSE,       -- Quick admin flag
  clerk_id TEXT,                        -- Clerk user ID (verify migration)
  avatar_url TEXT,
  avatar_key TEXT,
  auth_provider TEXT DEFAULT 'email',    -- email/google/spotify/apple
  auth_provider_id TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  subscription_tier TEXT DEFAULT 'free', -- free/premium/studio/enterprise
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin roles (section-based permissions)
CREATE TABLE admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  sections TEXT NOT NULL,               -- JSON array of section IDs
  color TEXT DEFAULT '#843c2d',
  is_system INTEGER DEFAULT 0,          -- System roles cannot be deleted
  created_at TEXT DEFAULT (datetime('now'))
);

-- Junction table linking users to roles
CREATE TABLE admin_user_roles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  assigned_by TEXT,
  assigned_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, role_id)
);

-- Admin invite tracking
CREATE TABLE admin_invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  invited_by TEXT,
  accepted_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
```

### Permission Sections

```typescript
// Parent sections (sidebar categories)
type SectionParent = 'cms' | 'social' | 'commerce' | 'marketing' | 'analytics' | 'system';

// Child sections (individual pages/tools)
type SectionChild =
  | 'overview'
  | 'music-library' | 'video-library' | 'moments' | 'featured' | 'linktree' | 'live'
  | 'social-posts' | 'social-accounts' | 'social-analytics'
  | 'products' | 'orders' | 'customers' | 'discounts' | 'store-settings'
  | 'campaigns'
  | 'analytics-overview' | 'analytics-music' | 'analytics-video' | 'analytics-moments'
  | 'analytics-customers' | 'analytics-reports'
  | 'users' | 'database' | 'storage' | 'api-keys';

// Full access wildcard
const FULL_ACCESS = ['*'];
```

### Seeded Roles

| ID | Name | Display Name | Sections |
|----|------|-------------|----------|
| `role_admin` | admin | Admin | `["*"]` |
| `role_social` | social_manager | Social Manager | `["overview", "social", "marketing", "analytics"]` |
| `role_content` | content_editor | Content Editor | `["overview", "cms", "analytics"]` |
| `role_store` | store_manager | Store Manager | `["overview", "commerce", "analytics"]` |

---

## 6. Technical Debt Register

| ID | Description | Severity | Phase | Status |
|----|-------------|----------|-------|--------|
| TD-1 | `/api/admin/*` routes only check legacy JWT, not Clerk | Critical | 1.5 | 🔴 Open |
| TD-2 | `isEmailInAdminList()` duplicated across 4+ files | High | 2.1 | 🔴 Open |
| TD-3 | `AuthContext` orphaned imports in OrderHistory, UserRightsManager | High | 2.3 | 🔴 Open |
| TD-4 | `clerk_id` column not documented in `schema.sql` | High | 3.2 | 🔴 Open |
| TD-5 | No auth guard in admin layout | Medium | 3.1 | 🔴 Open |
| TD-6 | Admin page assumed `clerkUserId` means admin **(FIXED)** | Critical | — | ✅ Closed |
| TD-7 | No production Clerk keys in Vercel **(PARTIALLY FIXED)** | Critical | 1.1 | 🟡 Needs live keys |
| TD-8 | Clerk Dashboard not configured for satellite domains | Critical | 1.3 | 🔴 Open |
| TD-9 | `auth()` not awaited in Clerk v7 **(FIXED)** | Critical | — | ✅ Closed |
| TD-10 | `/admin` routes public in middleware **(FIXED)** | Critical | — | ✅ Closed |
| TD-11 | Legacy JWT library (`src/lib/auth.ts`) still active | High | 2.2 | 🔴 Open |
| TD-12 | Legacy JWT env vars (`JWT_SECRET`, `ADMIN_JWT_SECRET`) still configured | Low | 2.4 | 🔴 Open |
| TD-13 | No webhook configured for user sync | Medium | 3.3 | 🔴 Open |
| TD-14 | No tests for auth/permissions system | High | 6 | 🔴 Open |

---

## 7. Architecture Decision Records

### ADR-1: Clerk vs Self-Contained Auth

**Context:** Two parallel auth systems causing confusion and maintenance burden.

**Decision:** Keep Clerk, eliminate legacy JWT.

**Rationale:**
- Clerk handles session management, MFA, OAuth, password hashing, rate limiting
- Building self-contained would require re-implementing all of the above
- Clerk's satellite domain feature solves cross-subdomain session sharing natively
- Clerk Organizations provides built-in multi-tenant support (future)
- Cost is reasonable for a production application

**Trade-offs:**
- Vendor dependency (mitigation: production SLA)
- Cost scales with active users (mitigation: Clerk's generous free tier)
- Less control over auth UX (mitigation: Clerk supports custom UI)

**Status:** Accepted ✅

---

### ADR-2: Satellite Domain Architecture

**Context:** The application spans multiple subdomains that need shared authentication.

**Decision:** Use Clerk's satellite domain feature with `odubo.studio` as primary domain.

**Rationale:**
- No custom cookie domain configuration needed
- Clerk handles the cross-domain handshake
- Clean separation of concerns: primary handles auth, satellites consume
- Scales to any number of subdomains

**Status:** Accepted ✅ *(code implemented, Clerk Dashboard config pending)*

---

### ADR-3: API Route Auth Pattern

**Context:** All protected API routes need consistent auth checking.

**Decision:** Create a shared utility `checkAdminAuth()` that:
1. Checks for Clerk session via `await auth()`
2. Checks `ADMIN_EMAILS` env var
3. Checks DB `is_admin` flag
4. Checks `admin_user_roles` for section-based permissions

**Rationale:**
- Single source of truth for auth logic
- Consistent behavior across all routes
- Easy to extend for future auth methods

**Status:** Proposed 📝

---

### ADR-4: Section-Based vs Action-Based Permissions

**Context:** What granularity should the permission system use?

**Decision:** Section-based (what areas can you access) rather than action-based (what can you do in each area).

**Current model:** Each role has a `sections` JSON array (`["cms", "social", ...]`) or `["*"]` for full access.

**Rationale:**
- Simpler to manage than per-action permissions
- Matches the sidebar navigation structure
- Sufficient for current team sizes (1-10 people)
- Can be extended to action-based if needed

**Future consideration:** Add `permissions` column to `admin_roles` for action-level granularity (create, read, update, delete).

**Status:** Accepted ✅

---

### ADR-5: Clerk Webhook Strategy

**Context:** User data exists in both Clerk and the local D1 database.

**Decision:** Use Clerk webhooks for automatic synchronization, but don't require them for core functionality.

**How it works:**
- Webhook syncs: user.created, user.updated → upsert local user
- Webhook syncs: session.created, session.ended → log activity
- Fallback: If webhook is down, users are created on first API call via `clerkSync.ts`

**Rationale:**
- Resilience: auth works even without webhook
- Simplicity: webhook is optional during setup
- Eventually consistent: webhook fills gaps, API calls handle real-time

**Status:** Accepted ✅

---

## Appendix: Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-05-10 | CTO | Initial document creation |
| | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | |
