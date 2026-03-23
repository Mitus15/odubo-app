# Moments App — Technical Specification

**App Name:** Moments  
**Version:** 1.0.0  
**Status:** Beta (Stages 1–3 Complete)  
**Target URL:** moments.odubo.studio  
**Parent Platform:** odubo.studio  

---

## 1. Product Vision

> *"The place where event attendees collectively build the visual memory of shared experiences in real-time."*

Moments is an event-focused photo and video sharing platform where:
- **Attendees** capture and share photos/videos without accounts or friction
- **Hosts** create events, manage galleries, and moderate content
- **Everyone** can view, share, and download event content

### Future Expansion (Video Clips)
- Event highlight reels (15-second video clips)
- Real-time chat for event groups
- Discover page for trending events
- Create page for event creation
- User accounts and profiles

---

## 2. Architecture

### 2.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15+ (App Router) |
| Runtime | React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Video Processing | Cloudflare Stream |
| Deployment | Vercel (current), deployable separately |

### 2.2 Directory Structure

```
src/app/moments/                    # Frontend Pages
├── page.tsx                        # Main entry (MomentsPageClient)
├── MomentsPageClient.tsx           # Main client component
├── gallery/[id]/page.tsx           # Gallery viewer with lightbox
├── capture/page.tsx               # Photo/video capture
├── rsvp/[id]/page.tsx             # RSVP flow
├── join/page.tsx                  # Event joining
├── error.tsx                       # Error boundary
├── admin/                          # Admin dashboard
│   ├── page.tsx                    # Events list
│   └── moderation.tsx             # Content moderation
└── api/moments/                    # API Routes
    ├── galleries/                  # Gallery CRUD
    ├── list/                       # Photos listing
    ├── upload-url/                # Presigned URL generation
    ├── upload-proxy/              # Direct-to-R2 upload
    ├── record/                    # Photo metadata recording
    ├── moderate/                  # Content moderation
    ├── rsvp/                       # RSVP management
    ├── events/                    # Event management
    ├── create/                    # Event creation
    └── reminders/                 # Reminder dispatch

src/lib/
├── momentsSchemas.ts              # Zod validation schemas
└── momentsReminderDispatcher.ts    # Reminder system

database/
├── migrations/                    # Schema migrations
└── schema.sql                      # Full schema reference
```

### 2.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/moments/galleries/public` | List public galleries |
| POST | `/api/moments/galleries` | Create gallery |
| GET | `/api/moments/galleries/[id]` | Get gallery details |
| PATCH | `/api/moments/galleries/[id]` | Update gallery |
| GET | `/api/moments/list` | List photos with pagination |
| POST | `/api/moments/upload-url` | Get presigned upload URL |
| POST | `/api/moments/upload-proxy` | Direct upload to R2 |
| POST | `/api/moments/record` | Record photo metadata |
| POST | `/api/moments/moderate` | Approve/reject content |
| POST | `/api/moments/rsvp` | Create RSVP |
| POST | `/api/moments/join` | Join event as participant |

---

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Galleries (Events)
CREATE TABLE galleries (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,                    -- 6-char access code
  title TEXT NOT NULL,
  description TEXT,
  gallery_type TEXT DEFAULT 'event',    -- event, collection, lookbook, etc.
  upload_mode TEXT DEFAULT 'public',   -- public, admin
  starts_at DATETIME,
  ends_at DATETIME,
  created_by INTEGER,
  config TEXT,                         -- JSON settings
  cover_photo_key TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Photos
CREATE TABLE gallery_photos (
  id INTEGER PRIMARY KEY,
  gallery_id INTEGER REFERENCES galleries(id),
  r2_key TEXT NOT NULL,
  r2_url TEXT,
  thumbnail_key TEXT,
  original_filename TEXT,
  user_name TEXT,                       -- Instagram handle or name
  media_type TEXT DEFAULT 'photo',      -- photo, video
  moderated INTEGER DEFAULT 0,          -- 0=pending, 1=approved, 2=rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- RSVP
CREATE TABLE rsvp (
  id INTEGER PRIMARY KEY,
  gallery_id INTEGER REFERENCES galleries(id),
  email TEXT,
  instagram_handle TEXT,
  phone TEXT,
  name TEXT,
  reminder_offsets TEXT,                -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Future Tables (Video Clips Expansion)

```sql
-- Event Clips (Video Highlights)
CREATE TABLE event_clips (
  id INTEGER PRIMARY KEY,
  event_id INTEGER REFERENCES galleries(id),
  user_id TEXT,
  r2_key TEXT NOT NULL,
  thumbnail_key TEXT,
  duration_seconds INTEGER,
  caption TEXT,
  view_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  moderated INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Event Chat
CREATE TABLE event_chat (
  id INTEGER PRIMARY KEY,
  event_id INTEGER REFERENCES galleries(id),
  user_id TEXT,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  media_r2_key TEXT,
  is_announcement BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Profiles
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  avatar_r2_key TEXT,
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Event Participants
CREATE TABLE event_participants (
  event_id INTEGER REFERENCES galleries(id),
  user_id TEXT,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, user_id)
);
```

---

## 4. Isolation Strategy

### 4.1 Current State

The Moments app is currently part of the main odubo.studio codebase but operates largely independently:

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend routes | ✅ Isolated | `/moments/*` routes |
| API routes | ✅ Isolated | `/api/moments/*` routes |
| Database | ⚠️ Shared | Same D1, same tables |
| Storage | ✅ Isolated | R2 bucket isolation via paths |
| Dependencies | ⚠️ Partial | QuickShopContext fallback added |

### 4.2 Dependencies Audit

**Shared Infrastructure (Safe for Isolation):**
- `@/lib/db` — Database operations
- `@/lib/auth` — Authentication helpers
- `@/lib/rateLimit` — Rate limiting
- `@/lib/audit` — Audit logging
- `@/lib/seo` — SEO metadata
- `@/lib/storage/pathGenerators` — R2 path generation
- `@/lib/momentsSchemas` — Moments-specific validation
- `@/lib/momentsReminderDispatcher` — Reminder system
- `@/worker/generate_video_thumbnail` — Video processing

**Cross-App Dependencies (Handled):**
- `QuickShopContext` — Now with graceful fallback to navigation

### 4.3 Future Isolation Path

When ready to spin off as a separate deployment:

1. **Environment-driven configuration**: All URLs from env vars
2. **Table prefixes**: `moments_*` tables in same DB
3. **Versioned API**: `/api/v2/moments/*` to avoid conflicts
4. **Feature flags**: Gradual rollout capability
5. **Separate build**: `npm run build:moments` for isolated artifact

---

## 5. Feature Status

### 5.1 Current Features (Beta-Ready)

| Feature | Status | Notes |
|---------|--------|-------|
| Photo upload | ✅ | Direct + proxy fallback |
| Drag-and-drop upload | ✅ | Desktop only |
| Gallery viewer | ✅ | With pagination |
| Lightbox viewer | ✅ | With swipe/navigation |
| Photo download | ✅ | Direct R2 link |
| Photo share | ✅ | Native share API + clipboard |
| Gallery share | ✅ | Share URL |
| RSVP flow | ✅ | Email, IG, phone support |
| Event code validation | ✅ | 6-char codes |
| Admin moderation | ✅ | Pending/Approved/Rejected |
| Inline upload success | ✅ | Auto-dismiss banner |

### 5.2 Planned Features (Video Clips Expansion)

| Feature | Priority | Status |
|---------|----------|--------|
| Video recording | High | Not started |
| Video upload | High | Not started |
| Clips feed | High | Not started |
| Event creation wizard | Medium | Not started |
| Real-time chat | Medium | Not started |
| User profiles | Medium | Not started |
| Event discovery | Low | Not started |
| Push notifications | Low | Not started |

---

## 6. API Contracts

### 6.1 Gallery Listing

```typescript
// GET /api/moments/galleries/public?limit=12&preview=true
Response: {
  galleries: Array<{
    id: number;
    title: string;
    description?: string;
    photo_count: number;
    cover_url: string;
    starts_at?: string;
    ends_at?: string;
  }>
}
```

### 6.2 Photo Listing

```typescript
// GET /api/moments/list?galleryId=123&limit=30&offset=0
Response: {
  photos: Array<{
    id: number;
    r2_url: string;
    thumbnail_url?: string;
    original_filename?: string;
    user_name?: string;
    created_at: string;
    media_type: 'photo' | 'video';
  }>
}
```

### 6.3 Upload Flow

```typescript
// POST /api/moments/upload-url
Request: { code: string, fileName: string }
Response: { key: string, uploadUrl: string }

// POST /api/moments/record
Request: { code: string, r2_key: string, original_filename: string, user_name?: string }
Response: { success: true, photo_id: number }
```

---

## 7. Security

### 7.1 Authentication

- **Guest access**: No auth required for viewing/public galleries
- **Event codes**: 6-character alphanumeric codes for private events
- **Admin**: Auth required for moderation, event creation

### 7.2 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Upload (proxy) | 300/min | Per IP per gallery |
| Upload (URL) | 100/min | Per IP |
| List | 300/min | Per IP |
| RSVP | 10/min | Per IP |

### 7.3 Moderation

- All uploads default to `moderated = 0` (pending)
- Hosts can approve/reject via admin panel
- Rejected content (`moderated = 2`) excluded from listings

---

## 8. Deployment

### 8.1 Current Configuration

- **Main URL**: odubo.studio/moments
- **Build**: Next.js production build
- **Deployment**: Vercel (auto-deploy on main)

### 8.2 Future Configuration (Isolated)

- **URL**: moments.odubo.studio (subdomain)
- **Build**: Isolated Next.js artifact
- **Database**: Shared D1 or separate
- **Custom domain**: moments.yourdomain.com

---

## 9. Development Guidelines

### 9.1 Adding New Features

1. Create API routes under `/src/app/api/moments/`
2. Create frontend pages under `/src/app/moments/`
3. Add database migrations under `/database/migrations/`
4. Update this specification document

### 9.2 Testing

- Use local D1 for development: `npx wrangler d1 execute odubo --local`
- Test with realistic data volumes (100+ photos, multiple galleries)
- Verify rate limiting behavior

### 9.3 Code Style

- Use TypeScript strict mode
- Follow existing patterns for API routes
- Use Zod for request validation (via momentsSchemas)
- Add audit logs for sensitive operations

---

## 10. Changelog

### v1.0.0 (Beta - Stages 1-3)
- Stage 1: Critical fixes (admin, RSVP, upload security)
- Stage 2: Upload improvements (inline success, drag-drop)
- Stage 3: Gallery polish (pagination, sharing)

### v0.9.0 (Alpha)
- Initial implementation
- Basic gallery creation and viewing
- Photo upload and moderation

---

*Last updated: March 2026*