# Action Plan: The "Odubo Engine" Architecture Upgrade

**Objective:** Transform the current app into a fully reliable, headless analytics and commerce engine that bypasses Shopify Basic limitations and unlocks deep content-to-commerce insights.

**Tech Stack Context:** Next.js (App Router), Cloudflare D1 (Database), Shopify Basic (Headless), Cloudflare R2 (Media).

---

## Progress Tracker

| Phase | Status | Completed |
|-------|--------|-----------|
| Phase 1: Reliability Hardening | ✅ Complete | 2025-01-22 |
| Phase 2: Financial Truth | ✅ Already Implemented | (previously) |
| Phase 3: Content Intelligence | ✅ Complete | 2025-01-22 |
| Phase 4: Commerce Optimization | ✅ Complete | 2025-01-22 |
| Phase 5: Resilience | ⏳ Pending | - |

---

## Phase 1: Reliability Hardening (The "No Silent Failures" Layer) ✅

*Goal: Ensure the data we collect is accurate, stable, and immune to bots.*

### 1.1 Remove "Schema Sniffing" Pattern ✅

**Context:** The app currently "guesses" if columns exist, masking DB migration failures.

* **Action:** Edit `src/app/api/videos/route.ts`.
* **Task:** Remove the `try/catch` block around the main query. If a column is missing, the app *must* throw an error so we know to run migrations. Trust `database/schema.sql` as the source of truth.
* **Completed:** 2025-01-22 - Removed from `videos/route.ts` and `videos/cleanup/route.ts`

### 1.2 Harden Shopify Webhooks ✅

**Context:** Current webhooks delete and re-insert line items, destroying history.

* **Action:** Edit `src/app/api/webhooks/shopify/route.ts`.
* **Task:** Replace the `DELETE` + `INSERT` logic with an `UPSERT` (Insert on Conflict Update) strategy using `shopify_line_item_id` as the unique key.
* **Completed:** 2025-01-22 - Added unique constraint, UPSERT pattern, fixed customer total_orders bug

### 1.3 Implement Bot Filtering ✅

**Context:** Spiders and crawlers are inflating visitor counts.

* **Action:** Edit `src/app/api/analytics/events/route.ts`.
* **Task:** Check the `User-Agent` header. If it contains `bot`, `crawl`, `spider`, or `slurp`, return a 200 OK (to satisfy them) but **do not** insert the event into `fan_activity`.
* **Completed:** Previously implemented with comprehensive BOT_PATTERNS

---

## Phase 2: Financial Truth (The "Profit" Layer) ✅ ALREADY IMPLEMENTED

*Goal: Move from "Vanity Revenue" to "Net Profit" reporting.*

**Discovery:** This phase was already implemented prior to this work:
- `bi_product_costs` table exists in migration 079
- `bi_expenses` table exists in migration 079
- Dashboard revenue already sources from `commerce_orders.total_price_cents`

### 2.1 Create Financial Schema ✅

* **Status:** `bi_product_costs` and `bi_expenses` tables exist

### 2.2 Switch Revenue Source of Truth ✅

* **Status:** Dashboard uses `commerce_orders` table for revenue calculations

---

## Phase 3: Content Intelligence (The "Viral" Layer) ✅

*Goal: Identify which videos create superfans and viral loops.*

### 3.1 Explicit Parent Video Linking ✅

**Context:** Linking clips via JSON strings (`related_projects`) makes analytics math impossible.

* **Action:**
  1. Create migration: `ALTER TABLE videos ADD COLUMN parent_video_id INTEGER REFERENCES videos(id);` + `CREATE INDEX idx_parent ON videos(parent_video_id);`.
  2. Update `src/app/api/videos/[id]/clips/route.ts` (POST) to save `parent_video_id` explicitly on creation.
* **Completed:** 2025-01-22 - 113 clips backfilled with parent_video_id

### 3.2 Enhanced Engagement Tracking (Loops & Hooks) ✅

**Context:** We need to know if people are looping content or swiping away instantly.

* **Action:**
  1. Update Schema: Add `clip_duration_ms` (INT) and `pct_watched` (REAL) to `clip_view_events` table.
  2. Update API `src/app/api/clips/engagement/route.ts`: Calculate `pct_watched` (`watch_time / clip_duration`) before inserting.

* **Insight:** Enables querying "Average Loops per User" per clip.
* **Completed:** 2025-01-22 - pct_watched capped at 10 (10 loops max)

### 3.3 The "Gateway Drug" Metric ✅

**Context:** Track if a clip converts a casual viewer into a long-form viewer.

* **Action:**
  1. Update `src/components/clips/ClipsFeed.tsx` (or SingleVideoPlayer): Add a "Watch Full Video" button if `parent_video_id` exists.
  2. Track Click: Fire a `full_video_click` event to `fan_activity`.
* **Completed:** 2025-01-22 - Button added to SingleVideoPlayer.tsx

---

## Phase 4: Commerce Optimization (The "Closing" Layer) ✅

*Goal: Recover lost sales and prevent overselling.*

### 4.1 Persistent Server-Side Cart ✅

**Context:** Carts currently live in `localStorage` and die if the user switches devices.

* **Completed:** 2025-01-22
  - Created `carts` table (migration 086)
  - Created `/api/store/cart/sync` API (POST: sync, GET: retrieve)
  - Updated `useCart.ts` with debounced server sync (500ms)
  - Added visitor ID management for cross-device persistence

### 4.2 Real-Time Inventory Guard ✅

**Context:** 60s cache on products risks overselling viral drops.

* **Completed:** 2025-01-22
  - Created `/api/store/inventory` API using Shopify Admin API
  - Updated `CartPageClient.tsx` to check inventory before checkout
  - Shows error for out-of-stock items, prevents redirect
  - Fails open (allows checkout) if API unavailable

### 4.3 Attribution Injection ✅

**Context:** Pass tracking data to Shopify so we know where sales came from.

* **Completed:** 2025-01-22
  - Updated `createCheckout` in `src/lib/store/api.ts`
  - Injects: `_source`, `_session`, `_visitor`, `_utm_source`, `_utm_medium`, `_utm_campaign`

### 4.4 Shoppable Moments ✅

**Context:** Convert content views directly to sales.

* **Completed:** 2025-01-22
  - Added `shopify_product_id` and `shopify_product_handle` columns to `galleries` table
  - Updated gallery API to return product fields
  - Added "Shop Now" button to gallery page that opens QuickShopModal

---

## Phase 5: Resilience (The "Offline" Layer)

*Goal: Capture data from users with bad connections (e.g., at live events).*

### 5.1 Offline Event Queue

**Context:** If a tab closes on a slow network, data is lost.

* **Action:** Edit `src/contexts/AnalyticsContext.tsx`.
* **Task:**
  1. Save the `eventBuffer` to `localStorage` before window unload.
  2. On next app load, check `localStorage` for "stale events" and attempt to resend them.
  3. Use `navigator.sendBeacon` for the critical `page_leave` event.

---

## Execution Order

1. **Phase 1** ✅ - Stops the bleeding (bad data, bot traffic)
2. **Phase 3** ✅ - Unique value prop (Clip/Music analytics)
3. **Phase 2 & 4** ✅ - Bridge "Cool App" to "Business Tool"
4. **Phase 5** ⏳ - Edge case optimization (remaining)
