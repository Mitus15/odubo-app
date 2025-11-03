# Changelog

All notable changes to Odubo Studio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Moments Gallery System** - Full featured photo/video gallery capture and moderation
  - In-app schema application endpoint (`/api/admin/db/apply-moments`) with idempotent CREATE TABLE IF NOT EXISTS
  - Admin UI button to apply Moments schema without Wrangler CLI
  - Public galleries endpoint (`/api/moments/galleries/public`) for displaying recent galleries
  - Schedule enforcement on upload and record endpoints (starts_at/ends_at window validation)
  - Featured page can now link to a specific Moments gallery via inline create/select
  - Automatic capture URL generation (`/moments/capture?galleryId=X`)

- **Admin Tools & UX**
  - Storage browser rename/move action for R2 objects
  - Admin logout button in navigation bar
  - Bootstrap allowance on Moments schema apply (first-time setup without admin flag)
  - DB role fallback checks alongside token-based admin verification

- **Auth & Security Improvements**
  - `ADMIN_EMAILS` environment variable override for admin access (bypasses database is_admin flag)
  - Enhanced login error messages showing specific configuration issues (DATABASE_URL, D1 token, JWT secret)
  - Normalized D1 API token handling across all database helpers (accepts either CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN)
  - Public health endpoint (`/api/health/env`) to verify environment variable presence without authentication

- **Developer Experience**
  - Clearer diagnostics for login failures with actionable error messages
  - Environment health probe for quick troubleshooting
  - Comprehensive error handling in admin endpoints

### Changed
- Moments page no longer shows placeholder galleries; fetches from public API endpoint
- Database helpers now accept fallback to `CLOUDFLARE_API_TOKEN` when `CLOUDFLARE_D1_API_TOKEN` is not set
- Featured manage page now creates and links galleries inline instead of requiring pre-existing galleries
- Admin check logic expanded to support email-based override and DB role checks

### Fixed
- Login failures now return specific 500/502 errors for misconfigurations instead of generic 400
- D1 token validation no longer requires the dedicated D1 token when the general API token has D1 permissions
- Schedule enforcement edge cases in Moments upload/record flows

---

## [0.1.0] - 2025-11-02

### Added
- **In-app Cloudflare D1 + R2 Admin Tools**
  - SQL console at `/admin/db` for executing queries and viewing results
  - R2 storage browser at `/admin/storage` with list, upload, delete, and move operations
  - "Ensure Featured singleton" quick action in admin DB panel
  - Featured page singleton management with cover image and background video upload
  - Admin navigation component with database, storage, and featured links
  - Public R2 URL exposure for uploaded assets

- **Environment & Configuration**
  - Consolidated environment variable management (`.env.local` as single source of truth)
  - Template `.env.example` for new developers
  - Server-only JWT secrets and Cloudflare credentials
  - Neutralized `.env` file to prevent conflicts

- **Security & Compliance** (from 30-day sprint)
  - Distributed rate limiting using Cloudflare D1
  - XSS protection (removed `dangerouslySetInnerHTML`)
  - GDPR compliance with cookie consent and user rights management
  - Cloudflare WAF deployment scripts and rules
  - Security monitoring component

### Changed
- Environment strategy: `.env.local` for development, provider variables for production
- Rate limiting moved from in-memory to D1-backed distributed system
- Legal pages refactored to remove XSS vulnerabilities

### Security
- Comprehensive WAF rules protecting against SQL injection, XSS, path traversal, and command injection
- Bearer token authentication for all admin endpoints
- Input validation using Zod schemas on all data modification endpoints

---

## Initial Release - 2025-01-XX

### Added
- Next.js 15 App Router foundation
- React 19 with Tailwind CSS styling
- Cloudflare Stack integration:
  - D1 for database (via HTTP API)
  - R2 for file storage (via AWS SDK v3)
  - Stream for video delivery
- User authentication with JWT
- Basic admin panel
- Featured content management
- Legal pages (Privacy Policy, Terms of Service)

---

## Legend

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security-related changes
