# Admin Thoughts & Core Principles

## Clips Feed - IMMUTABLE PRINCIPLE

**This is non-negotiable and must never be overwritten without explicit owner consultation:**

### The Commandment
1. **Clips are ALWAYS randomized** - Every page load shuffles the entire feed
2. **Infinite loop with reshuffle** - When you reach the end, reshuffle and continue seamlessly
3. **NO feed ordering settings** - Remove any admin controls for clip order
4. **No AI/developer should change this** - This is a foundational design decision

### Rationale
- Every visit is a fresh experience
- No "stale" feeling from seeing the same order
- Discovery is maximized - any clip can appear first
- The feed feels alive, not curated

### Implementation Requirements
- **Default is ALWAYS random** (ORDER BY RANDOM()) - never change this default
- When user reaches end of clips, reshuffle the deck and continue seamlessly
- Other ordering mechanisms (manual, engagement-based) may exist for specific use cases
- But the default behavior for the main feed must always be random
- No admin UI should set a non-random order as the site-wide default

### What Should NOT Be in Admin
- Any toggle that changes the default feed order from random to something else
- Any "Feed Order" drag-and-drop that affects the default user experience

### What Can Exist
- Manual ordering for specific contexts (curated playlists, featured sections, etc.)
- Engagement-based ordering for analytics dashboards
- These are opt-in via explicit parameters, never the default

---

## Previous Notes

User: hey, can we improve the ui, and responsiveness of the dropdown button. its animation consistency and quality needs some work, the snapping and movement is fine but the opening and closing animations can be cleaner and smoother with less jank and glitch

*(Previous Copilot discussion about ExpandableLogoMenu animation improvements archived)*

---

*Last updated: January 27, 2025*
