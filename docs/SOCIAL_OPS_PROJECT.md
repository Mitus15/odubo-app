# Odubo Social Ops & AI Content Hub

## 1. Overview

### 1.1 Purpose

Create a unified **Social Ops** workspace inside the existing Next.js admin where a Social Media / Content / Sales / Advertising Manager can:

- Discover any relevant content (videos, clips, products, collections, posts, artists, campaigns).
- Use AI to draft copy, recommendations and insights, but always retain **full manual control**.
- Edit/override or ignore AI suggestions at any point.
- Distribute and schedule content to TikTok, Instagram, Facebook, and YouTube.
- See performance and AI-driven insights on what works for sales, music, and brand.

This is a **human-first, AI-assisted** system: AI proposes, the manager disposes.

### 1.2 Scope

In scope for this phase:

- A dedicated Social Ops UI in the admin (`/admin/social`).
- A reusable **Share to Social** widget that can be dropped onto any content page.
- AI endpoints for:
  - Generating per-platform drafts (captions/titles/descriptions/hashtags/CTAs).
  - Recommending best videos/clips for ads (clothing, music, site/brand).
  - Generating high-level analytics insights.
- Social-centric analytics view for performance and insights.
- Role-based access for `social-manager` and `admin`.

Out of scope (later phases):

- Fully automated posting without human confirmation.
- Deep, custom integrations with external ad managers (Meta Ads Manager, Google Ads) beyond content posting.

---

## 2. Roles & Permissions

### 2.1 Roles

- **`admin`**
  - Full access to all admin tools, settings, DB utilities, pipelines.
  - Can manage roles and platform integrations.

- **`social-manager`**
  - Primary user of Social Ops.
  - Can:
    - Access `/admin/social` and social-centric analytics.
    - View and manage content library (public/ready content).
    - Generate and edit AI suggestions (copy, platforms, ad candidates).
    - Approve, schedule, and publish social posts.
  - Cannot:
    - Use raw DB tools, migrations, low-level system settings.

- **(Optional) `marketing` / `editor`**
  - Supports content preparation and drafts.
  - Can propose AI drafts but might not have publish rights (if an approval flow is required later).

### 2.2 Permissions Model

Roles are stored in the `users` table (e.g. as JSON array `roles`), and enforced via helper functions in `src/lib/auth`:

- `isAdminUser(user)` → `boolean`.
- `userHasAnyRole(user, roles: string[])` → `boolean`.

Key endpoints and pages check:

- `admin` **or** `social-manager` for:
  - `/admin/social` UI
  - Social/analytics APIs (see section 5)
  - Publishing/scheduling endpoints

- `admin` only for:
  - Low-level admin tools: DB, migrations, internal debugging endpoints.

---

## 3. High-Level User Flows

### 3.1 Browse & Choose Content to Promote

**As a Social Manager, I want to easily find content to promote.**

1. Navigate to `/admin/social`.
2. In the **Content Library** (left pane), filter by:
   - Type: Video / Clip / Product / Collection / Blog / Campaign.
   - Purpose: Clothing / Music / Brand / Drop Launch.
   - Platform fit: TikTok / IG Reels / YouTube Shorts / Feed.
3. Search by title, artist, product, tag, genre, mood.
4. Select a content item to open in the **Content Detail** pane.

### 3.2 Generate AI Suggestions (Optional)

**As a Social Manager, I want AI to suggest platforms and copy, but I must be able to override it.**

1. In the **Content Detail** pane, click **“Generate AI Draft”**.
2. System calls AI with:
   - Content metadata (title, description, tags, genre, mood).
   - Performance metrics (views, likes, shares, clicks, conversions) if available.
   - Goal (e.g., clothing ads / music streams / site visits).
3. AI returns:
   - Recommended platforms (TikTok, IG Reels, IG Feed, FB, YT Shorts, YT main).
   - Draft copy per platform:
     - TikTok: caption + hashtags.
     - Instagram: caption + hashtags.
     - Facebook: post text.
     - YouTube: title + description + tags.
   - Suggested CTAs and angles.
   - Ad suitability scores and recommended product tags.
4. Manager reviews drafts in the **Composer (right pane)**.

### 3.3 Manual-Only Workflow (No AI)

**As a Social Manager, I want to write my own copy and decide on everything myself.**

1. In the Composer, choose **“Start from blank”** for any platform.
2. Fill in all text fields manually (titles, captions, descriptions, tags, CTAs).
3. Skip the AI prompt entirely or only use AI for specific helpers (e.g., generate hashtags).
4. System never auto-publishes without explicit confirmation.

### 3.4 Approve & Schedule

**As a Social Manager, I want to approve final copy and schedule distribution to each platform.**

1. For each platform tab in the Composer:
   - Confirm media (video/thumbnail) and link to internal content.
   - Edit/approve final copy.
   - Set the publish time (immediate or scheduled).
   - Tag internal products/artists/collections if relevant.
2. Click **“Schedule & Publish”**.
3. Backend:
   - Uploads media and posts to platforms via their APIs.
   - Stores `social_posts` + `post_targets` rows with status and IDs.
4. UI updates status (Draft / Scheduled / Published / Failed).

### 3.5 Analytics & Insights

**As a Social Manager, I want to understand which content and angles are working across platforms.**

1. Go to `/admin/social` or the Analytics tab.
2. View high-level metrics (over a selected time window):
   - Views, likes, shares, clicks.
   - Breakdown by platform.
3. See **Top Content**:
   - Videos/clips/products that drove:
     - Clothing clicks/conversions.
     - Music plays/streams.
     - Site visits.
4. Read AI-generated insights:
   - “This week, clips with [X theme] and [Y mood] performed best for clothing conversions.”
   - “For music, shorter high-energy clips outperformed longer narrative pieces.”
5. See AI **recommendations**:
   - “Top 3 videos to use as clothing ads next week.”
   - “Best pieces for music-focused campaigns.”

### 3.6 Share to Social from Any Content Page

**As a Social Manager, I want to share anything I’m looking at without switching contexts.**

1. While logged in with the appropriate role, navigate to:
   - A video page.
   - A product/collection page.
   - A blog/campaign page.
   - An artist page, etc.
2. See a **“Share to Social”** button or icon (only visible to authorized roles).
3. Click it to open a modal with:
   - Content summary (title, media, tags, products).
   - Options:
     - “Generate AI draft”.
     - “Start from blank”.
4. Edit as needed and either:
   - **Send to Social Ops** as a draft campaign.
   - Or **Schedule/Publish now** (same flow as `/admin/social`).

---

## 4. Data Model & Storage

This builds on existing tables like `videos`, `videos_analysis`, etc. New/extended tables may include:

### 4.1 `social_posts`

Tracks logical social posts created for one content item.

- `id` (PK)
- `uid` (string, optional; globally unique ID)
- `content_type` (enum: `video`, `clip`, `product`, `collection`, `post`, `artist`, `campaign`)
- `content_id` (FK referencing the internal item, where applicable)
- `title` (string)
- `goal` (string: `clothing`, `music`, `site`, `brand`, etc.)
- `created_by_user_id`
- `created_at`
- `updated_at`

### 4.2 `social_post_targets`

Tracks per-platform distribution of a `social_post`.

- `id` (PK)
- `social_post_id` (FK to `social_posts`)
- `platform` (enum: `tiktok`, `instagram`, `facebook`, `youtube`)
- `platform_variant` (optional: `reels`, `feed`, `shorts`, etc.)
- `status` (enum: `draft`, `scheduled`, `publishing`, `published`, `failed`)
- `scheduled_at`
- `published_at`
- `platform_post_id` (string, from API)
- `caption` (text)
- `title` (text, for YT)
- `description` (text, for YT or FB)
- `hashtags` (JSON array)
- `cta` (string)
- `products_json` (JSON array of linked product IDs/handles)
- `ai_metadata_json` (JSON with AI hints: score, angle, reason)
- `created_at`
- `updated_at`

### 4.3 `videos_insights` (optional but recommended)

Consolidates performance metrics + AI creative attributes.

- `id` (PK)
- `uid` (string; linking to `videos.uid`)
- `video_id` (FK to `videos.id`)
- `source` (e.g. `odubo`, `tiktok`, `instagram`, `youtube`)
- `platform` (platform name)
- `views`, `likes`, `shares`, `clicks`, `watch_time_seconds`
- `conversion_events_json` (JSON array of events `{type, count}`)
- `audience_json` (optional, demographics/geo, if available)
- `creative_fit_json` (AI summary: `genre`, `mood`, `best_use_cases`, `product_fit`, `notes`)
- `ad_score` (0–1)
- `last_synced_at`
- `created_at`

---

## 5. Backend Endpoints

### 5.1 AI Draft / Social Prep: `POST /api/social/prepare`

**Purpose:** Given a generic content payload, return per-platform AI drafts.

**Input (example):**

```json
{
  "content": {
    "id": "123",
    "type": "video",
    "title": "Runway Clip - Winter Drop",
    "url": "https://...",
    "imageUrl": "https://.../thumb.jpg",
    "videoUrl": "https://.../video.mp4",
    "description": "High-energy runway clip of the new winter drop.",
    "tags": ["winter", "runway", "coats"],
    "products": [
      { "id": "p1", "handle": "winter-coat", "title": "Winter Coat" }
    ]
  },
  "goal": "clothing",      
  "useAi": true
}
```

**Output (example):**

```json
{
  "success": true,
  "platforms": ["tiktok", "instagram-reels", "facebook", "youtube-shorts"],
  "drafts": {
    "tiktok": {
      "caption": "POV: you find the coat you’ll wear all winter. #winterdrop #runway",
      "hashtags": ["#winterdrop", "#runway", "#streetwear"],
      "cta": "Tap the link in bio to shop the drop."
    },
    "instagram": {
      "caption": "Our winter coats hit different. 🔥\n\nHigh-energy runway clips from the latest drop—save this look for your next night out.",
      "hashtags": ["#winterstyle", "#runway", "#odubostudio"],
      "cta": "Shop the full drop via the link in bio."
    },
    "facebook": {
      "caption": "The winter drop is live. Here’s a look at the new silhouettes coming out of the studio.",
      "cta": "Explore the full collection on our site."
    },
    "youtube": {
      "title": "Winter Drop Runway – New Coats From Odubo Studio",
      "description": "A first look at our latest winter drop. High-energy runway clips, layered fits, and pieces built for real winter.\n\nShop the collection: https://...",
      "tags": ["winter drop", "runway", "streetwear", "odubo studio"],
      "cta": "Add the collection to your watch list and shop the looks."
    }
  }
}
```

Social manager can edit or discard any part of this.

### 5.2 AI Ad Recommendations: `POST /api/videos/recommend-ads`

**Purpose:** Suggest which videos to prioritize as ads for a target (clothing, music, site).

**Input (example):**

```json
{
  "target": "clothing"   
}
```

**Output (example):**

```json
{
  "success": true,
  "recommendations": [
    {
      "videoId": 42,
      "reason": "High view-through, strong focus on outfits, good click history.",
      "score": 0.92,
      "bestPlatforms": ["instagram-reels", "tiktok"],
      "suggestedCopyIdeas": [
        "This is the coat that carries you all winter.",
        "3 winter looks in 10 seconds."
      ],
      "suggestedCallToActions": [
        "Shop the winter drop now.",
        "Save this fit for later."
      ],
      "productHandlesToTag": ["winter-coat", "winter-drop"]
    }
  ]
}
```

### 5.3 Analytics: `GET /api/admin/analytics/videos?days=30`

**Purpose:** Provide metrics and top content for the Analytics view.

**Output (example):**

```json
{
  "success": true,
  "metrics": {
    "views": 12345,
    "likes": 2345,
    "shares": 345,
    "clicks": 210
  },
  "topVideos": [
    {
      "id": 42,
      "title": "Winter Drop Runway",
      "category": "fashion",
      "platform": "instagram",
      "views": 5000
    }
  ]
}
```

### 5.4 Social Posts Create/Schedule: `POST /api/social/posts`

**Purpose:** Persist and (optionally) schedule/publish social posts.

**Input (simplified):**

```json
{
  "content": { "id": "123", "type": "video" },
  "goal": "clothing",
  "targets": [
    {
      "platform": "tiktok",
      "caption": "...final approved caption...",
      "scheduledAt": "2025-12-11T18:00:00Z",
      "products": ["winter-coat"]
    },
    {
      "platform": "instagram",
      "caption": "...",
      "scheduledAt": null
    }
  ]
}
```

**Behavior:**

- Creates `social_posts` + `social_post_targets` rows.
- Either:
  - Immediately publishes (if `scheduledAt` is null/now).
  - Or enqueues jobs in a queue/cron worker to publish at the scheduled time.
- Stores platform IDs + statuses when complete.

---

## 6. Frontend: Social Ops UI (`/admin/social`)

### 6.1 Layout

Three main panes:

1. **Content Library (left)**
   - Filters:
     - Type: Video / Clip / Product / Collection / Blog / Campaign.
     - Purpose: Clothing / Music / Brand / Drop.
     - Platform fit (optional, AI-derived): TikTok / Reels / Shorts / Feed.
   - Search bar (title, artist, product, tag).
   - Infinite/virtualized list of content items.

2. **Content Detail & AI (middle)**
   - Preview (thumbnail/video/image).
   - Metadata:
     - Title, artist, products, tags, genre, mood.
   - Basic performance summary (views/likes/shares/clicks across all social posts).
   - AI block:
     - Recommended platforms + fit scores.
     - Summary of why it works (or not) for the selected goal.
     - Button: **“Generate AI Draft”** (calls `/api/social/prepare`).

3. **Per-Platform Composer (right)**
   - Tabs: TikTok / Instagram / Facebook / YouTube.
   - Each tab has:
     - Textarea(s) for caption/title/description.
     - Hashtag helper input (chips or free text).
     - CTA selector (dropdown of common CTAs + custom text).
     - Product/artist/collection tagging section.
     - Toggle for **Use AI suggestions** vs **Manual only**.
   - Global actions:
     - “Save Draft”
     - “Schedule & Publish”

### 6.2 State & Data Flow

- `ContentLibrary` fetches items from existing content APIs or a new `/api/social/content` aggregator.
- Selecting an item sets `selectedContent` in a top-level state (e.g., via context or parent state).
- `ContentDetail` uses `selectedContent` and calls analytics and AI recommendation endpoints.
- `Composer` uses drafts from `/api/social/prepare` if `useAi` is true, or starts blank.
- `Composer` dispatches `POST /api/social/posts` on submit.

### 6.3 Error Handling & UX

- Clearly indicate when AI is loading / unavailable.
- Always allow manual editing regardless of AI status.
- Show per-platform status messages on publish/schedule failures.

---

## 7. Frontend: Share to Social Widget

### 7.1 Component Contract

Reusable client component (pseudo-code):

```ts
<ShareToSocialButton
  content={
    id: video.id,
    type: "video",
    title: video.title,
    url: video.publicUrl,
    imageUrl: video.thumbnailUrl,
    videoUrl: video.streamUrl,
    description: video.description,
    tags: video.tags,
    products: video.products
  }
  defaultGoal="clothing"
/>
``

### 7.2 Behavior

- Visible only when user has `social-manager` or `admin` role.
- On click:
  - Open modal.
  - Show summary of content (preview + metadata).
  - Options:
    - **“Generate AI draft”** → calls `/api/social/prepare`.
    - **“Start from blank”** → show empty fields.
  - Let user:
    - Edit copy per platform.
    - Choose to **Send to Social Ops** as draft, OR
    - **Schedule/Publish now** using `POST /api/social/posts`.

---

## 8. Implementation Plan / Phases

### Phase 1: Foundations

1. **Roles & Auth**
   - Confirm/add `roles` field to `users` table.
   - Ensure `getUserFromRequest`, `isAdminUser`, `userHasAnyRole` are implemented and used.
   - Gate social endpoints and admin views appropriately (`admin` + `social-manager`).

2. **Data Model**
   - Add `social_posts` and `social_post_targets` tables.
   - (Optional) Add `videos_insights` for consolidated performance.

3. **Basic Social Ops UI Shell**
   - Create `/admin/social` route and layout.
   - Stub content library panel (using existing `videos` and `clips` as initial data sources).

### Phase 2: AI & Composer

4. **AI Prep Endpoint**
   - Implement `POST /api/social/prepare` using LLM provider.
   - Use generic content payload structure.

5. **Composer UI**
   - Implement per-platform tabs with editable fields.
   - Wire up to `prepare` endpoint for AI drafts.
   - Include clear toggle/options for **manual-only** usage.

6. **Social Posts Create API**
   - Implement `POST /api/social/posts` for persisting posts and scheduling/publishing.
   - For now, stub actual external API calls with logging / simulated responses.

### Phase 3: Integrations & Analytics

7. **Platform Integrations**
   - Wire posting flow to:
     - TikTok content posting API.
     - Meta (Instagram & Facebook) Graph API.
     - YouTube Data API.
   - Handle OAuth, token storage & refresh.

8. **Analytics**
   - Implement `GET /api/admin/analytics/videos` using `videos_insights` + social post data.
   - Integrate into the Analytics tab and/or `/admin/social`.

9. **AI Ad Recommendations**
   - Implement `POST /api/videos/recommend-ads` using `videos`, `videos_analysis`, `videos_insights`.
   - Surface recommendations inside `/admin/social` and on relevant content detail views.

### Phase 4: Share to Social & UX Polish

10. **Share to Social Widget**
    - Build reusable component.
    - Integrate into:
      - Video detail pages.
      - Product/collection pages.
      - Any other key internal pages.

11. **UX Polish**
    - Loading states, error toasts.
    - Confirmation dialogs on publish.
    - Filtering and search refinements in content library.

12. **Documentation & Onboarding**
    - Short guide for Social Managers on how to use `/admin/social`.
    - Notes on AI’s role and human final say.

---

## 9. Non-Functional Requirements

- **Reliability:**
  - Publishing actions should be idempotent where possible (avoid double-posting).
  - Clear error messages and logs when external APIs fail.

- **Security & Privacy:**
  - OAuth tokens stored securely and never exposed client-side.
  - Only `admin` and `social-manager` roles can access social endpoints.

- **Performance:**
  - AI calls should be bounded (e.g., timeouts, retries).
  - Content library should paginate/virtualize lists.

- **Maintainability:**
  - Use shared types for content payloads across backend and frontend.
  - Keep AI prompt logic centralized for easier tuning.

---

## 10. Future Extensions (Nice-to-Haves)

- **Campaign Builder:**
  - Group social posts into campaigns with start/end dates and goals.
  - AI suggests campaign structure, posting cadence, and content mix.

- **Reposting Queue:**
  - Identify high-performing evergreen content and propose new variants for reposting.

- **Brief-to-Content Workflow:**
  - Allow marketing briefs to generate content ideas, scripts, and draft social sequences.

- **Cross-Sell Intelligence:**
  - On product pages: show “top content driving traffic to this product.”
  - On content pages: show “best products to pair with this content in upcoming posts.”

This document should serve as the working spec for implementing the Social Ops & AI Content Hub inside the Odubo admin. Update it as you refine roles, flows, and UI patterns during development.

---

## 11. AI Clip Variants / "Alternate Universe" Videos

### 11.1 Purpose

Allow the Social Manager (and other authorized roles) to generate **AI-transformed variants of existing clips** that:

- Preserve the original motion, timing, and framing (mise en scène).
- Apply new visual styles or "alternate universes" based on text/image prompts.
- Are treated as first-class clips in the system, usable on the website and for social distribution.

These variants plug into the same Social Ops and analytics flows as normal clips.

### 11.2 User Stories

- **AU1 – Create an AI variant from a clip**
  - As a Social Manager, from a clip detail view I can:
    - Click **"Create AI Variant"**.
    - Enter a short style prompt (e.g., "Cyberpunk neon city at night", "Anime storyboard", "Archival VHS street footage").
    - Optionally choose a preset (e.g., "Sketch", "Anime", "VHS", "Studio Lighting", "Fashion Editorial").
    - Submit the job and see progress (Queued → Processing → Ready / Failed).
    - Get a new clip asset that I can preview, tag, and publish.

- **AU2 – Use AI variant like any other clip**
  - As a Social Manager, once a variant is ready I can:
    - View it in the Clips/Content library.
    - Attach it to products, artists, campaigns.
    - Use Social Ops to create posts from it exactly like original clips.

- **AU3 – Multi-style exploration**
  - As a Creative Director, I can:
    - Generate multiple style candidates for the same base clip (e.g., "high fashion editorial", "street camcorder", "2D animation").
    - Compare them side by side and only keep the ones we like.

- **AU4 – Guardrails & cost control**
  - As an Admin, I can:
    - Limit who can trigger AI variants (e.g., `admin`, `social-manager`).
    - Set a max number of variants per clip or per day.
    - See usage stats (how many AI render jobs, which styles are used).

### 11.3 Data Model Additions

Assuming clips are represented as entries in `videos` or a related `clips` table, we introduce a small jobs table for AI transforms.

- **`clip_ai_jobs`**
  - `id` (PK)
  - `source_clip_id` (FK to the clips/videos table)
  - `created_by_user_id` (FK to users)
  - `status` (enum: `queued`, `processing`, `completed`, `failed`, `rejected`)
  - `prompt` (text)
  - `negative_prompt` (text, optional)
  - `style_preset` (string, optional)
  - `image_prompts_json` (JSON array of image prompt objects; see below)
  - `target_purpose` (string: `clothing`, `music`, `brand`, etc.)
  - `result_clip_id` (FK to new clip when approved; null until created)
  - `result_url` (string; temporary location of the AI-generated video)
  - `style_source_json` (JSON describing source artworks/artists used for styling)
  - `error_message` (text, nullable)
  - `created_at`, `updated_at`

When an AI variant is approved, a normal clip/video record is created (e.g., in `videos` or `clips`), and `result_clip_id` links the job to the final asset.

**`image_prompts_json` structure (example):**

```json
[
  {
    "id": "painting_001",
    "url": "https://cdn.odubo.../paintings/painting_001.jpg",
    "title": "Midnight Over City",
    "artistName": "Artist A",
    "notes": "Use as main color and brushstroke reference"
  },
  {
    "id": "sketch_014",
    "url": "https://cdn.odubo.../sketches/sketch_014.png",
    "title": "Loose motion study",
    "artistName": "Artist B",
    "notes": "Use for outline shapes only"
  }
]
```

**`style_source_json` structure (example):**

```json
{
  "primaryReferences": [
    { "id": "painting_001", "title": "Midnight Over City", "artistName": "Artist A" }
  ],
  "secondaryReferences": [
    { "id": "sketch_014", "title": "Loose motion study", "artistName": "Artist B" }
  ],
  "summary": "Blend of Artist A's nocturnal city palette with Artist B's loose line work."
}
```

### 11.4 Backend Endpoints

#### 11.4.1 `POST /api/clips/:id/ai-variants`

**Purpose:** Create a new AI variant job for a given clip.

**Auth:** `admin` or `social-manager`.

**Body (example):

```json
{
  "prompt": "Cyberpunk neon city at night, high fashion editorial",
  "negativePrompt": "no glitch, no text",
  "stylePreset": "cyberpunk-editorial",
  "imagePrompts": [
    {
      "id": "painting_001",
      "url": "https://cdn.odubo.../paintings/painting_001.jpg",
      "title": "Midnight Over City",
      "artistName": "Artist A"
    }
  ],
  "targetPurpose": "clothing"
}
```

**Behavior:**

- Validates permissions.
- Creates a `clip_ai_jobs` row with `status = 'queued'`.
- Enqueues a worker job to call the external AI video transform service.

#### 11.4.2 `GET /api/clips/:id/ai-variants`

**Purpose:** List all AI variant jobs for a given clip.

**Auth:** `admin` or `social-manager`.

**Behavior:**

- Returns an array of jobs with status, prompt, style preset, and preview data (if available).

#### 11.4.3 `POST /api/clips/ai-variants/:jobId/approve`

**Purpose:** Approve a completed AI job and create a new clip entry.

**Auth:** `admin` or `social-manager`.

**Behavior:**

- Checks that the job is in `completed` state and has a `result_url`.
- Creates a new clip/video record referencing the generated media (e.g., uploads from `result_url` into permanent storage).
- Sets `result_clip_id` to the new clip ID and updates job `status` to `completed` (with approved flag if needed).

### 11.5 Worker Integration (Video Transform Pipeline)

The worker (or background process) is responsible for actually performing the AI transform.

**Workflow:**

1. Poll `clip_ai_jobs` for `status = 'queued'`.
2. For each job:
   - Resolve the source clip URL from `source_clip_id`.
   - Call the configured AI video transform API with:
     - Source video URL.
     - Text prompt.
     - Negative prompt (if provided).
     - Any style preset parameters.
3. Update job `status` to `processing` while waiting.
4. On success:
   - Store the returned video URL as `result_url`.
   - Mark `status = 'completed'`.
5. On failure:
   - Mark `status = 'failed'` and store `error_message`.

The internal details of the AI service (third-party vs self-hosted) are abstracted behind this worker.

### 11.6 Frontend Integration

#### 11.6.1 Clips UI (Admin Videos → Clips Tab)

- Add an **"AI Variant"** button near each clip.
- On click, open a modal with:
  - Prompt textarea.
  - Style preset dropdown.
  - Optional negative prompt field.
  - Target purpose selector.
  - Submit button → calls `POST /api/clips/:id/ai-variants`.
- Below each clip, show an expandable list of AI jobs:
  - Status (Queued / Processing / Ready / Failed / Rejected).
  - Thumbnail/preview when `status = 'completed'`.
  - Approve / Reject actions:
    - Approve → calls `POST /api/clips/ai-variants/:jobId/approve`.
    - Reject → sets `status = 'rejected'`.

#### 11.6.2 Social Ops UI (`/admin/social`)

- When a clip is selected in the Content Library:
  - Show a small **"Generate AI Variant"** action in the Content Detail pane.
  - If variants exist, show them as alternate thumbnails/previews for selection.
- The Social Manager can choose whether to base a social post on:
  - The original clip.
  - One of the AI variants.

### 11.7 Constraints & Guardrails

- Only authorized roles (`admin`, `social-manager`) may create AI variants or approve them.
- Admin can implement soft limits such as:
  - Max N variants per clip.
  - Max M jobs per day per user/role.
- The cost of running these jobs depends on the chosen AI provider; instrumentation should log:
  - Job counts.
  - Style presets used.
  - Failures and retry rates.

AI variants are intentionally **optional** and additive: the core Social Ops flow works without them, but they unlock a new creative dimension when needed.

---

## 12. External Vendors & Services Checklist

This section summarizes everything required **outside of VS Code** to make the Social Ops, AI, and Alternate Universe Clips features work in production.

### 12.1 Hosting & Infrastructure

- **App & API hosting**
  - Vercel / Netlify / Cloudflare Pages / Fly.io / Render, etc.
  - Requirements:
    - Support for Next.js app routes and server components.
    - Environment variable management for secrets.

- **Database & queue**
  - Primary DB: Cloudflare D1 (already in use).
  - Optional job queue (for scheduling and AI jobs):
    - Redis via Upstash / Redis Cloud / equivalent, or a managed queue service.

- **Object storage & CDN**
  - For original videos, clips, and AI variants:
    - Cloudflare R2 / AWS S3 / GCS (R2 recommended since it is likely already integrated).
  - CDN for fast delivery (Cloudflare CDN, etc.).

- **Monitoring / logging**
  - Sentry / Datadog / Better Stack / Logtail, etc.
  - Use for:
    - Error tracking (API failures, worker issues, social API problems).
    - Performance monitoring.

### 12.2 Social Platform Integrations

You will need developer accounts and apps configured with proper scopes.

- **TikTok**
  - TikTok for Developers account.
  - Registered app with content posting permissions.
  - OAuth client ID/secret and redirect URL configured to your domain.

- **Meta (Instagram + Facebook)**
  - Meta developer account.
  - App configured for:
    - Instagram Graph API.
    - Facebook Pages API.
  - App Review for required scopes (posting, managing pages, etc.).
  - Facebook Page + Instagram Business/Creator account linked to the app.

- **YouTube**
  - Google Cloud project.
  - YouTube Data API v3 enabled.
  - OAuth web client with redirect URIs set.

### 12.3 AI / LLM Services

- **LLM provider for copy, insights, recommendations**
  - Example providers: OpenAI, Azure OpenAI, Google AI (Gemini), Anthropic, etc.
  - Needs:
    - API keys.
    - Basic understanding of rate limits and pricing.

- **Transcription / ASR (optional but useful)**
  - Whisper API / AssemblyAI / Deepgram / similar.
  - Used to auto-generate transcripts from clips for better AI context.

### 12.4 AI Video Transform (Alternate Universe Clips)

- **Third-party video generation provider (recommended for MVP)**
  - Service that supports video-to-video transforms with style prompts.
  - Features required:
    - API access.
    - Ability to pass a video URL + text prompt.
    - Returns a rendered video URL.
  - Requires:
    - Account and billing/credits.
    - Documentation for integration in the worker.

- **Self-hosted (advanced option)**
  - GPU cloud (RunPod, Lambda Labs, AWS/GCP/Azure GPU instances).
  - Containerized video diffusion / style-transfer model.
  - HTTPS endpoint the worker can call.

### 12.5 Auth & Identity

- **Auth provider / identity platform** (if not already in place)
  - Auth0 / Clerk / Supabase Auth / custom implementation.
  - Must support:
    - User accounts.
    - Attaching roles (`admin`, `social-manager`, etc.).

- **Secrets management / token storage**
  - For OAuth client secrets and social platform tokens:
    - Cloudflare environment secrets / KV.
    - AWS Secrets Manager.
    - Doppler / 1Password Secrets Automation.

### 12.6 Payments & Cost Control (Optional)

- **Billing provider** (if this becomes a product for clients)
  - Stripe / Paddle / Lemon Squeezy.

- **Cost monitoring**
  - Cloud provider cost dashboards.
  - LLM / AI provider usage dashboards.
  - Internal metrics (e.g., # AI video jobs, LLM tokens used, social posts per month).

### 12.7 Project Management & Design (Non-technical but important)

- **Design & UX**
  - Figma / Sketch / similar for designing the Social Ops workspace and AI Variant flows.

- **Task/issue tracker**
  - GitHub Issues / Linear / Jira / Notion for tracking implementation tasks by phase.

- **Documentation**
  - Notion / Confluence / Google Docs for higher-level planning and non-developer collaborators.

---

## 13. MVP vs Nice-to-Have Priorities

This section prioritizes the setup and vendors into **must-have for MVP** vs **nice-to-have / later** tiers.

### 13.1 MVP – Must-Have

These are required to ship a first working version of Social Ops and basic AI.

1. **Hosting & DB**
   - Stable Next.js hosting (Vercel / Cloudflare / similar).
   - Cloudflare D1 (already in use) for core data.

2. **Object Storage**
   - Cloudflare R2 (or equivalent) for storing videos/clips and serving them via CDN.

3. **Auth & Roles**
   - Working authentication for admin.
   - Role support to distinguish `admin` vs `social-manager` (even if roles are manually edited at first).

4. **LLM Provider**
   - Single LLM API for:
     - Caption/title/description generation.
     - Insights and recommendations.
   - One API key configured in environment variables.

5. **At Least One Social Platform Integration**
   - For MVP, choose **one** platform to integrate end-to-end (e.g., Instagram or YouTube):
     - Developer account + app configured.
     - OAuth working.
     - Posting from Social Ops UI working.

6. **Basic Monitoring**
   - Minimal error logging (e.g., Sentry or logs surfaced in your hosting provider) so failures can be debugged.

### 13.2 Phase 2 – Strong Social Ops

Once MVP is live on one platform, expand vertically.

1. **Additional Social Platforms**
   - Add TikTok and YouTube (if not already in MVP).
   - Add Facebook Page posting.

2. **Transcription Service**
   - Integrate Whisper/AssemblyAI/etc. for auto transcripts.
   - Use transcripts to improve AI context and analytics.

3. **Queue / Worker Infrastructure**
   - Introduce Redis or a managed queue for:
     - Scheduling social posts.
     - Running long-running AI jobs reliably.

4. **More Robust Monitoring & Alerts**
   - Add proper alerting on:
     - Social API failures.
     - AI provider issues.
     - Worker backlog growth.

### 13.3 Phase 3 – Alternate Universe Clips (AI Video Transform)

1. **Video-to-Video AI Provider (or self-hosted)**
   - Choose and integrate a provider that can:
     - Take existing clip URLs.
     - Apply style prompts.
     - Return transformed videos.

2. **Usage & Cost Controls**
   - Implement soft usage limits per user/role.
   - Add simple reporting (jobs per day/week) so you can watch cost and adoption.

3. **Polished Review UX**
   - Side-by-side original vs AI variant.
   - Easy approve/reject workflow.

### 13.4 Phase 4 – Commercialization & Advanced Ops (Optional)

1. **Payments / Billing**
   - If offering this as a product to clients, set up billing with Stripe/Paddle/etc.

2. **Deep Analytics & Campaigns**
   - Advanced campaign builder.
   - Deeper integration with ad managers (Meta Ads / Google Ads) if desired.

3. **Self-Hosted AI (If Needed)**
   - Move from third-party AI video provider to self-hosted GPU models for cost/control.

4. **Team Collaboration Features**
   - Commenting/annotations on Social Ops drafts.
   - Approval flows between `marketing` and `social-manager`.

This prioritization should help you decide what to sign up for and configure first, and what can wait until you see value from the core Social Ops + AI experience.

---

## 14. AI Avatar Announcement Videos

### 14.1 Purpose

Enable the Social Media Manager to generate **announcement videos featuring an AI avatar of you (founder/host)** with your voice, so they can produce high-quality announcements (drops, events, updates) without needing to film you every time.

The same avatar/video generation pipeline can later be reused for other things (e.g., intros, recaps, brand content, educational content).

In the Odubo context, the **primary avatar is explicitly you (Mani)**:

- A cloned voice profile, e.g. `mani_voice_v1`.
- One or more avatar profiles, e.g. `mani_avatar_studio`, `mani_avatar_gallery`.
- The default announcement flow always uses one of these profiles, so the system clearly presents announcements as coming from you.

### 14.2 User Stories

- **AV1 – Generate announcement video from a script**
  - As a Social Manager, I can:
    - Open an "Announcements" section in Social Ops or a dedicated tab.
    - Choose a template (e.g., "New Drop", "Tour Announcement", "Feature Update").
    - Write or AI-generate a short script (30–90 seconds) that sounds like you.
    - Click **"Generate Avatar Video"** to create a video of your AI avatar delivering the script with your cloned voice.

- **AV2 – Use AI to help write the script, but keep final say**
  - As a Social Manager, I can:
    - Provide a brief (e.g., "announce new winter drop and free shipping") and let AI draft a script.
    - Edit/rewrite the script manually.
    - Only generate the avatar video after I approve the final text.

- **AV3 – Publish announcement across channels**
  - As a Social Manager, once the avatar video is ready I can:
    - Treat it like any other video/clip in the system.
    - Attach it to a campaign (e.g., "Winter Drop Launch Week").
    - Distribute it via Social Ops to TikTok, Instagram, Facebook, YouTube.
    - Optionally embed it on the website (e.g., on the homepage or drop page).

- **AV4 – Reuse and adapt**
  - As a Social Manager or Creative Director, I can:
    - Reuse an existing avatar announcement video and:
      - Trim/cut it into shorter clips.
      - Re-record or tweak specific sentences.
      - Localize variants (different languages, markets) where supported by the voice/AI stack.

### 14.3 Data Model Additions (Conceptual)

At minimum, you can represent avatar announcements as a special kind of video or campaign asset.

- **`avatar_announcement_jobs`** (optional jobs table; similar to `clip_ai_jobs`)
  - `id` (PK)
  - `created_by_user_id`
  - `status` (enum: `queued`, `processing`, `completed`, `failed`, `rejected`)
  - `script` (text; final approved script used for generation)
  - `script_source` (e.g., `manual`, `ai-assisted`)
  - `voice_profile_id` (references which cloned voice is used)
  - `avatar_profile_id` (which visual avatar/character is used)
  - `style_preset` (e.g., "studio", "gallery", "on-stage", can be reused with image prompts later)
  - `result_video_id` (FK to the final video/clip record when approved)
  - `result_url` (temporary output from the avatar service)
  - `error_message`
  - `created_at`, `updated_at`

In many implementations, you can skip a separate table and directly create video records once the result is ready, but the jobs table is useful for tracking failures/retries.

### 14.4 Backend & Vendor Considerations

To implement AI avatar videos, you generally need:

- **Voice cloning / TTS provider**
  - Train a voice model from your approved recordings.
  - Capabilities:
    - Input: text (script).
    - Output: audio in your voice.

- **Avatar video provider** (or pipeline)
  - Options include:
    - Third-party avatar services (script + voice → talking-head or full-body video).
    - Self-hosted models that animate an avatar/portrait using the audio track.
  - Requirements:
    - Input: audio (from cloned voice) + avatar reference (image/model).
    - Output: video file (mp4) with lip-sync and facial expressions.

- **Or an integrated provider**
  - Some services take just text + avatar/profile ID and output full video.
  - In that case, the app only needs to send the final script and profile ID.

From the Odubo app's perspective, the integration looks similar to the Alternate Universe Clips:

1. Social Manager submits a **script** and picks a template/avatar.
2. Backend creates an `avatar_announcement_jobs` row and sends a job to the external avatar API.
3. When the job completes, it stores `result_url` and (optionally) imports the video into your R2 bucket.
4. Creates a new `video` or `clip` record, tagged as `type = 'avatar_announcement'` for analytics.

### 14.5 Frontend Integration

- **Announcements Panel in Social Ops**
  - Entry point: a new tab or section like **"Announcements"** within `/admin/social`.
  - Features:
    - List of past announcements.
    - Button: **"New Announcement"**.
    - Form:
      - Title (internal name).
      - Brief (goal, audience, channel emphasis).
      - Script editor with AI-assist (similar to caption generation, but longer form).
      - Avatar/voice profile selection.
      - Generate button that triggers an `avatar_announcement_jobs` entry.

- **Review & Approve Flow**
  - Once generation completes:
    - Show video preview.
    - Buttons: **Approve** (create video asset), **Regenerate** (with modified script), **Reject**.
  - On approval, the video appears in the Content Library, tagged as an avatar announcement.

- **Use in Social Posts**
  - In Social Ops composer, avatar announcements are just another content source:
    - Filter for `type = 'avatar_announcement'`.
    - Create platform-specific posts based on the video.

### 14.6 Guardrails & Identity

- **Consent & control**
  - Only allow specific roles (`admin` plus explicitly designated `social-manager`) to create avatar videos with your likeness.
  - Ideally, have an internal policy and UI hint that clarifies acceptable use (no off-brand or misleading messages).

- **Versioning**
  - If your style/voice/avatar evolves, you may want multiple `avatar_profile_id` entries (e.g., different visual looks or eras).

- **Attribution & Transparency**
  - Clearly label these as AI-generated announcements in internal tools.
  - Decide whether you want to disclose this on public channels (e.g., "AI-assisted announcement" tag) per platform norms.

This AI Avatar feature is designed to sit alongside Alternate Universe Clips and Social Ops, giving your Social Media Manager a powerful tool to keep a consistent, founder-led voice and presence without constant manual filming.