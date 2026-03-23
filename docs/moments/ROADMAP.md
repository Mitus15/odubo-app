# Moments App — Product Roadmap

**Last Updated:** March 2026  
**Status:** Beta (Stages 1–3 Complete)

---

## Vision

> *"The collective memory of your event, built by everyone who was there, instantly accessible and permanently preserved."*

Moments transforms how events are documented and shared — replacing fragmented social posts, email chains, and disappear with ephemeral stories with a unified, permanent, searchable platform where attendees collectively build the visual story of shared experiences.

---

## Product Phases

### Phase 1: Foundation (Current — Beta)
**Goal:** Establish core photo-sharing functionality with zero friction

**Completed:**
- ✅ Photo upload (direct + proxy fallback)
- ✅ Drag-and-drop upload (desktop)
- ✅ Gallery viewer with pagination (30/page)
- ✅ Lightbox with swipe navigation
- ✅ Photo download & share
- ✅ Gallery-level sharing
- ✅ Event codes (6-char)
- ✅ RSVP flow (email, IG, phone)
- ✅ Admin moderation
- ✅ Terms acceptance

**Metrics for Success:**
- Upload completion rate: >95%
- Gallery load time: <3 seconds
- Share success rate: >90%

---

### Phase 2: Video Clips (Next)
**Goal:** Enable video highlight capture as collective content creation

**Scope:**
- Video recording (max 15 seconds)
- Video upload to R2
- Clips feed (TikTok-style vertical scroll)
- Clip featuring/pinning by host
- Clip moderation workflow
- Thumbnail generation

**Technical Requirements:**
- Client-side video compression
- Adaptive bitrate serving
- Thumbnail generation pipeline
- Duration limits enforcement

**Target:** 2-3 weeks development

---

### Phase 3: Social Layer
**Goal:** Enable real-time communication around events

**Scope:**
- Real-time chat (WebSocket-based)
- Media sharing in chat
- Typing indicators
- Read receipts
- Announcements (host-only)
- Message pinning

**Technical Requirements:**
- WebSocket infrastructure
- Message persistence strategy
- Presence system

**Target:** 1-2 weeks development

---

### Phase 4: Event Creation & Discovery
**Goal:** Enable anyone to create and discover events

**Scope:**
- Event creation wizard
- Event discovery page
- Trending/popular events
- Search functionality
- Event analytics (views, participants, photos)

**Technical Requirements:**
- Event creation API
- Discovery algorithm
- Analytics pipeline

**Target:** 1-2 weeks development

---

### Phase 5: User Accounts
**Goal:** Enable persistent identity across events

**Scope:**
- User profiles
- Activity history
- Joined events
- Notification preferences
- Privacy controls

**Technical Requirements:**
- User table/schema
- Authentication (optional accounts)
- Profile management

**Target:** 1 week development

---

### Phase 6: Scale & Polish
**Goal:** Prepare for mass adoption

**Scope:**
- Push notifications
- Email digests
- Print/merchandise integration
- API for third-party integrations
- White-label options

**Technical Requirements:**
- Notification infrastructure
- Email sending capability
- External integrations

**Target:** Ongoing

---

## Feature Matrix

| Feature | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---------|---------|---------|---------|---------|---------|--------|
| Photo upload | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gallery view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RSVP | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moderation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Video clips | | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clips feed | | ✅ | ✅ | ✅ | ✅ | ✅ |
| Real-time chat | | | ✅ | ✅ | ✅ | ✅ |
| Event creation | | | | ✅ | ✅ | ✅ |
| Discovery | | | | ✅ | ✅ | ✅ |
| User accounts | | | | | ✅ | ✅ |
| Push notifications | | | | | | ✅ |

---

## Technical Milestones

### Infrastructure
1. **Database Isolation** — Table prefixes for future spin-off
2. **Environment Config** — All URLs from env vars
3. **API Versioning** — `/api/v2/moments/*` for future compatibility
4. **Feature Flags** — Gradual rollout system

### Performance
1. **Pagination** — 30 photos/page with Load More
2. **Image Optimization** — Proper thumbnail generation
3. **Caching** — Static asset caching strategy
4. **Edge Functions** — Run API at edge

### Security
1. **Rate Limiting** — Per-endpoint limits
2. **Input Validation** — Zod schemas
3. **Audit Logging** — Track sensitive operations
4. **Content Moderation** — Multi-stage approval

---

## Adoption Focus

### Target Events (Initial)
1. **Weddings & celebrations** — High emotional sharing, multiple attendees
2. **Conferences & meetups** — Professional networking, content capture
3. **Sports & competitions** — Team spirit, highlight reels
4. **Venues & establishments** — Regular programming, loyalty programs

### Target Users
1. **Hosts** — Event organizers who want permanent documentation
2. **Attendees** — Guests who want to share and preserve memories
3. **Content creators** — Professionals who want raw, authentic moments

### Success Metrics
- Events created: 100+ in first month
- Photos per event: 50+ average
- Return usage: 30%+ create/join multiple events
- NPS: >40

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Storage costs | Medium | Set limits (2GB/event default), compression |
| Moderation load | High | Auto-flagging, batch actions, AI assistance |
| Network reliability | High | Offline queue, retry logic, compression |
| Adoption barrier | High | Zero-friction entry, clear value prop |
| Content quality | Medium | Moderation tools, host curation |

---

## Next Steps

### Immediate (This Sprint)
1. ✅ Stage 1-3 fixes deployed to production
2. ⏳ Beta test with real events
3. ⏳ Gather feedback on UX

### Short-term (Next 2-4 Weeks)
1. Video clips foundation (Phase 2)
2. Real-time chat basics (Phase 3)
3. Event creation flow (Phase 4)

### Medium-term (1-2 Months)
1. User accounts system
2. Push notification infrastructure
3. Performance optimization for scale

---

## Open Questions

1. **Monetization** — Should there be premium features? What tier?
2. **Privacy** — Default visibility (public/private by event)?
3. **Content rights** — Who owns uploaded content?
4. **Retention** — How long are photos kept? Forever?
5. **Branding** — White-label for event hosts?

---

*This roadmap is a living document and will be updated as we learn from beta testing and user feedback.*