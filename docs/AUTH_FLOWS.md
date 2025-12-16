# Authentication Flows - Quick Reference

**Last Updated:** December 10, 2025

## Separate Login & Signup Flows

### Admin Flows

**Login:**
- **URL:** `/admin/login`
- **API:** `POST /api/users` with `action: 'login'`
- **Requirements:** 
  - User must have `is_admin === true` or be in `ADMIN_EMAILS` env var
  - Redirects to `/admin` on success
  - Shows error if non-admin tries to login
- **Fallback:** Unauthenticated admin pages redirect to `/admin/login` (via `withAdmin` HOC)

**Signup/Account Creation:**
- **Via Invite Flow:**
  1. Admin creates invite at `/admin/users` → calls `POST /api/admin/invite`
  2. Returns invite token
  3. Recipient uses `POST /api/admin/accept-invite` with token to create account
  4. Creates user with `role: 'admin'` and `is_admin: true`

- **Direct Creation (planned):**
  - Admins can use `/admin/users` UI to create users directly
  - Can set role to `admin`, `editor`, or `viewer`
  - Bypasses invite flow for internal team setup

### Front-User (Regular) Flows

**Login:**
- **URL:** `/login`
- **API:** `POST /api/users` with `action: 'login'`
- **Behavior:**
  - If `is_admin === true`: redirects to `/admin`
  - If regular user: redirects to `/` (home)
- **Features:**
  - Rate limiting (10 attempts per minute per IP)
  - Account lockout after failed attempts
  - Email verification required (unless admin)
  - Automatic Shopify customer linking

**Signup:**
- **URL:** `/signup`
- **API:** `POST /api/users` with `action: 'signup'`
- **Behavior:**
  - Creates account with `role: 'viewer'` by default
  - `is_admin` only set to `true` if email matches `ADMIN_EMAILS` env var
  - **Security:** Ignores any `is_admin` flag passed in request body
  - Sends email verification link
  - Redirects to `/login` after success
- **Features:**
  - Password must be 8+ characters
  - Email verification required before login
  - Automatic Shopify customer linking on signup

## API Endpoints

### `/api/users` (POST)
Multi-action endpoint:

**Login:**
```json
{
  "action": "login",
  "email": "user@example.com",
  "password": "password123"
}
```
Response:
```json
{
  "token": "jwt...",
  "is_admin": true/false
}
```

**Signup:**
```json
{
  "action": "signup",
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```
Response:
```json
{
  "message": "Account created successfully! Please check your email to verify your account.",
  "user": { "id": "...", "email": "...", ... }
}
```

### `/api/me` (GET)
Returns current user info:
```json
{
  "authenticated": true,
  "user": {
    "id": "...",
    "email": "...",
    "role": "admin" | "editor" | "viewer",
    "is_admin": true/false
  }
}
```

### Admin-Only APIs

**`POST /api/admin/invite`**
- Creates invite for email
- Returns token to share with recipient

**`POST /api/admin/accept-invite`**
- Accepts invite with token and creates admin account

**`PATCH /api/admin/users`**
- Updates user role: `admin`, `editor`, or `viewer`
- Sets `is_admin` based on role

## Role Hierarchy

```
admin     → Full system access, can manage users, all admin tools
editor    → Content & Social Ops access, cannot manage users or system settings
viewer    → Read-only front-facing content, personal account management
```

## Security Notes

1. **Admin Creation:**
   - Only via `ADMIN_EMAILS` env var (auto-assign on signup)
   - Or via invite flow (`/api/admin/invite` + `/api/admin/accept-invite`)
   - Public signup **cannot** create admin accounts (body `is_admin` ignored)

2. **Role Management:**
   - Only admins can change user roles via `/admin/users`
   - Role changes via `PATCH /api/admin/users` are admin-only

3. **Authentication:**
   - JWT tokens stored in `localStorage` + httpOnly cookies
   - 7-day expiration
   - Tokens include `userId`, `email`, `is_admin`, `firstName`, `lastName`

4. **Rate Limiting:**
   - Login: 10 attempts per minute per IP
   - Account lockout after multiple failed attempts (15 min)

## Environment Variables

```bash
# Required
JWT_SECRET=your-secret-key
DATABASE_URL=https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/d1/database/DATABASE_ID

# Optional - auto-grant admin on signup
ADMIN_EMAILS=admin@example.com,owner@example.com

# Email verification
RESEND_API_KEY=re_...
```

## Migration Path

If you have existing users:

1. **Existing admins:**
   - Already have `is_admin: true`
   - May need `role: 'admin'` set via `PATCH /api/admin/users`

2. **Existing regular users:**
   - Default `role: 'viewer'`
   - Can be upgraded to `editor` via `/admin/users`

3. **New team members:**
   - Use `/admin/users` invite flow for admins/editors
   - Public signup for regular users

## Testing Checklist

- [ ] Admin can login at `/admin/login`
- [ ] Regular user cannot login at `/admin/login`
- [ ] Regular user can login at `/login` and gets redirected to `/`
- [ ] Admin logging in at `/login` gets redirected to `/admin`
- [ ] New signup creates `viewer` role
- [ ] Signup with email in `ADMIN_EMAILS` creates admin
- [ ] Signup with arbitrary `is_admin: true` in body is ignored
- [ ] `/admin` pages redirect to `/admin/login` when unauthenticated
- [ ] Invite flow creates admin accounts
- [ ] Role changes in `/admin/users` work for `admin`, `editor`, `viewer`
