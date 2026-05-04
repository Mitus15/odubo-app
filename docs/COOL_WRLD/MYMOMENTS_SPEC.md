# MyMoments - Technical Specification

> Personal vaults and creative tools for Cool Wrld community members.

---

## Overview

**MyMoments** is every attendee's personal content vault and creative toolkit. It's the gateway to the Cool Wrld universe — turning event attendees into app users, and app users into invested community members.

### Key Features

1. **Personal Vault** - Archive all photos/videos from events
2. **Creator Tools** - Edit, format, and enhance content
3. **One-Tap Sharing** - Deploy to any social platform
4. **Community Viewing** - See what others captured
5. **Repurposing** - Request and grant permission to use others' content
6. **Cool Points** - Earn rewards through engagement

---

## User Flows

### 1. RSVP Unlock Flow

```
User RSVPs to event
    ↓
Confirmation email/link
    ↓
Download app or sign in
    ↓
MyMoments unlocked for event
    ↓
"Can I access" → "Your vault is ready"
```

### 2. Capture Flow (Event Night)

```
Arrive at event
    ↓
Open app / Scan QR
    ↓
MyMoments → Capture
    ↓
Take photo or video (max 60s)
    ↓
Review → Upload
    ↓
"+15 Cool Points!"
    ↓
See: "234 others have captured tonight"
```

### 3. Post-Event Flow

```
Event ends
    ↓
"MyVault" notification
    ↓
View all your captures
    ↓
Browse event gallery (others' captures)
    ↓
Select → Create Content
    ↓
Format for platform
    ↓
Share → "+20 Cool Points!"
```

### 4. Repurposing Flow

```
Browse others' captures
    ↓
See content you like
    ↓
"Request to Repurpose"
    ↓
Owner receives notification
    ↓
Owner approves/denies
    ↓
If approved → Get branded template
    ↓
Share → Credits original creator
    ↓
Original creator earns +50 Cool Points
```

---

## Data Architecture

### 3.1 MyMoments Tables

```sql
-- Personal vaults
CREATE TABLE my_moments_vaults (
  id TEXT PRIMARY KEY,
  user_identifier TEXT NOT NULL,       -- email or user_id
  event_id TEXT REFERENCES galleries(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_identifier, event_id)
);

-- Vault contents (photos/videos)
CREATE TABLE my_moments_contents (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL REFERENCES my_moments_vaults(id),
  user_identifier TEXT NOT NULL,
  media_type TEXT NOT NULL,            -- photo | video
  content_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  visibility TEXT DEFAULT 'private',    -- private | event | public
  cool_points_earned INTEGER DEFAULT 0,
  repurposed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_vault (vault_id),
  INDEX idx_user (user_identifier)
);

-- Repurposing requests
CREATE TABLE repurposing_requests (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES my_moments_contents(id),
  requester_id TEXT NOT NULL,          -- Who wants to use it
  owner_id TEXT NOT NULL,              -- Who owns it
  intended_use TEXT,                   -- "TikTok post", "Instagram", etc.
  status TEXT DEFAULT 'pending',       -- pending | approved | denied
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  
  INDEX idx_content (content_id),
  INDEX idx_owner (owner_id)
);

-- Cool Points ledger
CREATE TABLE cool_points (
  id TEXT PRIMARY KEY,
  user_identifier TEXT NOT NULL,
  action TEXT NOT NULL,                -- rsvp | checkin | upload | share | repurposed | etc.
  points INTEGER NOT NULL,
  reference_id TEXT,                   -- Related content/request ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user (user_identifier)
);

-- User Cool Points balance (denormalized for performance)
CREATE TABLE cool_points_balance (
  user_identifier TEXT PRIMARY KEY,
  balance INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Privacy Settings

```sql
-- Visibility levels
-- private: Only the owner can see
-- event: Only event RSVPs can see
-- public: Anyone can see, anyone can request

ALTER TABLE my_moments_contents ADD COLUMN visibility TEXT DEFAULT 'event';
ALTER TABLE my_moments_contents ADD COLUMN requested_reposts INTEGER DEFAULT 0;
```

---

## API Routes

### 3.1 Vault Management

```
GET    /api/mymoments/vault/[eventId]           -- Get user's vault for event
POST   /api/mymoments/vault                      -- Create vault (on RSVP)
GET    /api/mymoments/contents                   -- List all user's contents
GET    /api/mymoments/contents/[id]             -- Get single content
PUT    /api/mymoments/contents/[id]             -- Update (caption, visibility)
DELETE /api/mymoments/contents/[id]             -- Delete content
```

### 3.2 Event Contents

```
GET    /api/mymoments/event/[eventId]           -- All public/event contents
GET    /api/mymoments/event/[eventId]/count    -- Count of captures
```

### 3.3 Repurposing

```
POST   /api/mymoments/repurpose                  -- Request to repurpose
GET    /api/mymoments/repurpose/incoming         -- Requests to your content
GET    /api/mymoments/repurpose/outgoing         -- Your requests
PUT    /api/mymoments/repurpose/[id]/approve    -- Approve request
PUT    /api/mymoments/repurpose/[id]/deny       -- Deny request
```

### 3.4 Cool Points

```
GET    /api/mymoments/points                    -- Get user's balance
GET    /api/mymoments/points/history           -- Points history
POST   /api/mymoments/points/award             -- Award points (admin)
GET    /api/mymoments/leaderboard              -- Top point earners
```

---

## Frontend Components

### 4.1 Vault UI

```
src/components/mymoments/
├── VaultPage.tsx              -- Main vault view
├── VaultHeader.tsx            -- Stats, points balance
├── ContentGrid.tsx            -- Photo/video grid
├── ContentCard.tsx           -- Individual item
├── ContentViewer.tsx          -- Full-screen viewer
├── UploadModal.tsx           -- Camera/upload interface
├── CreateContentModal.tsx    -- Creator tools
├── ShareModal.tsx             -- Platform selector
├── RepurposeRequest.tsx       -- Request permission modal
├── PointsBadge.tsx           -- Points display
└── Leaderboard.tsx           -- Points leaderboard
```

### 4.2 Creator Tools

```
├── FormatSelector.tsx         -- Platform selection
│     ├── TikTok (9:16)
│     ├── Instagram Feed (1:1)
│     ├── Instagram Story (9:16)
│     ├── Reels (9:16)
│     ├── YouTube Shorts (9:16)
│     └── Download Original
│
├── AudioTools.tsx             -- Audio controls
│     ├── Odubo Music Picker
│     ├── Sound Effects
│     └── Enhancement (EQ, reverb, etc.)
│
├── TemplateSelector.tsx       -- Branded templates
│
└── WatermarkToggle.tsx       -- Cool Wrld watermark
```

### 4.3 Profile Integration

Extend existing profile page:

```
/moments/profile
├── MyMoments
│   ├── Points balance: 234
│   ├── Total captures: 47
│   ├── Repurposed: 12
│   └── [View Vault] [Redeem Points]
│
├── My Galleries
│
└── Settings
```

---

## Cool Points System

### Important: Points Value

**Cool Points are NOT 1:1 with dollars.**

Points are earned through engagement, NOT purchases. They represent:
- Community participation
- Creativity
- Contribution to Cool Wrld

| Earned Through | Points Value |
|---------------|--------------|
| RSVPs | Community participation |
| Check-ins | Attendance |
| Uploads | Content creation |
| Shares | Viral reach |
| Repurposing | Creative reuse |

### 5.1 Actions & Rewards

| Action | Points | Trigger |
|--------|--------|---------|
| RSVP to event | +10 | On RSVP confirmation |
| Check in to event | +25 | On check-in |
| Upload photo | +15 | On upload success |
| Upload video | +20 | On upload success |
| Share to social | +20 | On share confirmation |
| First 10 shares bonus | +50 | After 10th share |
| Repurposing approved | +50 | When someone uses your content |
| Your repurposed content used | +100 | When their post goes viral |
| Comment on content | +5 | On comment |
| Like content | +2 | On like |

### 5.2 Redemption Tiers

| Reward | Points | Type |
|--------|--------|------|
| Branded sticker pack | 100 | Physical |
| Event photo print | 200 | Physical |
| Exclusive BTS video | 250 | Digital |
| Event ticket discount (10%) | 500 | Discount |
| Early episode access | 750 | Access |
| Limited edition merch | 1000 | Physical |
| Meet & greet access | 2000 | Experience |

### 5.3 Leaderboard

```
Top Cool Points Earners
─────────────────────
1. @kamloops_fan     2,450
2. @dancequeen        1,890
3. @loopmaster         1,234
...
```

---

## Social Sharing

### 6.1 Platform Presets

```typescript
const platformFormats = {
  tiktok: { ratio: '9:16', maxDuration: 180 },
  instagram_feed: { ratio: '1:1', maxDuration: 90 },
  instagram_reels: { ratio: '9:16', maxDuration: 90 },
  instagram_story: { ratio: '9:16', maxDuration: 15 },
  youtube_shorts: { ratio: '9:16', maxDuration: 60 },
  twitter: { ratio: '16:9', maxDuration: 140 },
};
```

### 6.2 Share Card

```
┌─────────────────────────────────┐
│  [Photo/Video Content]           │
│                                 │
│  Captured at Loops Soul         │
│  The Genesis Blueprint          │
│                                 │
│  #KamLoopsSoul                  │
│  @oduboworld                    │
│                                 │
│  [TikTok] [IG] [YT] [Download] │
└─────────────────────────────────┘
```

### 6.3 Attribution

When content is repurposed:
- Original creator credited in caption
- Link back to original vault
- "📸 @username | Cool Wrld Moments"

---

## R2 Storage Structure

```
r2://cool-wrld/
├── my-moments/
│   ├── vaults/
│   │   ├── {vault_id}/
│   │   │   ├── original/       -- Full quality
│   │   │   ├── optimized/     -- Sharing sizes
│   │   │   └── thumbnails/    -- Previews
│   │
│   ├── templates/              -- Branded templates
│   │   ├── tiktok-overlay.png
│   │   ├── instagram-overlay.png
│   │   └── ...
│   │
│   └── watermarks/
│       └── cool-wrld-watermark.png
│
└── repurposed/
    ├── {content_id}/
    │   ├── approved/
    │   └── denied/
    └── templates/
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Vault tables and basic CRUD
- [ ] Photo/video upload to vault
- [ ] Basic profile integration
- [ ] Points earning (RSVP, upload, share)
- [ ] Simple sharing

### Phase 2: Creator Tools
- [ ] Platform format selector
- [ ] Odubo music integration
- [ ] Audio enhancement tools
- [ ] Branded templates
- [ ] Watermark overlay

### Phase 3: Community
- [ ] Event contents viewing
- [ ] Visibility controls
- [ ] Repurposing requests
- [ ] Points for repurposing
- [ ] Leaderboard

### Phase 4: Gamification
- [ ] Points redemption UI
- [ ] Rewards catalog
- [ ] Bonus multipliers
- [ ] Achievement badges
- [ ] Push notifications for points

---

## Dependencies

- **Clerk** - Authentication (Cool Wrld accounts)
- **Shopify** - Commerce (linked via email)
- Existing `gallery_photos` table for event galleries
- Existing `gallery_rsvps` for RSVP tracking
- Existing `videos` table for video storage
- Cloudflare R2 for file storage
- Cloudflare Stream for video playback
- PostForMe for social deployment (future)

---

## Account Architecture

### Cool Wrld Accounts (Clerk)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Clerk user ID |
| email | string | Primary email |
| phone | string | Optional phone |
| instagram_handle | string | Linked Instagram |
| avatar_url | string | Profile picture |
| display_name | string | Display name |
| cool_points_balance | number | Current points |
| created_at | timestamp | Account creation |

### Shopify Linking

| Field | Type | Description |
|-------|------|-------------|
| shopify_customer_id | string | Linked Shopify ID (optional) |
| linked_at | timestamp | When linked |
| link_source | string | 'auto' or 'manual' |

### Linking Flow

```
1. User signs into Cool Wrld (Clerk)
2. Extract email: john@email.com
3. Query Shopify: Does customer exist?
4. If yes → Link accounts automatically
5. If no → Cool Wrld only account
```

---

## Notes

- All content owned by uploader
- Repurposing requires explicit permission
- Cool Points are virtual currency (no real money value)
- Points earned through engagement, NOT purchases
- Privacy: private/event/public visibility per content
- Storage limits: TBD based on R2 costs

---

**Version**: 1.1
**Created**: 2026-04-16
**Updated**: 2026-04-17
**Status**: Draft
