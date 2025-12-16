# Social Ops & AI Backlog

Use this checklist to track implementation and testing of the Social Ops, AI Clips, and AI Avatar features.

---

## 1. Roles & Auth ✅

- [x] `users.role` column added to DB (stores 'admin' | 'editor' | 'viewer')
- [x] Implement `getUserRoleFromRequest` and `userHasAnyRole` helpers
- [x] Create separate admin login at `/admin/login` (admin-only)
- [x] Create separate front-user signup at `/signup` (role: viewer by default)
- [x] Harden signup API to prevent arbitrary admin creation
- [x] Add `/api/me` endpoint for role discovery
- [x] Extend `/api/admin/users` PATCH to support editor role
- [x] Update Admin Users UI with "Make Editor" button
- [x] Gate `/admin/social` route to `admin` + `editor` (uses `/api/me` check)
- [x] Gate social/analytics APIs to `admin` + `editor` (uses `userHasAnyRole`)

---

## 2. Social Ops UI Shell (`/admin/social`) ✅

- [x] Create `/admin/social` route/page
- [x] Implement 3-pane layout (Content Library / Detail & AI / Composer)
- [x] Content Library: list videos & clips with real DB data
- [x] Content Library: tabs for undistributed/deployed posts
- [x] Content Library: basic search input (UI ready)
- [x] Content Detail: preview placeholder & metadata
- [x] Composer: per-platform tabs (TikTok, Instagram, Facebook, YouTube) with textareas
- [x] Composer: Save Draft (wired to `/api/social/posts`)
- [ ] Content Library: advanced filters (type, purpose) with real DB queries
- [ ] Content Detail: video preview player integration

---

## 3. Social Posting Data & API ✅

- [x] `social_posts` and `social_post_targets` tables added via migration
- [x] Implement `POST /api/social/posts` to create posts + targets
- [x] Implement basic validation (auth, content id, platforms)
- [x] Hook Composer submit to `POST /api/social/posts`
- [x] Implement `GET /api/social/posts` (list for Deployed Posts tab)
- [x] Implement `GET /api/social/undistributed-clips` (list for Undistributed Clips tab)
- [x] Wire both tabs with real DB data
- [ ] Implement `PATCH /api/social/posts/:id` for editing drafts
- [ ] Implement archive/delete endpoints
- [ ] For now, simulate publishing (no external APIs)

---

## 4. AI Caption & Prep Endpoint

- [ ] Choose LLM provider & configure API key
- [ ] Implement `POST /api/social/prepare`:
  - [ ] Accept generic content payload
  - [ ] Generate per-platform drafts (captions/titles/descriptions/hashtags/CTAs)
  - [ ] Return structured JSON for UI
- [ ] Integrate with Composer in `/admin/social`
- [ ] Integrate with Share to Social widget (later section)
- [ ] Ensure all AI text is fully editable and never auto-published

---

## 5. Analytics & Insights

- [ ] Wire `videos_insights` into DB access layer
- [ ] Implement `GET /api/admin/analytics/videos?days=N`:
  - [ ] Aggregate views/likes/shares/clicks
  - [ ] Return top content by views
- [ ] Update `AnalyticsTab` to use real API instead of mock data
- [ ] Implement `POST /api/videos/recommend-ads`:
  - [ ] Use `videos`, `videos_analysis`, `videos_insights`
  - [ ] Return ranked recommendations for clothing/music/site
- [ ] Surface recommendations in `/admin/social` Detail pane
- [ ] Surface recommendations on individual video admin pages

---

## 6. Share to Social Widget

- [ ] Implement `ShareToSocialButton` component:
  - [ ] Accepts generic content payload (id, type, title, urls, tags, products)
  - [ ] Visible only for `social-manager` + `admin`
- [ ] Modal behavior:
  - [ ] Show content summary (preview + metadata)
  - [ ] Provide "Generate AI draft" (calls `/api/social/prepare`)
  - [ ] Provide "Start from blank" option
  - [ ] Allow editing per-platform copy
  - [ ] Option to send draft to `/admin/social` or direct schedule
- [ ] Integrate widget into internal video detail pages
- [ ] Integrate widget into product/collection admin pages (if applicable)

---

## 7. AI Clip Variants (Alternate Universe Clips)

- [ ] Wire `clip_ai_jobs` into DB access layer
- [ ] Implement `POST /api/clips/:id/ai-variants`:
  - [ ] Accept prompt, negativePrompt, stylePreset, imagePrompts, targetPurpose
  - [ ] Create `clip_ai_jobs` row (status `queued`)
- [ ] Implement `GET /api/clips/:id/ai-variants`:
  - [ ] List jobs with status and basic metadata
- [ ] Implement `POST /api/clips/ai-variants/:jobId/approve`:
  - [ ] Create new clip/video record from `result_url`
  - [ ] Link via `result_clip_id`
- [ ] Implement worker logic for `clip_ai_jobs`:
  - [ ] Fetch queued jobs
  - [ ] Call configured video transform API (stub or provider)
  - [ ] Update `result_url`, `status`, `error_message`
- [ ] Clips UI integration:
  - [ ] Add "AI Variant" button per clip
  - [ ] Modal to configure prompts + presets + image prompts
  - [ ] Display job list with statuses and previews
  - [ ] Approve/Reject actions wired to API
- [ ] `/admin/social` integration:
  - [ ] Expose "Generate AI Variant" in Content Detail pane
  - [ ] Allow choosing variants as source content for posts

---

## 8. AI Avatar Announcements (Mani)

- [ ] Wire `avatar_announcement_jobs` into DB access layer
- [ ] Configure external avatar/voice provider (even if placeholder)
- [ ] Implement `POST /api/avatar/announcements`:
  - [ ] Accept script, scriptSource, voice_profile_id, avatar_profile_id, style_preset
  - [ ] Create `avatar_announcement_jobs` row (status `queued`)
- [ ] Implement `GET /api/avatar/announcements` (list jobs)
- [ ] Implement `POST /api/avatar/announcements/:id/approve`:
  - [ ] Create video/clip record from `result_url`
  - [ ] Link via `result_video_id`
- [ ] Implement worker logic for `avatar_announcement_jobs`:
  - [ ] Fetch queued jobs
  - [ ] Call avatar provider API
  - [ ] Update `result_url`, `status`, `error_message`
- [ ] Social Ops UI – Announcements section:
  - [ ] New tab/section in `/admin/social` for "Announcements"
  - [ ] Script editor with AI-assist (use LLM)
  - [ ] Avatar/voice profile pre-selected as Mani by default
  - [ ] Generate/preview/approve flow
  - [ ] Approved avatar announcements appear in Content Library

---

## 9. External Platform Integrations (Per Platform)

For each platform, repeat the pattern: OAuth, token storage, post publishing.

### 9.1 First Platform (e.g., Instagram or YouTube)

- [ ] Create dev app + credentials on platform
- [ ] Implement OAuth web flow and callback
- [ ] Store access + refresh tokens securely
- [ ] Extend social publishing worker to:
  - [ ] Use tokens to upload media & create posts
  - [ ] Update `social_post_targets.status`, `platform_post_id`, `published_at`
- [ ] Add basic error handling and retry/backoff

### 9.2 Additional Platforms (TikTok, remaining Meta, etc.)

- [ ] Repeat OAuth + token storage
- [ ] Extend worker for platform-specific posting
- [ ] Update UI to reflect per-platform statuses

---

## 10. Monitoring, Limits & Polish

- [ ] Add structured logging for:
  - [ ] Social post publishing attempts & failures
  - [ ] AI failures (LLM, video transform, avatar)
- [ ] Add user-facing error toasts/messages in admin UI
- [ ] Implement soft limits per role for:
  - [ ] AI clip variants per day
  - [ ] Avatar announcement jobs per period
- [ ] Write brief guide for Social Managers on using `/admin/social`
- [ ] Review security: confirm only intended roles can access each feature

---

You can keep this file updated as you implement and test each item, checking boxes to track progress across the Social Ops project.