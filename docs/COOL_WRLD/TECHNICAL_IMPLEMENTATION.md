# COOL WRLD - TECHNICAL IMPLEMENTATION

> Backend architecture, database schema, and implementation guide.

---

## Overview

This document covers the **technical implementation** of the Cool Wrld ecosystem. For the creative vision and philosophy, see [VISION.md](./VISION.md). For MyMoments details, see [MYMOMENTS_SPEC.md](./MYMOMENTS_SPEC.md). For account architecture, see [ACCOUNT_ARCHITECTURE.md](./ACCOUNT_ARCHITECTURE.md).

**Current State**: Odubo platform has 37 public pages, 25+ admin pages, 8 content systems, and 115+ database migrations. The infrastructure is 80% built. This document covers the remaining 20%.

---

## PART 1: DATABASE ARCHITECTURE

### 1.1 New Tables for Cool Wrld

#### Series Management

```sql
-- Series (Loops Soul, future series)
CREATE TABLE cool_wrld_series (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- "Loops Soul"
  slug TEXT UNIQUE NOT NULL,            -- "loops-soul"
  description TEXT,
  universe_tag TEXT,                     -- "loops_soul", "odubo_music"
  season_count INTEGER DEFAULT 0,
  cover_image_url TEXT,
  status TEXT DEFAULT 'active',          -- active | paused | ended
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Episodes
CREATE TABLE cool_wrld_episodes (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES cool_wrld_series(id),
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,                   -- "The Genesis Blueprint"
  description TEXT,
  air_date DATE,
  gallery_id TEXT REFERENCES galleries(id),  -- Event gallery
  video_id TEXT REFERENCES videos(id),    -- Full episode video
  trailer_video_id TEXT REFERENCES videos(id),
  status TEXT DEFAULT 'draft',            -- draft | scheduled | live | archived
  featured_track_ids TEXT,               -- JSON: ["track_1", "track_2"]
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  engagement_metrics TEXT,               -- JSON: {views, rsvps, contributions}
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(series_id, episode_number)
);

-- Episode Activity Log (for tracking what happened)
CREATE TABLE episode_activities (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES cool_wrld_episodes(id),
  activity_name TEXT NOT NULL,          -- "The Soul Loop", "Cypher"
  activity_type TEXT,                   -- "dance", "music", "game", "interview"
  timestamp_start TIME,
  timestamp_end TIME,
  highlight_clip_id TEXT REFERENCES videos(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Founding Members

```sql
-- Founding Members across the universe
CREATE TABLE founding_members (
  id TEXT PRIMARY KEY,
  user_identifier TEXT NOT NULL,         -- email or anonymous_id
  user_id TEXT REFERENCES users(id),    -- NULL for anonymous RSVPs
  first_series_id TEXT REFERENCES cool_wrld_series(id),
  first_episode_id TEXT REFERENCES cool_wrld_episodes(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  badge_visible BOOLEAN DEFAULT TRUE,
  perk_level TEXT DEFAULT 'founding',   -- founding | early | supporter
  personal_note TEXT,                   -- Opt-in: "Why I joined"
  invite_code TEXT,                     -- Personal invite link code
  invited_by_id TEXT REFERENCES founding_members(id),
  
  UNIQUE(user_identifier, first_episode_id)
);

-- Member Activity Timeline
CREATE TABLE member_activities (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES founding_members(id),
  activity_type TEXT NOT NULL,          -- rsvp | upload | share | comment | checkin
  content_uuid TEXT,                    -- What they engaged with
  episode_id TEXT REFERENCES cool_wrld_episodes(id),
  gallery_id TEXT REFERENCES galleries(id),
  metadata TEXT,                        -- JSON: extra context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Founding Member Perks (configurable)
CREATE TABLE founding_perks (
  id TEXT PRIMARY KEY,
  perk_level TEXT NOT NULL,             -- founding | early | supporter
  perk_key TEXT NOT NULL,               -- "early_access", "exclusive_content"
  perk_value TEXT NOT NULL,             -- true, "url", etc.
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Unified Content Connections

```sql
-- Cross-link any content types
CREATE TABLE content_connections (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,             -- video | clip | track | album | gallery | game
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  connection_type TEXT NOT NULL,         -- features | sequel | remix | bts | related | soundtrack | merchandise
  metadata TEXT,                        -- JSON: timestamps, descriptions
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id),
  
  INDEX idx_source (source_type, source_id),
  INDEX idx_target (target_type, target_id)
);

-- Examples:
-- {source: video, id: ep1_full, target: track, id: track_soul, type: soundtrack}
-- {source: gallery, id: ep1_gallery, target: video, id: ep1_full, type: bts}
-- {source: clip, id: clip_cypher, target: episode, id: ep1, type: featured}
```

#### Fan Content Rights

```sql
-- Rights management for fan contributions
CREATE TABLE fan_content_rights (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,            -- gallery_photo | clip | community_post
  content_id TEXT NOT NULL,
  contributor_identifier TEXT NOT NULL, -- email or user_id
  rights_granted TEXT NOT NULL,         -- JSON: {episode: true, promo: true, social: true}
  rights_revoked BOOLEAN DEFAULT FALSE,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Community Wall

```sql
-- Unified community posts (pre/during/post event)
CREATE TABLE community_posts (
  id TEXT PRIMARY KEY,
  user_identifier TEXT,                  -- NULL for anonymous
  user_id TEXT REFERENCES users(id),
  post_type TEXT NOT NULL,              -- hype_video | outfit_preview | reaction | question | fan_photo
  episode_id TEXT REFERENCES cool_wrld_episodes(id),
  gallery_id TEXT REFERENCES galleries(id),
  content_url TEXT,                     -- Video or image URL
  caption TEXT,
  status TEXT DEFAULT 'pending',        -- pending | approved | featured | rejected
  featured_at TIMESTAMP,
  rejection_reason TEXT,
  moderation_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  moderated_at TIMESTAMP,
  moderated_by TEXT REFERENCES users(id),
  
  INDEX idx_episode_status (episode_id, status)
);
```

#### Episode RSVPs (Extended)

```sql
-- Enhanced RSVPs with founding member tracking
ALTER TABLE gallery_rsvps ADD COLUMN episode_id TEXT REFERENCES cool_wrld_episodes(id);
ALTER TABLE gallery_rsvps ADD COLUMN is_founding_rsvp BOOLEAN DEFAULT FALSE;
ALTER TABLE gallery_rsvps ADD COLUMN checked_in BOOLEAN DEFAULT FALSE;
ALTER TABLE gallery_rsvps ADD COLUMN checked_in_at TIMESTAMP;

-- RSVP Tiers
ALTER TABLE gallery_rsvps ADD COLUMN rsvp_tier TEXT DEFAULT 'general';  -- general | vip | press
ALTER TABLE gallery_rsvps ADD COLUMN dietary_notes TEXT;
ALTER TABLE gallery_rsvps ADD COLUMN media_outlet TEXT;
ALTER TABLE gallery_rsvps ADD COLUMN coverage_link TEXT;
```

### 1.2 Existing Tables (Extensions Needed)

#### Galleries (Events)

```sql
-- Add to existing galleries table
ALTER TABLE galleries ADD COLUMN series_id TEXT REFERENCES cool_wrld_series(id);
ALTER TABLE galleries ADD COLUMN episode_id TEXT REFERENCES cool_wrld_episodes(id);
ALTER TABLE galleries ADD COLUMN is_event BOOLEAN DEFAULT FALSE;
ALTER TABLE galleries ADD COLUMN event_date DATE;
ALTER TABLE galleries ADD COLUMN event_venue TEXT;
ALTER TABLE galleries ADD COLUMN event_capacity INTEGER;
ALTER TABLE galleries ADD COLUMN checkin_enabled BOOLEAN DEFAULT FALSE;
```

#### Videos

```sql
-- Already has track_id, album_id - need to add episode
ALTER TABLE videos ADD COLUMN episode_id TEXT REFERENCES cool_wrld_episodes(id);
ALTER TABLE videos ADD COLUMN clip_type TEXT;  -- teaser | highlight | behind_scenes | fan
```

#### Clips (Video Deployments)

```sql
-- Add episode context to clips
ALTER TABLE video_deployments ADD COLUMN episode_id TEXT REFERENCES cool_wrld_episodes(id);
ALTER TABLE video_deployments ADD COLUMN is_episode_featured BOOLEAN DEFAULT FALSE;
```

---

## PART 2: API ROUTES

### 2.1 New API Endpoints

#### Series & Episodes

```
GET    /api/cool-wrld/series                    -- List all series
POST   /api/cool-wrld/series                    -- Create series (admin)
GET    /api/cool-wrld/series/[slug]             -- Get series details
PUT    /api/cool-wrld/series/[slug]             -- Update series (admin)
DELETE /api/cool-wrld/series/[slug]             -- Delete series (admin)

GET    /api/cool-wrld/series/[slug]/episodes    -- List episodes
POST   /api/cool-wrld/episodes                  -- Create episode (admin)
GET    /api/cool-wrld/episodes/[id]             -- Get episode
PUT    /api/cool-wrld/episodes/[id]             -- Update episode (admin)
POST   /api/cool-wrld/episodes/[id]/publish     -- Publish episode (admin)
GET    /api/cool-wrld/episodes/[id]/gallery     -- Get episode gallery
POST   /api/cool-wrld/episodes/[id]/gallery     -- Add to episode gallery
```

#### Founding Members

```
GET    /api/cool-wrld/members                   -- List members (admin)
POST   /api/cool-wrld/members                   -- Create/track member
GET    /api/cool-wrld/members/[id]              -- Get member profile
GET    /api/cool-wrld/members/[id]/activity      -- Get member activity
GET    /api/cool-wrld/members/check/[email]     -- Check founding status
POST   /api/cool-wrld/members/[id]/perks        -- Grant perk (admin)
```

#### Community Wall

```
GET    /api/cool-wrld/community                 -- List posts (filterable)
POST   /api/cool-wrld/community                 -- Create post
GET    /api/cool-wrld/community/[id]            -- Get post
PUT    /api/cool-wrld/community/[id]             -- Update post
DELETE /api/cool-wrld/community/[id]             -- Delete post
POST   /api/cool-wrld/community/[id]/moderate   -- Moderate post (admin)
POST   /api/cool-wrld/community/[id]/feature    -- Feature post (admin)
```

#### Content Connections

```
GET    /api/cool-wrld/connect/[type]/[id]       -- Get connections
POST   /api/cool-wrld/connect                    -- Create connection (admin)
DELETE /api/cool-wrld/connect/[id]              -- Remove connection (admin)
GET    /api/cool-wrld/episode/[id]/related      -- Get related content for episode
```

#### RSVP & Check-in

```
POST   /api/cool-wrld/rsvp                      -- RSVP (enhanced)
GET    /api/cool-wrld/rsvp/[event_id]           -- Get RSVPs (admin)
POST   /api/cool-wrld/checkin/[code]            -- Check-in by code
GET    /api/cool-wrld/checkin/[event_id]/stats  -- Check-in stats (admin)
```

### 2.2 Existing API Extensions

#### Moments Galleries

```
POST   /api/moments/galleries (enhanced)
  - Add: series_id, episode_id, is_event, event_date, event_venue
  - Returns: founding_member_eligible, rsvp_count

POST   /api/moments/rsvp (enhanced)
  - Add: rsvp_tier, is_founding_rsvp flag
  - Returns: founding_badge_eligible, member_id if first episode
```

---

## PART 3: ADMIN STUDIO INTEGRATION

### 3.1 New Admin Sections

```
/admin/cool-wrld/
├── Series Manager
│   ├── /admin/cool-wrld/series
│   │   ├── List all series
│   │   ├── Create new series
│   │   └── Series settings
│   │
│   └── /admin/cool-wrld/series/[slug]
│       ├── Series details
│       ├── Season management
│       └── Delete/archive
│
├── Episode Builder
│   ├── /admin/cool-wrld/episodes
│   │   ├── Episode grid/list
│   │   ├── Filter by series/season
│   │   └── Quick actions (publish, archive)
│   │
│   └── /admin/cool-wrld/episodes/[id]
│       ├── Episode Info (title, description, air date)
│       ├── Connect Video (Cloudflare Stream)
│       ├── Connect Gallery
│       ├── Connect Trailer
│       ├── Featured Tracks (link to albums)
│       ├── Activity Log
│       ├── Community Posts
│       ├── Publishing Settings
│       └── Preview
│
├── Community Hub
│   ├── /admin/cool-wrld/community
│   │   ├── Post moderation queue
│   │   ├── Featured posts
│   │   └── Post analytics
│   │
│   └── /admin/cool-wrld/community/[id]
│       ├── Post details
│       ├── Moderate/feature/reject
│       └── Link to source content
│
├── Founding Members
│   ├── /admin/cool-wrld/members
│   │   ├── Member list
│   │   ├── Filter by series/perk level
│   │   └── Export
│   │
│   └── /admin/cool-wrld/members/[id]
│       ├── Profile
│       ├── Activity timeline
│       ├── Perk management
│       └── Notes
│
└── Activity Pool
    ├── /admin/cool-wrld/activities
    │   ├── Activity library
    │   ├── Create/edit activities
    │   └── Activity types
    │
    └── /admin/cool-wrld/episodes/[id]/activities
        ├── Episode activity log
        ├── Add activity
        └── Mark highlights
```

### 3.2 Enhanced Existing Admin Tabs

#### Moments Admin (Existing `/admin/moments`)

**Add**:
- "Connect to Episode" button
- Episode selector
- Check-in mode toggle
- Event capacity setting
- Founding member RSVP toggle

#### Arsenal/Clips Admin

**Add**:
- "Link to Episode" in clip metadata
- "Mark as Episode Featured"
- Clip → Episode visibility

---

## PART 4: FRONTEND PAGES

### 4.1 New Public Pages

#### Episode Hub

```
/loops-soul/                    -- Series page
├── Series info
├── Episode list
├── About
└── Founding Members (credits)

/loops-soul/s01e01/           -- Episode page
├── Episode header (title, date, thumbnail)
├── Watch section
│   ├── Full episode (Stream embed)
│   ├── Trailer
│   └── Chapter markers
├── Gallery
│   ├── Event photos
│   ├── Fan contributions
│   └── Upload CTA
├── Clips
│   ├── Episode clips
│   └── Fan clips
├── Soundtrack
│   └── Tracks used (linked to music)
├── Community
│   ├── Pre-event hype
│   ├── Live reactions
│   └── Post-event comments
└── Related Episodes
```

#### Community Wall

```
/loops-soul/community/         -- Community hub
├── Pre-Event Hype
├── Live Feed (during event)
├── Episode Reactions
└── Between Seasons
```

### 4.2 Enhanced Existing Pages

#### Moments Gallery (`/moments/gallery/[id]`)

**Add**:
- Episode badge/link if connected
- "Contribute to Episode" CTA
- Fan content rights consent modal
- Activity context (what was happening)

#### Moments Profile (`/moments/profile`)

**Add**:
- Founding Member badge (if eligible)
- Member number (private)
- Activity timeline
- Contributions to canon
- Cool Points balance

### 4.3 MyMoments Pages

```
/mymoments/                        -- Vault hub
├── Points balance
├── Recent captures
├── Create Content CTA
└── Browse Events

/mymoments/[eventId]/             -- Event vault
├── My captures from this event
├── Upload new
├── Share
└── Repurposing requests

/mymoments/leaderboard            -- Top earners

/mymoments/redeem                 -- Rewards catalog
```

---

## PART 5: IMPLEMENTATION CHECKLIST

### Phase 1: Database Foundation

- [ ] Create `cool_wrld_series` table
- [ ] Create `cool_wrld_episodes` table
- [ ] Create `episode_activities` table
- [ ] Create `founding_members` table
- [ ] Create `member_activities` table
- [ ] Create `founding_perks` table
- [ ] Create `content_connections` table
- [ ] Create `fan_content_rights` table
- [ ] Create `community_posts` table
- [ ] Add columns to `galleries` table
- [ ] Add columns to `videos` table
- [ ] Add columns to `gallery_rsvps` table
- [ ] Add columns to `video_deployments` table

### Phase 2: API Routes

- [ ] Implement `/api/cool-wrld/series/*` routes
- [ ] Implement `/api/cool-wrld/episodes/*` routes
- [ ] Implement `/api/cool-wrld/members/*` routes
- [ ] Implement `/api/cool-wrld/community/*` routes
- [ ] Implement `/api/cool-wrld/connect/*` routes
- [ ] Extend `/api/moments/galleries` with series fields
- [ ] Extend `/api/moments/rsvp` with founding flags

### Phase 2b: MyMoments API

- [ ] Implement `/api/mymoments/vault/*` routes
- [ ] Implement `/api/mymoments/contents/*` routes
- [ ] Implement `/api/mymoments/repurpose/*` routes
- [ ] Implement `/api/mymoments/points/*` routes
- [ ] Implement `/api/mymoments/event/*` routes (event contents)

### Phase 3: Admin Studio

- [ ] Create `/admin/cool-wrld` layout
- [ ] Build Series Manager UI
- [ ] Build Episode Builder UI
- [ ] Build Community Moderation UI
- [ ] Build Founding Members UI
- [ ] Build Activity Pool UI
- [ ] Enhance Moments admin with episode linking
- [ ] Enhance Arsenal with episode linking

### Phase 4: Frontend Pages

- [ ] Create `/loops-soul/series-page`
- [ ] Create `/loops-soul/[episode-slug]` pages
- [ ] Create Episode hub template
- [ ] Enhance gallery page with episode context
- [ ] Enhance profile page with founding badge
- [ ] Create Community Wall page

### Phase 4b: MyMoments Frontend

- [ ] Create `/mymoments/` vault hub
- [ ] Create `/mymoments/[eventId]/` event vault
- [ ] Create `/mymoments/leaderboard` page
- [ ] Create `/mymoments/redeem` rewards page
- [ ] Build Creator Tools modal
- [ ] Build Share modal with platform presets
- [ ] Build Repurposing request flow

### Phase 5: User Flows

- [ ] RSVP → Founding Member flow
- [ ] Check-in flow
- [ ] Fan upload → Rights consent → Moderation → Episode
- [ ] Episode publishing flow
- [ ] RSVP → MyMoments unlock flow
- [ ] Capture → Upload → Points flow
- [ ] Browse → Repurpose request → Approval flow

---

## PART 6: MIGRATION FILES

### Migration Sequence

```
116_cool_wrld_series.sql          -- Series table
117_cool_wrld_episodes.sql       -- Episodes table
118_cool_wrld_activities.sql     -- Episode activities
119_founding_members.sql         -- Founding members
120_member_activities.sql         -- Member activity log
121_founding_perks.sql           -- Perk config
122_content_connections.sql       -- Cross-content links
123_fan_content_rights.sql       -- Rights management
124_community_posts.sql           -- Community wall
125_extend_galleries.sql         -- Add series/episode to galleries
126_extend_videos.sql            -- Add episode to videos
127_extend_rsvps.sql             -- Add founding/checkin to rsvps
128_extend_deployments.sql       -- Add episode to deployments

-- MyMoments (Phase 1)
129_mymoments_vaults.sql         -- Personal vaults
130_mymoments_contents.sql      -- Vault contents
131_cool_points.sql             -- Points system
132_repurposing.sql             -- Repurposing requests
```

### MyMoments Tables (Detailed)

See [MYMOMENTS_SPEC.md](./MYMOMENTS_SPEC.md) for full schema.

---

## PART 7: COMPONENT ARCHITECTURE

### 7.1 New React Components

```
src/components/cool-wrld/
├── SeriesBadge.tsx              -- Series indicator
├── EpisodeCard.tsx               -- Episode preview card
├── EpisodeHero.tsx               -- Episode header
├── WatchSection.tsx              -- Video player section
├── GallerySection.tsx            -- Episode gallery
├── ClipsSection.tsx              -- Episode clips
├── SoundtrackSection.tsx         -- Featured tracks
├── CommunitySection.tsx           -- Episode community
├── ActivityWheel.tsx             -- Activity picker (host)
├── ActivityLog.tsx               -- Activity timeline
├── FoundingBadge.tsx             -- Member badge
├── FoundingProfile.tsx           -- Member profile
├── MemberTimeline.tsx            -- Activity history
├── CommunityPost.tsx             -- Single post
├── CommunityFeed.tsx             -- Post feed
├── ModerationQueue.tsx           -- Admin moderation
├── CheckInScanner.tsx            -- QR/code scanner
└── RightsConsent.tsx             -- Upload consent modal
```

### 7.2 Context Extensions

```tsx
// Extend existing contexts or create new
CoolWrldContext.tsx
├── currentSeries
├── currentEpisode
├── foundingMemberStatus
└── communityPosts

// Add to existing contexts
StoreContext.tsx
├── addEpisodeMerch(episodeId)    // Link products to episode

MusicPlayerContext.tsx
├── loadEpisodeSoundtrack(episodeId)  // Auto-play featured tracks
```

---

## PART 8: STORAGE ORGANIZATION

### 8.1 R2 Path Structure

```
r2://odubo/
├── galleries/
│   ├── {gallery_id}/
│   │   ├── photos/
│   │   │   ├── original/
│   │   │   └── optimized/
│   │   └── thumbnails/
│   │
│   └── episodes/                    -- NEW: Episode-specific
│       ├── {episode_id}/
│       │   ├── event_photos/
│       │   ├── bts_content/
│       │   └── thumbnails/
│
├── community/                       -- NEW: Community wall
│   ├── posts/
│   │   ├── {episode_id}/
│   │   │   ├── hype_videos/
│   │   │   └── outfit_previews/
│   │
│   └── moderated/
│       ├── approved/
│       └── rejected/
│
└── series/                          -- NEW: Series assets
    ├── {series_slug}/
    │   ├── cover_images/
    │   ├── episode_thumbnails/
    │   └── promotional/
```

### 8.2 Cloudflare Stream

```javascript
// Episode video IDs stored in cool_wrld_episodes.video_id
// Existing: videos.uid links to Stream delivery

// Episode chapters via content_connections
// {type: "chapter", timestamp: "00:15:30", title: "The Soul Loop"}
```

---

## PART 9: INTEGRATION POINTS

### 9.1 Existing Systems to Connect

| System | Integration |
|--------|-------------|
| **Clips/Arsenal** | Link clips to episodes, auto-feature |
| **Music** | Episode soundtrack, track credits |
| **Store** | Episode merchandise bundles |
| **Moments** | Gallery → Episode, RSVP → Founding |
| **Games** | Episode tie-ins, soundtrack games |
| **Featured** | Episode landing pages |

### 9.2 Third-Party Integrations

| Service | Integration |
|---------|-------------|
| **PostForMe** | Auto-post episode clips to social |
| **Shopify** | Episode merch, founding member discounts |
| **Email** | RSVP confirmations, episode notifications |
| **YouTube** | Episode embeds, view tracking |

---

## PART 10: SECURITY & PERMISSIONS

### 10.1 Role-Based Access

```typescript
type Role = 'admin' | 'host' | 'moderator' | 'member' | 'anon';

const permissions = {
  admin: ['*'],
  host: ['episode.manage', 'activity.log', 'content.feature'],
  moderator: ['community.moderate', 'fan.approve'],
  member: ['community.post', 'gallery.upload'],
  anon: ['rsvp.create', 'community.view']
};
```

### 10.2 Content Rights

```typescript
// Fan uploads default to:
const defaultRights = {
  episodeUse: true,      // Can appear in episode
  promoUse: true,        // Can be used in promos
  socialUse: true,       // Can be shared on social
  commercialUse: false   // Cannot be sold/licensed
};
```

---

## APPENDIX: MIGRATION TEMPLATE

```sql
-- Migration: 129_cool_wrld_loops_soul_init.sql
-- Description: Initialize Loops Soul as first Cool Wrld series

BEGIN;

-- Create the Loops Soul series
INSERT INTO cool_wrld_series (id, name, slug, description, universe_tag, status)
VALUES (
  'cw_loops_soul',
  'Loops Soul',
  'loops-soul',
  'The origin story. A serialized web series capturing the intersection of music, fashion, and dance in Kamloops.',
  'loops_soul',
  'active'
);

-- Create Season 1
INSERT INTO cool_wrld_episodes (id, series_id, episode_number, title, status)
VALUES 
  ('ls_s01e01', 'cw_loops_soul', 1, 'The Genesis Blueprint', 'draft'),
  ('ls_s01e02', 'cw_loops_soul', 2, 'TBD', 'draft'),
  ('ls_s01e03', 'cw_loops_soul', 3, 'TBD', 'draft');

-- Initialize founding perks
INSERT INTO founding_perks (id, perk_level, perk_key, perk_value)
VALUES 
  ('perk_early_access', 'founding', 'early_access', 'true'),
  ('perk_bts', 'founding', 'exclusive_content', 'bts'),
  ('perk_invite', 'founding', 'invite_links', 'true');

COMMIT;
```

---

## PART 11: AUTHENTICATION & ACCOUNTS

### 11.1 Clerk Setup

```typescript
// src/lib/clerk.ts
import { Clerk } from '@clerk/nextjs';

export const clerk = new Clerk(process.env.CLERK_SECRET_KEY!);
```

### 11.2 Middleware

```typescript
// middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/rsvp/.*", "/moments/.*", "/api/moments/.*"],
  ignoredRoutes: ["/api/webhooks/clerk"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)"],
};
```

### 11.3 Linking Flow

```typescript
// src/lib/account-linking.ts
export async function linkShopifyAccount(userId: string, email: string) {
  // 1. Find Shopify customer by email
  const customer = await shopify.customer.list({
    query: `email:${email}`,
    limit: 1,
  });
  
  if (customer.length > 0) {
    // 2. Link in Clerk metadata
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        shopify_customer_id: customer[0].id,
        linked_at: new Date().toISOString(),
      },
    });
    
    // 3. Calculate VIP tier
    const tier = calculateTier(customer[0]);
    await updateUserTier(userId, tier);
    
    return { linked: true };
  }
  
  return { linked: false };
}
```

### 11.4 Webhook Handler

```typescript
// src/app/api/webhooks/clerk/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  
  switch (body.type) {
    case "user.created":
      await linkShopifyAccount(body.data.id, body.data.email);
      break;
    case "user.deleted":
      await cleanupCoolPoints(body.data.id);
      break;
  }
  
  return new Response("OK", { status: 200 });
}
```

---

**Version**: 1.2
**Created**: 2026-04-15
**Updated**: 2026-04-17
**Status**: Implementation Guide
**Dependencies**: VISION.md, MYMOMENTS_SPEC.md, ACCOUNT_ARCHITECTURE.md, existing migrations (001-128)
