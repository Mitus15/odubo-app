# Product Backlog: Authentication & Accounts System

**Owner:** CTO
**Updated:** May 10, 2026
**Status:** Active

---

## Vision Statement

A unified authentication and accounts platform where a single identity powers all Odubo Studio experiences — admin dashboard, store, moments gallery, media hub, and future applications — with proper role-based access control, seamless cross-domain sessions, and a scalable architecture that grows with the business.

### Guiding Principles
- **One account, many experiences** — Users authenticate once and roam freely across all Odubo properties
- **Role-based, not binary** — Beyond admin/not-admin, with fine-grained permission control
- **Clerk-first** — Clerk handles auth complexity; we handle business logic
- **Clean boundaries** — Auth system provides APIs consumed by applications; apps don't implement auth
- **Future-proof** — Architecture supports multi-tenant, API keys, and embedded SSO

---

## Epic 1: 🔥 Admin Access Hotfix — Get Admin Working NOW

**Status:** In Progress
**Priority:** Critical
**Story:** "As CEO/Admin, I want to log into the admin dashboard so I can manage content."

### Tasks

#### 1.1 Obtain Production Clerk Keys
**Story:** "As system admin, I need production Clerk API keys so the app works securely in production."
- [ ] Go to Clerk Dashboard → API Keys → Toggle "Production"
- [ ] Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts `pk_live_...`)
- [ ] Copy `CLERK_SECRET_KEY` (starts `sk_live_...`)
- [ ] Update Vercel environment variables with these values
- [ ] Re-deploy Vercel project
- **Acceptance:** Console no longer shows "Clerk has been loaded with development keys"

#### 1.2 Configure Clerk Dashboard for Production
**Story:** "As system admin, I want Clerk configured for my production domains so sessions work correctly."
- [ ] Set `odubo.studio` as Primary Domain in Clerk Dashboard → Domains
- [ ] Add `admin.odubo.studio` as Satellite Domain
- [ ] Add `moments.odubo.studio` as Satellite Domain
- [ ] Add all domains to **Allowed Redirect Origins** and **Allowed Origins**
- [ ] Configure custom domain/SMTP if needed
- **Acceptance:** Sessions persist across odubo.studio, admin.odubo.studio, and moments.odubo.studio

#### 1.3 Verify Admin Login Flow
**Story:** "As CEO, I want to log in and access the admin dashboard so I can manage my site."
- [ ] Sign in at `odubo.studio/sign-in` with `maniodubo@gmail.com`
- [ ] Navigate to `admin.odubo.studio`
- [ ] Verify admin dashboard loads with full permissions
- [ ] Verify navigation sections render correctly
- [ ] Verify "Access Denied" does NOT appear
- **Acceptance:** End-to-end login → admin access works seamlessly

#### 1.4 Fix Remaining Admin API Routes for Clerk Auth
**Story:** "As admin, I want all admin API routes to recognize my Clerk session so I can manage roles, users, and invites."
- [ ] Audit all `/api/admin/*` routes for Clerk auth support
- [ ] Add Clerk auth fallback to:
  - `GET /api/admin/roles`
  - `GET /api/admin/user-roles`
  - `POST /api/admin/user-roles`
  - `DELETE /api/admin/user-roles`
  - `GET /api/admin/users`
  - `PATCH /api/admin/users`
  - `POST /api/admin/invite`
- [ ] Centralize `isEmailInAdminList()` and `checkClerkAuth()` into shared utility
- **Files:** `src/app/api/admin/roles/route.ts`, `src/app/api/admin/user-roles/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/invite/route.ts`
- **Acceptance:** All admin API routes work with Clerk auth

---

## Epic 2: 🧹 Clean Up Legacy Auth System

**Status:** Ready
**Priority:** High
**Story:** "As developer, I want to remove the dead legacy JWT auth system so the codebase is clean and maintainable."

### Tasks

#### 2.1 Remove Legacy JWT Auth Library
- [ ] Deprecate `src/lib/auth.ts` (legacy JWT helpers: `getUserFromRequest`, `isAdminUser`, `createToken`, `verifyUserFromRequest`)
- [ ] Create unified auth helper: `src/lib/adminAuth.ts` with:
  - `getCurrentUser()` — checks Clerk first, handles session
  - `isCurrentUserAdmin()` — centralized admin check using `ADMIN_EMAILS` env var + DB `is_admin` flag
  - Returns typed `{ userId, email, isAdmin, roles }` object
- [ ] Update all imports across the codebase to use new helper
- **Acceptance:** No remaining references to `getUserFromRequest()` or `isAdminUser()` from legacy auth

#### 2.2 Remove AuthContext and AuthProvider
- [ ] Remove `src/contexts/AuthContext.tsx` (already commented out in layout)
- [ ] Fix orphaned imports in:
  - `src/components/OrderHistory.tsx`
  - `src/components/UserRightsManager.tsx`
  - Any archived files referencing it
- [ ] Replace with Clerk hooks (`useAuth`, `useUser`) where needed
- **Acceptance:** No remaining code references to `AuthContext`

#### 2.3 Clean Up Dependencies
- [ ] Remove `jose` library from package.json if no longer needed
- [ ] Remove any legacy JWT-related env vars (`JWT_SECRET`, `ADMIN_JWT_SECRET`) from configuration
- [ ] Update `.env.example` to remove legacy vars
- **Acceptance:** No legacy JWT dependencies remain

#### 2.4 Remove Orphaned API Routes
- [ ] Audit `/api/auth/*` routes for necessity
- [ ] Remove or migrate any remaining legacy routes
- **Acceptance:** Only Clerk-based auth routes exist

---

## Epic 3: 🏗️ Admin Auth Improvements

**Status:** Ready
**Priority:** High
**Story:** "As admin, I want a secure and reliable admin authentication experience so I can trust the platform."

### Tasks

#### 3.1 Add Auth Guard to Admin Layout
**Story:** "As admin, I don't want to see the admin shell before auth resolves."
- [ ] Add server-level auth check in `src/app/admin/layout.tsx`
- [ ] Fetch session via `await auth()` from Clerk
- [ ] Show loading state while auth resolves
- [ ] Redirect to sign-in if unauthenticated
- [ ] Redirect to main site if authenticated but not admin
- **Acceptance:** Admin layout never renders for unauthorized users

#### 3.2 Add `clerk_id` to Database Schema
- [ ] Add `clerk_id TEXT` column to `database/schema.sql` `users` table
- [ ] Create migration to backfill `clerk_id` for existing users
- [ ] Update `User` type in `src/lib/db.ts` to include `clerk_id`
- [ ] Update `getUserByClerkId()` in `clerkSync.ts` to use native column
- **Acceptance:** Users can be looked up by Clerk ID from database

#### 3.3 Fix Admin Page Loading States
**Story:** "As admin, I want clear loading indicators while permissions are checked."
- [ ] Improve loading state UX in admin page
- [ ] Handle edge cases: network failure, expired session, permission denied
- [ ] Add retry mechanism for permission fetch
- **Acceptance:** Smooth loading experience with clear feedback

#### 3.4 Add Logout to Admin
**Story:** "As admin, I want to securely log out of the admin dashboard."
- [ ] Implement Clerk `signOut()` in admin footer
- [ ] Clear any cached session data
- [ ] Redirect to main site after logout
- **Acceptance:** Logout clears session and redirects appropriately

#### 3.5 Set Up Clerk Webhook for User Sync
**Story:** "As system admin, I want user accounts to sync automatically between Clerk and the local database."
- [ ] Configure Clerk Dashboard webhook:
  - URL: `https://odubo.studio/api/webhooks/clerk`
  - Events: `user.created`, `user.updated`, `session.created`, `session.ended`, `user.deleted`
- [ ] Receive `CLERK_WEBHOOK_SECRET` from Clerk Dashboard
- [ ] Add `CLERK_WEBHOOK_SECRET` to Vercel environment variables
- [ ] Verify webhook syncs users correctly
- **Acceptance:** New Clerk users are auto-synced to local `users` table

---

## Epic 4: 🎭 Role-Based Access Control (RBAC) System

**Status:** Planning
**Priority:** Medium
**Story:** "As business owner, I want to assign specific roles and permissions to team members so they can do their jobs without full admin access."

### Tasks

#### 4.1 Build User Management UI
**Story:** "As admin, I want to see all users and manage their roles from the admin dashboard."
- [ ] Add "Users" tab in admin sidebar navigation
- [ ] Build user listing page with search/filter
- [ ] Show user details: email, name, roles, last login, status
- [ ] Add user invite flow (email-based)
- [ ] Add user deactivation/reactivation
- **UI Components:**
  - User table with sorting/pagination
  - User detail modal/drawer
  - Invite user form
- **API Dependencies:**
  - `GET /api/admin/users` (already exists, needs Clerk auth)
  - `POST /api/admin/invite` (already exists, needs Clerk auth)
  - `PATCH /api/admin/users` (already exists, needs Clerk auth)

#### 4.2 Build Role Management UI
**Story:** "As admin, I want to create, edit, and assign roles with specific section permissions."
- [ ] Add role management section
- [ ] Build role listing page
- [ ] Build role editor (select section permissions)
- [ ] Build user-to-role assignment interface
- **UI Components:**
  - Role table
  - Role editor modal (checkboxes for sections)
  - User-role assignment (multi-select or transfer list)
- **API Dependencies:**
  - `GET /api/admin/roles` (already exists, needs Clerk auth)
  - `GET/POST/DELETE /api/admin/user-roles` (already exists, needs Clerk auth)
  - New: `POST /api/admin/roles` (create role)
  - New: `PUT /api/admin/roles` (update role)
  - New: `DELETE /api/admin/roles` (delete role)

#### 4.3 Section-Based Permission Rendering
**Story:** "As admin, I want the UI to show only what I have permission to see."
- [ ] Wire `canAccess()` from `usePermissions` into each admin tab/section
- [ ] Hide navigation items user doesn't have access to
- [ ] Show permission-friendly empty states instead of "Access Denied"
- [ ] Add permission badges/banners in restricted sections
- **Acceptance:** UI correctly reflects user's permissions at all times

#### 4.4 Permission Audit Trail
**Story:** "As business owner, I want to see who changed what permissions so I can maintain security."
- [ ] Create audit log table in database:
  ```sql
  CREATE TABLE admin_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,     -- 'role_assigned', 'role_revoked', 'admin_granted', etc.
    target_user_id TEXT,
    metadata TEXT,            -- JSON details
    created_at TEXT DEFAULT (datetime('now'))
  );
  ```
- [ ] Log all role/permission changes
- [ ] Build audit log viewer in admin dashboard
- **Acceptance:** All permission changes are logged and viewable

#### 4.5 Admin Notifications
**Story:** "As admin, I want to be notified when permissions change or new users join."
- [ ] Send email notification on role assignment
- [ ] Send email on admin invite
- [ ] In-app notification bell (future)
- **Acceptance:** Admins are notified of important auth events

---

## Epic 5: 🔗 Unified Accounts & Cross-Application SSO

**Status:** Vision
**Priority:** Medium
**Story:** "As a user, I want one account that works across all Odubo properties so I don't have to log in multiple times."

### Tasks

#### 5.1 Cross-Application Session Architecture
**Story:** "As system architect, I want a unified session strategy so users roam freely across Odubo properties."
- [ ] Audit all current Clerk integrations
- [ ] Document the domain topology:
  - `odubo.studio` (primary) — Main site, store, music, clips, media
  - `admin.odubo.studio` (satellite) — Admin dashboard
  - `moments.odubo.studio` (satellite) — Moments/photos
  - `account.odubo.studio` (future) — Account management portal
- [ ] Implement Clerk satellite domain pattern consistently
- [ ] Configure allowed redirect origins for all domains
- **Acceptance:** Users signed in on any subdomain are signed in on all

#### 5.2 Account Portal (Profile & Settings)
**Story:** "As a user, I want a place to manage my profile, preferences, and account settings."
- [ ] Build account profile page
- [ ] User can update: name, email, avatar, password
- [ ] User can view: order history, subscription status, linked accounts
- [ ] User can manage: notification preferences, privacy settings
- **Consider:** `account.odubo.studio` subdomain or `/account` path on main site
- **Acceptance:** Users can manage their account from a single place

#### 5.3 Multi-Tenant Considerations
**Story:** "As business owner, I want the auth system to support future business accounts, teams, and agencies."
- [ ] Design multi-tenant data model (organizations, team membership)
- [ ] Evaluate Clerk Organizations feature
- [ ] Plan for separation of personal vs. business accounts
- [ ] Document architectural decisions for future implementation
- **Note:** Not implementing now, but architecture should not prevent it

#### 5.4 API Key System (Future)
**Story:** "As a developer, I want API keys to integrate with Odubo services programmatically."
- [ ] API key generation and management
- [ ] Scoped API keys (limited permissions)
- [ ] Rate limiting per API key
- [ ] Usage tracking
- **Acceptance:** Developers can create and manage API keys for integrations

---

## Epic 6: 🧪 Testing & Quality

**Status:** Ready
**Priority:** High
**Story:** "As developer, I want comprehensive tests for the auth system so I can deploy with confidence."

### Tasks

#### 6.1 Auth Permission API Tests
- [ ] Write tests for `/api/admin/permissions`
- [ ] Test: authenticated admin gets `sections: ['*']`
- [ ] Test: authenticated non-admin gets limited sections
- [ ] Test: unauthenticated gets `isAdmin: false`
- **Acceptance:** Permission API behavior is covered by tests

#### 6.2 Middleware Tests
- [ ] Write tests for middleware behavior
- [ ] Test: `/admin` redirects to `admin.odubo.studio` in production
- [ ] Test: `admin.odubo.studio` rewrites correctly
- [ ] Test: unauthenticated users redirected to sign-in
- **Acceptance:** Middleware behavior is covered by tests

#### 6.3 RBAC Integration Tests
- [ ] Test role assignment flow
- [ ] Test permission inheritance
- [ ] Test section-based access control
- **Acceptance:** RBAC system behavior is verified

#### 6.4 E2E Login Flow Tests
- [ ] Set up Playwright E2E tests for auth flow
- [ ] Test: sign-in → admin access
- [ ] Test: sign-in → store access
- [ ] Test: sign-out clears session
- **Acceptance:** Critical auth flows are E2E tested

---

## Epic 7: 📚 Documentation & Knowledge Base

**Status:** Ready
**Priority:** Low
**Story:** "As developer, I want clear documentation of the auth system so future team members can understand and maintain it."

### Tasks

#### 7.1 Auth Architecture Document
- [ ] Document the Clerk integration architecture
- [ ] Diagram: auth flow across subdomains
- [ ] Document: satellite domain configuration
- [ ] Document: permission system data model
- [ ] Document: admin check logic (ADMIN_EMAILS vs DB is_admin)

#### 7.2 Admin Onboarding Guide
- [ ] Write admin onboarding documentation
- [ ] How to: grant admin access to new team members
- [ ] How to: assign custom roles
- [ ] How to: configure Clerk settings
- [ ] Troubleshooting guide

#### 7.3 Developer Runbook
- [ ] How to: add a new protected API route
- [ ] How to: add a new section to the permission system
- [ ] How to: configure a new satellite domain
- [ ] How to: debug auth issues

---

## Immediate Action Items

These are the things you must do **right now** to get admin working:

### Step 1: Get Production Clerk Keys (10 min)
1. Go to https://dashboard.clerk.com
2. Click your application
3. Go to **API Keys** (left sidebar)
4. Toggle **"Production"** at the top
5. Copy these two values:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_...
CLERK_SECRET_KEY = sk_live_...
```

### Step 2: Configure Clerk Dashboard for Production (10 min)
1. Go to **Domains** in Clerk Dashboard
2. Ensure `odubo.studio` is added
3. Add `admin.odubo.studio` as a satellite domain
4. Add `moments.odubo.studio` as a satellite domain
5. Go to **Sessions** → **Settings** → Add allowed origins:
   - `https://odubo.studio`
   - `https://admin.odubo.studio`
   - `https://moments.odubo.studio`

### Step 3: Update Vercel Environment Variables (5 min)
```bash
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
# Paste pk_live_... value

vercel env add CLERK_SECRET_KEY production
# Paste sk_live_... value
```

### Step 4: Re-deploy Vercel (auto, ~2 min)
Push is already done. Wait for Vercel deployment.

### Step 5: Test Login Flow (5 min)
1. Go to `https://odubo.studio/sign-in`
2. Log in with `maniodubo@gmail.com`
3. Navigate to `https://admin.odubo.studio`
4. Admin dashboard should load with full access

---

## Architecture Decision Record

### Decision: Clerk vs Self-Contained Auth

**Context:** The project currently has two parallel auth systems (Clerk + legacy JWT), creating complexity, maintenance burden, and security risks.

**Decision: Keep Clerk, eliminate legacy JWT.**

**Rationale:**
- Clerk handles the hardest parts of auth: session management, MFA, OAuth, password hashing, rate limiting, breach detection
- Building a self-contained auth system would require re-implementing all of the above
- Clerk's satellite domain feature solves the cross-subdomain session problem natively
- Clerk Organizations (future) provides built-in multi-tenant support
- The cost of Clerk is reasonable for a production application

**Trade-offs:**
- Vendor dependency — if Clerk goes down, auth goes down (mitigation: use Clerk's production SLA)
- Cost scales with active users (mitigation: Clerk's free tier covers significant usage)
- Less control over auth UX (mitigation: Clerk supports custom UI through their APIs)

### Decision: Dual Auth During Migration

**Context:** The admin routes still depend on legacy JWT auth.

**Decision:** During the migration, maintain both systems side-by-side. Each API route checks legacy first, then Clerk. This allows a smooth transition without breaking existing integrations.

**Exit criteria:** All routes using Clerk auth only, legacy code deleted, legacy env vars removed.

---

## Technical Debt Register

| ID | Description | Severity | Epic | Status |
|----|-------------|----------|------|--------|
| TD-1 | `/api/admin/*` routes only check legacy JWT, not Clerk | Critical | 1.4 | Open |
| TD-2 | `isEmailInAdminList()` duplicated in 4+ files | High | 2.1 | Open |
| TD-3 | `AuthContext` imports orphaned in OrderHistory, UserRightsManager | High | 2.2 | Open |
| TD-4 | `clerk_id` column missing from schema.sql and User type | High | 3.2 | Open |
| TD-5 | No auth guard in admin layout | Medium | 3.1 | Open |
| TD-6 | Admin page assumes clerkUserId = admin (FIXED) | Critical | — | Closed |
| TD-7 | No production Clerk keys in Vercel (PARTIALLY FIXED) | Critical | 1.1 | Open |
| TD-8 | Clerk Dashboard not configured for satellite domains | Critical | 1.2 | Open |
| TD-9 | `auth()` from Clerk v7 not awaited in some routes (FIXED) | Critical | — | Closed |
| TD-10 | `/admin` routes public in middleware (FIXED) | Critical | — | Closed |
