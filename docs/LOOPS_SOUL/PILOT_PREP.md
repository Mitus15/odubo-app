# LOOPS SOUL - PILOT EPISODE PREP

> Technical and operational checklist for the first Loops Soul event.

---

## Overview

This document covers everything needed to run **Episode 1: The Genesis Blueprint** as a fully documented, content-generating event that feeds into the Cool Wrld ecosystem.

---

## Event Timeline

### Pre-Event (4-6 Weeks Before)

| Week | Tasks |
|------|-------|
| **-6** | Announce event, RSVP opens |
| **-5** | RSVP hype, artist/DJ reveals |
| **-4** | Activity teasers begin |
| **-3** | Pre-event community wall active |
| **-2** | Final RSVP push |
| **-1** | Venue walkthrough, tech check |

### Event Night

| Time | Activities |
|------|-----------|
| Arrival | Check-in, photo op, hype wall |
| 0:00 | Host intro |
| 0:05 | DJ opens |
| 0:15 | Act 1 (from Activity Pool) |
| 0:30 | Transition |
| 0:35 | Act 2 (from Activity Pool) |
| 0:50 | Artist feature |
| 1:05 | Act 3: The Soul Loop |
| 1:20 | Host outro |
| 1:25 | Open floor |
| End | Exit capture |

### Post-Event (Week 1-2)

| Time | Tasks |
|------|-------|
| +1 day | Moderation queue clear |
| +3 days | Episode edit begins |
| +7 days | Episode ready for review |
| +10 days | Episode published |
| +14 days | Behind-the-scenes drop |

---

## Technical Checklist

### Database Setup

```sql
-- Run migrations 116-128 (see TECHNICAL_IMPLEMENTATION.md)

-- Initialize Loops Soul Series
INSERT INTO cool_wrld_series (id, name, slug, description, universe_tag, status)
VALUES ('ls_s01', 'Loops Soul', 'loops-soul', 'Origin story...', 'loops_soul', 'active');

-- Create Episode 1
INSERT INTO cool_wrld_episodes (id, series_id, episode_number, title, status)
VALUES ('ls_s01e01', 'ls_s01', 1, 'The Genesis Blueprint', 'draft');

-- Create gallery for episode
INSERT INTO galleries (id, title, code, upload_mode, gallery_type, series_id, episode_id, is_event, event_date)
VALUES ('ls_e01_gallery', 'Loops Soul: Episode 1', 'LOOPS01', 'public', 'event', 'ls_s01', 'ls_s01e01', true, '2026-XX-XX');
```

### Admin Setup

- [ ] Create Loops Soul series in admin
- [ ] Create Episode 1 in admin
- [ ] Link gallery to episode
- [ ] Set RSVP form active
- [ ] Configure founding member eligibility
- [ ] Set up check-in mode
- [ ] Assign moderation staff

### Video/Audio Setup

- [ ] 3-camera system positioned
- [ ] Room mics for chant capture
- [ ] Cloudflare Stream ready for upload
- [ ] Backup recording (local)
- [ ] Valcee Pop-up visible in camera frame

### Staffing

- [ ] Host: Mani Odubo (script prepared)
- [ ] Camera operators: 3 minimum
- [ ] Audio engineer
- [ ] Gallery moderator (real-time)
- [ ] Check-in person
- [ ] Backup/runner

---

## Activity Pool

### Episode 1 Activities (Select 2-3)

| Activity | Type | Prep Needed |
|----------|------|------------|
| The Cypher | Music | Mic setup, circle formation |
| Lip Sync Battle | Dance | Contestant signup |
| Soul Loop (Signature) | Dance | Space cleared, music ready |
| Fit Check Interviews | Fashion | Mic for host |
| DJ Battle | Music | DJ coordination |
| The Circle | Dance | Space cleared |

### Host Script Fragments

**Opening**:
> "Bienvenue, Welcome, to Loops Soul! The Soul so unique solely to Kamloops. I'm your Host Mani Odubo, I come to you in the name of Jesus Christ and we've got a great show for you tonight..."

**Chant**:
> "Kam!" / "Loops Soul!"
> "Kam!" / "Loops Soul!"
> "Kam!" / "Loops Soul!"

**The Soul Loop (Act 3)**:
> "I hope everybody got their dancing shoes on, cause it's time for the... Soul Loop!"

---

## Content Capture

### Photo

| Source | Purpose | Count Target |
|--------|---------|-------------|
| Fan uploads | Community gallery | 50-100 |
| Professional | Episode gallery | 100-200 |
| BTS | Behind-the-scenes | 20-30 |
| Valcee Pop-up | Merch integration | 30-50 |

### Video

| Type | Duration | Count |
|------|----------|-------|
| Full episode | 60-90 min | 1 |
| Highlight reel | 60-90 sec | 1 |
| Individual clips | 15-60 sec | 10-20 |
| BTS | 2-5 min | 3-5 |
| "Kam! Loops Soul!" | 10-30 sec | 5-10 |

### Audio

- [ ] Room audio for chant
- [ ] Individual track recordings
- [ ] DJ set capture (if rights allow)

---

## Fan Uploads

### In-Event Flow

```
Fan opens /moments/loops-soul/s01e01/
       ↓
    Upload CTA: "Be in the Episode!"
       ↓
    Select: Photo or Video (max 15s)
       ↓
    Rights Consent Modal
       ↓
    Upload to R2
       ↓
    Moderation Queue
       ↓
    Approved → Live Gallery
       ↓
    Featured → Episode Gallery
```

### Moderation Queue

| Status | Action |
|--------|--------|
| Pending | New uploads awaiting review |
| Approved | Live in community gallery |
| Featured | Queued for episode |
| Rejected | Removed, no notification |

### Rights Consent

```typescript
const consentText = `By uploading, you grant Cool Wrld permission to feature your content in the Loops Soul Episode 1 and promotional materials. Your content may appear on odubo.studio, YouTube, and social media.`;

const consentCheckbox = {
  label: "I agree to the content terms",
  required: true,
  defaultChecked: false
};
```

---

## Check-In System

### Check-In Flow

```
Guest arrives
       ↓
    Show confirmation code or QR
       ↓
    Staff scans/enters code
       ↓
    "You're in!" + Photo moment
       ↓
    Attended marked in RSVP
       ↓
    Founding Member if eligible
```

### Stats Dashboard

| Metric | Target |
|--------|--------|
| RSVPs | 200 |
| Check-ins | 150+ |
| Check-in rate | 75%+ |
| Fan uploads | 50+ |
| Featured content | 10+ |

---

## Episode Publishing

### Post-Event Week 1

- [ ] Raw footage uploaded to Stream
- [ ] Episode edit begins
- [ ] Clips extracted
- [ ] Highlight reel cut
- [ ] Gallery moderation complete

### Post-Event Week 2

- [ ] Episode assembled
- [ ] Review with team
- [ ] Episode published to `/loops-soul/s01e01/`
- [ ] RSVP list notified
- [ ] Social promotion begins

### Content Pipeline

```
Raw Footage
    │
    ├── Full Episode → Cloudflare Stream → /loops-soul/s01e01/ Watch
    │
    ├── Highlight Reel → YouTube (optional) → Episode page embed
    │
    ├── Clips → Arsenal → Social platforms
    │     └── Featured clips marked in admin
    │
    ├── Gallery → Moments → Episode page
    │     └── Fan uploads (moderated)
    │     └── Professional (approved)
    │
    └── BTS → Exclusive content → Founding members
```

---

## Founding Member Flow

### Eligibility

RSVP to Episode 1 and:
- ✅ Checked in to event
- ✅ OR contributed fan content (approved)
- ✅ OR shared episode publicly

### Badge Assignment

```
RSVP confirmed
       ↓
    Event date passes
       ↓
    Episode published
       ↓
    Eligible RSVPs marked as founding
       ↓
    Founding badge visible on their profile
       ↓
    Notification: "You're a Founding Member!"
```

### First 100 Special

Option: First 100 RSVPs to check in get:
- Exclusive founding member number (private)
- Early access to Episode 2
- Mention in season credits

---

## Social/Arsenal Integration

### Episode Clips Pipeline

```
Capture during event
       ↓
    Arsenal upload
       ↓
    Clip metadata:
    - Episode: Loops Soul S01E01
    - Type: Highlight
    - Activity: [The Soul Loop]
       ↓
    Admin approval
       ↓
    Deploy to: TikTok, Instagram, YouTube
       ↓
    Link back to episode page
```

### Post Types

| Content | Platform | Caption |
|---------|----------|---------|
| Teaser | TikTok | "The Soul Loop was LIVE..." |
| Highlight | YT Shorts | "Kam! Loops Soul!" |
| Behind | IG Reels | "How we filmed it..." |
| Full clip | YT | "The Cypher - Episode 1" |

---

## Measurement

### Event Metrics

| KPI | Target | Measurement |
|-----|--------|-------------|
| RSVPs | 200 | gallery_rsvps count |
| Check-in rate | 75%+ | checked_in / total RSVPs |
| Fan uploads | 50+ | gallery_photos.source = 'fan' |
| Featured uploads | 10+ | community_posts.featured |
| Social reach | TBD | PostForMe analytics |

### Content Metrics

| KPI | Target | Measurement |
|-----|--------|-------------|
| Episode views | 1000+ | Stream view count |
| Clip views | 5000+ | Across platforms |
| Gallery views | 500+ | Page analytics |
| Shares | 50+ | Share events |

### Community Metrics

| KPI | Target | Measurement |
|-----|--------|-------------|
| New RSVPs S02 | 250+ | Episode 2 RSVPs |
| Community wall posts | 20+ | Pre-event hype |
| Founding members | 100+ | f.effective_date = S01E01 |

---

## Issues & Contacts

### On-Site Contacts

| Role | Name | Phone |
|------|------|-------|
| Host | Mani Odubo | TBD |
| Camera Lead | TBD | TBD |
| Audio | TBD | TBD |
| Moderation | TBD | TBD |
| Check-in | TBD | TBD |

### Emergency Contacts

| Service | Contact |
|---------|---------|
| Cloudflare Support | dashboard.cloudflare.com |
| PostForMe Support | TBD |
| Venue | TBD |

### Technical Issues

| Issue | Resolution |
|-------|------------|
| Stream upload fails | Local backup → manual upload |
| Gallery down | Direct R2 upload via admin |
| Moderation backlog | Pause uploads, clear queue |
| Check-in fails | Manual list backup |

---

## Post-Event Review

### Day After

- [ ] Review all uploads
- [ ] Clear moderation queue
- [ ] Export guest list
- [ ] Thank you email to RSVPs

### Week 1

- [ ] Episode footage review
- [ ] Clip extraction
- [ ] Gallery finalized
- [ ] Season credits draft

### Week 2

- [ ] Episode published
- [ ] Founding member badges assigned
- [ ] Social campaign live
- [ ] Debrief with team

---

**Version**: 1.0
**Created**: 2026-04-15
**Status**: Pilot Checklist
**Dependencies**: VISION.md, TECHNICAL_IMPLEMENTATION.md
