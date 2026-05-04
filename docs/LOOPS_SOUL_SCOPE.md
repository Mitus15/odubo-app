# Loops Soul - Project Scope Document

## Project Overview

**Loops Soul** is a multi-platform entertainment ecosystem built on Odubo Studio infrastructure. It consists of three interconnected pillars:

1. **Media (Video Streaming)** - TV series and long-form video hosting
2. **Music** - A hybrid DAW × streaming × social platform
3. **Moments** - Social media, content hub, and event RSVP/powering tool

---

## Current Base

### Existing Components (Verified Present)

**Media:**
- `src/app/media/page.tsx` - Video library
- `src/app/media/[videoId]/page.tsx` - Individual video pages

**Music:**
- `src/app/music/page.tsx` - Music library
- `src/app/music/albums/[albumId]/page.tsx` - Album pages

**Moments:**
- `src/app/moments/page.tsx` - Main moments
- `src/app/moments/gallery/[id]/page.tsx` - Galleries
- `src/app/moments/rsvp/[id]/page.tsx` - RSVP system
- `src/app/moments/admin/page.tsx` - Admin panel

---

## Pillar 1: Media (Video Streaming)

### Vision
A robust video streaming platform capable of hosting a full TV series with:
- Episode tracking and season organization
- High-quality adaptive streaming (HLS)
- Seamless web and mobile playback
- Series/episode metadata management

### Requirements

**Core Features:**
- Season/episode organization
- Episode metadata (title, description, duration, thumbnail, air date)
- Trailer support
- Next episode auto-suggestion
- Watch progress tracking
- Resume watching

**Streaming Infrastructure:**
- Cloudflare Stream integration (existing)
- HLS.js adaptive playback
- Quality selector
- Subtitles/captions support

**Social:**
- Comments per episode
- Reactions/shares
- Embeddable player for external sites

### Implementation Approach

**Phase 1: Series Organization**
- Database schema for seasons/episodes
- Admin CRUD for episodes
- Season/episode navigation UI

**Phase 2: Playback Enhancement**
- Episode selector UI
- Resume position tracking
- Auto-advance to next episode

**Phase 3: Social**
- Comments system
- Reactions
- Share functionality

---

## Pillar 2: Music

### Vision
A music platform that bridges the gap between:
- **DAW (Digital Audio Workspace)** - production/discovery
- **Streaming** - album/track playback
- **Social** - community, interaction, collaboration

Think: "What if Spotify and SoundBetter had a baby with Instagram"

### Requirements

**Core Features:**
- Album/track catalog
- Streaming playback with queue management
- Artist profiles

**DAW Elements:**
- Stem/preview access (for producers)
- Production credits display
- Session/project info pages

**Social Elements:**
- User profiles with listening history
- Activity feed
- Comments on tracks
- Collaborative playlists
- Remix/contest support

**Monetization:**
- Track sales (instrumentals/stems)
- Premium access
- Commission requests

### Implementation Approach

**Phase 1: Foundation**
- Enhanced music library
- Playlist system
- Queue/now playing UI

**Phase 2: Social**
- User profiles
- Activity feeds
- Comments/reviews

**Phase 3: DAW Features**
- Stem access control
- Production credits
- Commission workflow

---

## Pillar 3: Moments

### Vision
The primary hub for **Loops Soul** events - a curated and filmed night out. Moments serves as:
- Social media for event coverage
- Content distribution platform
- RSVP and event management
- Fan engagement tool

### Requirements

**Event System:**
- Event pages with date/time/venue
- RSVP management
- Guest lists
- Check-in capabilities

**Content:**
- Photo galleries from events
- Video clips from nights
- Behind-the-scenes content

**Social:**
- User profiles with event history
- Tagging in photos
- Share to main feed

**Integration:**
- Connect to TV series (behind-the-scenes)
- Connect to music (live performances)
- Connect to store (merch drops at events)

### Implementation Approach

**Phase 1: Event Infrastructure**
- Enhanced event pages
- RSVP system expansion
- Guest management

**Phase 2: Content**
- Multi-media galleries
- Video clip support
- Auto-gallery from uploads

**Phase 3: Integration**
- Cross pillar linking
- Event series templates
- Calendar integration

---

## Architecture

### Shared Infrastructure
- **Cloudflare D1** - databases
- **Cloudflare R2** - media storage
- **Cloudflare Stream** - video processing
- **Authentication** - existing JWT system
- **Analytics** - existing tracking

### Subdomain Strategy (Recommended)
```
loops.odubo.studio    → Media (TV series)
music.odubo.studio   → Music platform  
moments.odubo.studio → Events/Moments (existing)
```

### Database Considerations
- Episodes table linked to series
- Music user profiles
- EventRSVPs and guest lists
- Cross-reference tables for pillar connections

---

## Implementation Priority

### Near-term (Foundation)
1. Media: Season/episode structure
2. Moments: RSVP expansion
3. Music: Playlist system

### Mid-term (Growth)
1. Media: Playback enhancements, comments
2. Music: User profiles, social features
3. Moments: Event galleries

### Long-term (Scale)
1. Media: Monetization, embeds
2. Music: DAW features, commissions
3. Moments: Full event management

---

## Key Decisions To Be Made

1. **Series hosting** - Self-hosted via Cloudflare Stream, or YouTube/Vimeo embed?
2. **Music social** - How deep to go with DAW features? (stems vs. just credits)
3. **Moments events** - RSVP only, or ticketed events with payment?
4. **User accounts** - Existing auth system sufficient, or need dedicated accounts?
5. **Subdomains** - When to spin up vs. path-based URLs?

---

## Notes

- This document should be reviewed before each build phase
- Current codebase is the foundation - do not break existing functionality
- Mobile-first approach continues
- Design language should be consistent across pillars
- Analytics should track cross-pillar engagement