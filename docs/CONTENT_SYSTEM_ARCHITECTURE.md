# Content Management System Architecture

**Last Updated:** 2026-02-04  
**Status:** Production Ready ✅

This document describes the complete content management architecture for Odubo, covering videos, music, galleries, brand assets, and social media publishing.

---

## Overview

The content system is built on **three pillars**:

1. **Cloudflare Stream** - Video/clip hosting with HLS streaming
2. **Cloudflare R2** - Storage for music, images, and assets
3. **PostForMe API** - Multi-platform social media publishing

All content flows through the **Arsenal** tab in the admin dashboard, which serves as the unified orchestration hub for upload → deploy → sync workflows.

---

## Video & Clip System

### Architecture

**Storage:** Cloudflare Stream (video files NEVER stored in R2)  
**Upload Protocol:** TUS (chunked, resumable)  
**Streaming:** HLS with adaptive bitrate  
**Admin Interface:** Arsenal tab

### Upload Flow

```
1. User selects files in Arsenal → Upload view
2. Files chunked and uploaded via TUS to Cloudflare Stream
3. Video record created in videos table with:
   - uid (Cloudflare Stream ID)
   - url (HLS embed URL)
   - poster_url (auto-generated thumbnail)
   - track_id, album_id (music relationships)
   - thumbnail_timestamp_pct (0.5 for clips, AI-selected for videos)
4. Clips inherit parent's publication_status and artist_name
```

### Music Linking (NEW - Migration 095/096)

Videos can now link to **both tracks AND albums**:

```typescript
// Database Schema
videos {
  track_id: TEXT → tracks.id
  album_id: TEXT → albums.id
  video_type: TEXT (music-video, lyric, visualizer, etc.)
}

tracks {
  music_video_id: INTEGER → videos.id (reverse lookup)
}
```

**UI Display:**
- Arsenal: Video cards show 🎵 Track Name • Album Name
- Music Tab: Tracks show 📹 badge with video count

### Thumbnail Strategy

| Content Type | Method | Selection |
|--------------|--------|-----------|
| **Videos** | AI + Heuristics | Admin picks from ranked candidates |
| **Clips** | Random frame | Auto-set to 50% timestamp (0.5) |

Both generate `poster_url` from: `https://videodelivery.net/{uid}/thumbnails/thumbnail.jpg?time={pct}%`

### Deployment

Arsenal → Deploy view → Select platforms → PostForMe API publishes to:
- YouTube (full videos) / YouTube Shorts (clips)
- TikTok
- Instagram Reels
- Twitter/X
- Facebook

Platform URLs saved back to videos table for tracking.

---

## Music System

### Architecture

**Storage:** Cloudflare R2  
**Format:** HLS for streaming (future), MP3/M4A for now  
**Admin Interface:** Music tab

### Storage Paths (via pathGenerators.ts)

```
music/
  albums/{album-slug}/
    cover.jpg                    # Album artwork
    tracks/
      01-{track-slug}.mp3        # Track files (padded numbers)
      02-{track-slug}.mp3
```

**Path Generation:**
```typescript
import { music } from '@/lib/storage/pathGenerators';

music.albumCover('catching-light', 'jpg');
// → music/albums/catching-light/cover.jpg

music.track('catching-light', 2, 'moments-ago', 'mp3');
// → music/albums/catching-light/tracks/02-moments-ago.mp3
```

### Music Video Relationships

Tracks can have multiple videos:
- music_videos junction table stores track_id → video_uid mappings
- videos.track_id provides direct lookup
- UI shows video badges on tracks in Music tab

---

## Moments (Galleries)

### Architecture

**Storage:** Cloudflare R2 (photos + short videos)  
**Admin Interface:** Moments tab  
**Public Access:** Event codes for attendee uploads

### Storage Paths (via pathGenerators.ts)

```
galleries/{gallery-slug}/
  photos/{filename}.jpg
  videos/{filename}.mp4          # Short clips only, NOT Cloudflare Stream
  thumbs/{filename}.webp         # Future optimization
```

**Path Generation:**
```typescript
import { gallery } from '@/lib/storage/pathGenerators';

gallery.photo('catching-light-launch', 'IMG_1234.jpg');
// → galleries/catching-light-launch/photos/IMG_1234.jpg

gallery.video('catching-light-launch', 'VID_5678.mp4');
// → galleries/catching-light-launch/videos/VID_5678.mp4
```

### Upload APIs

**Admin Upload:** `/api/moments/upload-url` (presigned PUT URL)  
**Public Upload:** `/api/moments/upload-proxy` (direct multipart)  
**Rate Limits:** 300 uploads/min per IP per gallery (event-friendly)

---

## Brand Assets

### Architecture

**Storage:** Cloudflare R2  
**Categories:** Logos, Press Photos, Album Artwork, Event Graphics  
**Admin Interface:** Brand Assets tab

### Storage Paths (via pathGenerators.ts)

```
brand-assets/{category-slug}/{album-slug}/
  originals/{uuid}.jpg           # Full resolution
  thumbs/{uuid}.webp            # Future: 400px preview
  web/{uuid}.webp               # Future: 1200px web-optimized
```

**Path Generation:**
```typescript
import { brandAssets } from '@/lib/storage/pathGenerators';

brandAssets.original('logos', 'primary-wordmark', uuid, 'svg');
// → brand-assets/logos/primary-wordmark/originals/{uuid}.svg

brandAssets.thumbnail('press-photos', '2026-tour', uuid, 'webp');
// → brand-assets/press-photos/2026-tour/thumbs/{uuid}.webp
```

**Future Enhancement:** Automatic thumbnail/web variant generation via Cloudflare Workers

---

## Social Media Publishing

### Architecture (Two Systems - Correctly Separated)

#### PRIMARY: Arsenal Deployment (`/api/arsenal/deploy`)

**Purpose:** Content deployment to social platforms  
**Table:** videos (with platform URL columns)  
**API:** PostForMe  
**Admin UI:** Arsenal tab → Deploy view

**Flow:**
```
1. Select videos/clips in Arsenal
2. Choose platforms (YouTube, TikTok, Instagram, etc.)
3. Customize captions, hashtags per platform
4. Deploy → PostForMe API publishes
5. Platform URLs saved to videos table
6. Sync button updates status from PostForMe
```

#### SECONDARY: Social Tab (Accounts + Analytics Only)

**Purpose:** Platform management, NOT deployment  
**Admin UI:** Social tab → 3 sub-tabs

**Sub-tabs:**
- **Connected Accounts:** Sync PostForMe platform connections
- **Growth Analytics:** Follower/engagement metrics
- **AI Studio:** Caption generation, hashtag suggestions

**Deployment is NOT handled here** - that's Arsenal's job.

#### DEPRECATED: Legacy social_posts System

**Endpoints:** `/api/social/posts/*`  
**Table:** social_posts  
**Status:** Deprecated, kept for backwards compatibility  
**Used by:** Orphaned `/admin/social-studio/` pages (not linked in admin nav)

**Migration Path:** Use Arsenal for all new deployments

### PostForMe Integration

**Authentication:** API key in environment  
**Multi-platform Support:**
- YouTube (long-form + Shorts)
- TikTok
- Instagram (Feed + Reels)
- Twitter/X
- Facebook
- LinkedIn
- Threads
- Pinterest
- Bluesky

**Account Sync:** Social tab → Connected Accounts → Fetches from PostForMe API

---

## Storage Path System (Standardized)

### Single Source of Truth: pathGenerators.ts

**Location:** `/src/lib/storage/pathGenerators.ts`

**Exported Functions:**
```typescript
import {
  gallery,      // Moments photos/videos
  music,        // Albums, tracks
  brandAssets,  // Brand asset originals/thumbs/web
  social,       // Social media assets (date-organized)
  featured,     // Featured page assets
  videoThumbnails, // Video thumbnail candidates (R2)
  toSlug,       // Slug helper
  sanitizeFilename, // Filename sanitizer
  generateUUID, // UUID generator
} from '@/lib/storage/pathGenerators';
```

**Migration Status:**
- ✅ Music uploads use pathGenerators
- ✅ Moments uploads use pathGenerators
- ✅ Brand assets uploads use pathGenerators
- ✅ Social media assets use pathGenerators
- ⚠️ Legacy fileOrganization.ts no longer imported

### Path Examples

```typescript
// Moments
gallery.photo('summer-tour-nyc', 'photo-001.jpg')
// → galleries/summer-tour-nyc/photos/photo-001.jpg

// Music
music.albumCover('catching-light', 'jpg')
// → music/albums/catching-light/cover.jpg

music.track('catching-light', 3, 'eclipse', 'mp3')
// → music/albums/catching-light/tracks/03-eclipse.mp3

// Brand Assets
brandAssets.original('logos', 'wordmark', uuid, 'svg')
// → brand-assets/logos/wordmark/originals/{uuid}.svg

// Social Media (date-organized)
social.asset('odubo', new Date('2026-02-04'), uuid, 'mp4')
// → social/odubo/2026/02/04/{uuid}.mp4

// Video Thumbnails (AI candidates)
videoThumbnails.generate(videoId, 'frame-12.jpg')
// → thumbnails/videos/{videoId}/frame-12.jpg
```

---

## Database Schema Summary

### Core Tables

**videos** - Video/clip records
- `id`, `uid` (Stream ID), `title`, `url`, `poster_url`
- **Music Links:** `track_id`, `album_id`, `video_type`
- **Clip Links:** `parent_video_id`, `clip_index`, `total_siblings`
- **Platform URLs:** `youtube_url`, `tiktok_url`, `instagram_reels_url`, etc.
- **Thumbnails:** `thumbnail_timestamp_pct`, `chosen_candidate_id`

**tracks** - Music tracks
- `id`, `album_id`, `title`, `duration`, `audio_url`
- **Reverse Link:** `music_video_id` (optional)
- **Join for UI:** LEFT JOIN videos ON videos.track_id = tracks.id

**albums** - Album metadata
- `id`, `title`, `cover_art_url`, `release_type`

**galleries** - Moments/event galleries
- `id`, `code`, `title`, `upload_mode`, `gallery_type`

**social_content** - Arsenal deployment tracking (PRIMARY)
- `id`, `upload_uid` (Stream ID), `title`, `status`
- Platform-specific captions/hashtags
- Used by `/api/admin/social/publish`

**social_posts** - Legacy deployment table (DEPRECATED)
- Used by orphaned `/api/social/posts/*` endpoints
- Migrate to Arsenal for new workflows

**social_accounts** - Connected platform accounts
- Synced from PostForMe API
- Used by both Arsenal and Social tab

---

## API Endpoints Reference

### Videos & Clips

```
POST   /api/videos                    # Create video record
POST   /api/videos/[id]/clips         # Add clip to parent video
GET    /api/arsenal/videos            # Fetch all videos for Arsenal
POST   /api/arsenal/deploy            # Deploy to social platforms
POST   /api/arsenal/sync              # Sync platform statuses
GET    /api/videos/tus-upload         # Get TUS credentials
```

### Music

```
GET    /api/tracks                    # List tracks (with video_count)
POST   /api/tracks                    # Create track
GET    /api/albums                    # List albums
POST   /api/albums                    # Create album
```

### Moments

```
POST   /api/moments/upload-url        # Get presigned URL (admin)
POST   /api/moments/upload-proxy      # Direct upload (public)
GET    /api/moments/galleries         # List galleries
POST   /api/moments/galleries         # Create gallery
```

### Brand Assets

```
POST   /api/admin/brand-assets/upload   # Upload brand asset
GET    /api/admin/brand-assets           # List assets
```

### Social Publishing

```
POST   /api/arsenal/deploy            # PRIMARY - Deploy content
POST   /api/admin/social/publish      # Legacy - social_content table
POST   /api/social/posts/publish      # DEPRECATED - social_posts table
GET    /api/admin/social/accounts     # List connected accounts
POST   /api/admin/social/accounts/sync # Sync from PostForMe
```

---

## Migration Notes

### Completed Migrations

**Migration 095** - Music Videos Junction
- Added `music_videos` junction table
- Added `videos.track_id` column
- Added `tracks.primary_video_id` column

**Migration 096** - Video-Album Link
- Added `videos.album_id` column
- Documented clip columns (parent_video_id, clip_index, total_siblings)

### Running Migrations

```bash
# Remote D1 database
npx wrangler d1 execute odubo --remote --file=database/migrations/096_video_album_link.sql

# Local D1 database (testing)
npx wrangler d1 execute odubo --local --file=database/migrations/096_video_album_link.sql
```

---

## Testing Checklist

### Video Upload
- [ ] Upload video via Arsenal → Video flow
- [ ] Upload clips via Arsenal → Clips flow
- [ ] Link video to track and album in metadata form
- [ ] Verify video card shows 🎵 Track Name • Album Name
- [ ] Verify clip has thumbnail_timestamp_pct = 0.5

### Music Upload
- [ ] Upload album via Music tab → Album wizard
- [ ] Verify cover art stored in `music/albums/{slug}/cover.jpg`
- [ ] Verify tracks stored in `music/albums/{slug}/tracks/`
- [ ] Link music video to track
- [ ] Verify track shows 📹 badge with count

### Moments Upload
- [ ] Upload photos via Moments tab
- [ ] Verify stored in `galleries/{slug}/photos/`
- [ ] Test public upload with event code

### Social Deployment
- [ ] Deploy video via Arsenal → Deploy
- [ ] Select YouTube, TikTok, Instagram
- [ ] Customize captions/hashtags
- [ ] Verify platform URLs saved to videos table
- [ ] Sync and verify status updates

### Brand Assets
- [ ] Upload brand asset via Brand Assets tab
- [ ] Verify stored in `brand-assets/{category}/{album}/originals/`

---

## Performance Considerations

### Video Streaming
- **Preload Strategy:** Next clip's first segment prefetched
- **Memory Management:** HLS instances destroyed when not visible
- **Single Active Video:** Only one video plays at a time
- **Autoplay Policy:** Muted autoplay for browser compliance

### R2 Storage
- **Public URL:** `CLOUDFLARE_R2_PUBLIC_URL` environment variable
- **CDN:** R2 objects served via custom domain
- **Path Structure:** Organized by content type for easy management

### PostForMe API
- **Rate Limits:** Respect platform-specific limits
- **Retry Logic:** Built into createPost function
- **Batch Uploads:** Deploy multiple videos in parallel

---

## Environment Variables

```bash
# Cloudflare Stream
CLOUDFLARE_STREAM_ACCOUNT_ID=xxx
CLOUDFLARE_STREAM_API_TOKEN=xxx

# Cloudflare R2
CLOUDFLARE_R2_BUCKET_NAME=odubo
CLOUDFLARE_R2_PUBLIC_URL=https://cdn.odubo.studio
CLOUDFLARE_R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=xxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxx

# PostForMe (Social Publishing)
POSTFORME_API_KEY=xxx

# Database
CLOUDFLARE_D1_DATABASE_ID=xxx
```

---

## Troubleshooting

### Video Not Playing
1. Check `uid` is valid Cloudflare Stream ID
2. Verify `url` format: `https://iframe.videodelivery.net/{uid}`
3. Check browser console for HLS errors
4. Verify video status is "ready" in Cloudflare Stream dashboard

### Upload Fails
1. Check TUS endpoint credentials
2. Verify file size within limits (50MB for moments, no limit for Stream)
3. Check network connectivity
4. Review browser console for detailed errors

### Social Deployment Fails
1. Verify connected accounts in Social tab
2. Check PostForMe API key in environment
3. Review platform-specific requirements (file formats, durations)
4. Check `/api/arsenal/deploy` response for detailed errors

### Missing Music on Video Cards
1. Verify migration 095 and 096 applied
2. Check `videos.track_id` and `videos.album_id` populated
3. Verify `/api/arsenal/videos` includes JOIN for track/album titles
4. Clear browser cache and reload

---

## Future Enhancements

### Video System
- [ ] Auto-clip generation via AI scene detection
- [ ] Video editing tools (trim, crop, filters)
- [ ] Multi-audio track support (commentary, translations)

### Music System
- [ ] HLS audio streaming for seamless playback
- [ ] Lyrics sync and display
- [ ] Spatial audio support

### Brand Assets
- [ ] Auto-generate thumbnail/web variants via Workers
- [ ] AI-powered background removal
- [ ] Format conversion (SVG → PNG, etc.)

### Social Publishing
- [ ] Scheduled posting with calendar view
- [ ] A/B testing for captions/thumbnails
- [ ] Analytics dashboard with engagement metrics
- [ ] Multi-platform hashtag research tools

---

## Support & Documentation

**Main Documentation:** `/docs/`  
**Session Logs:** `/.copilot/session-state/*/checkpoints/`  
**Migration Files:** `/database/migrations/`  
**Schema Reference:** `/database/schema.sql`

**Key Files:**
- `/src/app/admin/tabs/ArsenalTab.tsx` - Primary content orchestration
- `/src/app/admin/tabs/MusicTab.tsx` - Album/track management
- `/src/lib/storage/pathGenerators.ts` - Path generation system
- `/src/lib/postforme.ts` - PostForMe API client
- `/src/app/api/arsenal/deploy/route.ts` - Social deployment endpoint

For questions or issues, refer to session checkpoints for detailed implementation history.

---

**Architecture Status:** ✅ Production Ready  
**Last Audit:** 2026-02-04  
**Next Review:** As needed for feature additions
