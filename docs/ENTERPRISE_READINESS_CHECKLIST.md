## Enterprise Readiness Checklist

A prioritized, action-oriented checklist to harden Odubo for enterprise-grade reliability, security, and scale.

### Security and Access Control
- [ ] Implement role-based access control (RBAC): admin, editor, viewer
- [ ] Enforce authorization at API and UI for privileged actions
- [ ] Use signed URLs for private videos; configure Stream `allowedOrigins`
- [ ] Require auth for admin APIs (short-lived access + refresh tokens)
- [ ] Device/session tracking and logout everywhere
- [ ] WAF rules and rate limiting on upload and write endpoints
- [ ] Secrets management per environment; avoid logging sensitive data

### IDs, Data Model, and Integrity
- [ ] Use globally unique IDs (UUIDv7 or ULID) across entities (videos, albums, tracks, users)
- [ ] Prefer `uid` in URLs and API contracts; keep numeric ids internal
- [ ] Normalize credits into a join table (role, person) for filterable queries
- [ ] Normalize related projects to associations (many-to-many)
- [ ] Constraints: unique (`uid`, `slug`), FKs, NOT NULL where appropriate
- [ ] Indexes on `status`, `created_at`, `category`, `type`, `artist_name`
- [ ] SEO slugs per public entity with uniqueness & redirects

### Uploads, Processing, and Storage Hygiene
- [ ] Direct-to-Cloudflare Stream uploads (or direct upload URLs); fallback to R2
- [ ] Implement Stream webhooks to update `status`, `duration`, `thumbnail_url`
- [ ] Lifecycle rules for temp/orphaned R2 objects; periodic cleanup
- [ ] Idempotent uploads with `uploadId` (safe to retry)
- [ ] Organized storage paths (already implemented for videos); extend as needed

### API Quality, Contracts, and Versioning
- [ ] Validate all inputs at the edge with Zod/Valibot; typed error envelopes
- [ ] Publish OpenAPI spec; generate internal client SDK
- [ ] Version APIs (`/api/v1/...`); deprecation policy with timelines
- [ ] Consistent pagination (cursor-based), filtering, sorting
- [ ] Idempotency keys for POST/PUT to prevent duplicates

### Observability and Operations
- [ ] Structured logs with request IDs; correlation across services
- [ ] Metrics: RPS, p95 latency, error rate per route, upload success/fail, Stream states
- [ ] Tracing critical paths (upload → process → publish)
- [ ] Central error reporting (Sentry) with release mapping
- [ ] On-call alerts tied to SLOs (availability, latency, error budget)

### Reliability, Performance, Scalability
- [ ] Background jobs/queues (Cloudflare Queues/Workers Cron) for async work
- [ ] Caching: CDN for public GETs, SWR client-side, ETag/Last-Modified, stale-while-revalidate
- [ ] Backups and DR: scheduled D1 exports + R2 manifests + Stream UID index; tested restore runbook
- [ ] Feature flags and incremental rollouts; dark launches

### Testing and Quality Assurance
- [ ] Unit tests for validators, DB adapters, Stream client
- [ ] Integration tests for CRUD and auth
- [ ] E2E flows: upload → process → publish → playback
- [ ] Contract tests vs OpenAPI to catch breaking changes
- [ ] Load tests on uploads and listings; chaos tests on webhook retry logic

### Admin UX and Content Tooling
- [ ] Bulk actions (status, visibility, category) with confirmation & undo
- [ ] Search and filter by status, type, category, mood; saveable views
- [ ] Inline editing where safe; keyboard navigation; a11y (labels, focus states)
- [ ] Audit log: who/what/when with before/after diffs; exportable
- [ ] Preset roles (director/producer/etc.) + “other”; validation hints

### Compliance and Governance
- [ ] Data retention policies; configurable purge windows
- [ ] PII handling boundaries; least privilege access
- [ ] Content takedown workflow: soft-delete, reversible restoration, tombstones

### Delivery, CI/CD, and Environments
- [ ] CI/CD with preview deploys; automated DB migrations with safe rollbacks
- [ ] Infra as code (Wrangler/Terraform); environment drift detection
- [ ] Typed configuration per environment; boot-time config validation

### Environment and Config Checklist
- [ ] `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`/`CLOUDFLARE_API_TOKEN`
- [ ] `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- [ ] `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_URL`
- [ ] `DATABASE_URL`, `CLOUDFLARE_D1_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID`
- [ ] `NEXT_PUBLIC_SITE_URL` for allowed origins and redirects

### Phased Plan (Suggested)
1) Security & IDs: RBAC, signed URLs, `uid` adoption, basic indexes
2) API & Validation: Zod, OpenAPI, versioning, pagination, idempotency
3) Stream Webhooks & Ops: webhook ingestion, metrics, logs, Sentry
4) Storage Hygiene: lifecycle rules, orphan cleanup, DR backups & restore
5) Admin UX: bulk actions, filters, audit log
6) Testing & Perf: contract tests, load tests, chaos tests
7) CI/CD & IaC: migrations, preview deploys, Terraform/Wrangler

### Notes
- Videos: `uid` and organized storage are implemented; deletion also removes Stream assets when `stream_video_id` is present.
- Next targets: normalize credits/related projects; expose `uid` and slugs across albums/tracks; Stream webhooks for status.


