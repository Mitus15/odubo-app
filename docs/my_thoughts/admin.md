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
- Randomize on initial fetch (ORDER BY RANDOM())
- When user reaches end of clips, reshuffle the deck and continue seamlessly
- No database ordering - always random
- No admin toggle for this behavior
- Remove feed_position from clips API consideration
- Remove "Feed Order" view from Arsenal/admin UI

### What Was Removed
- `/api/arsenal/feed-order` endpoint (archived, not deleted)
- "Feed Order" view mode in ArsenalTab
- `order=manual` parameter support in clips API

---

## Previous Notes

User: hey, can we improve the ui, and responsiveness of the dropdown button. its animation consistency and quality needs some work, the snapping and movement is fine but the opening and closing animations can be cleaner and smoother with less jank and glitch

*(Previous Copilot discussion about ExpandableLogoMenu animation improvements archived)*

---

*Last updated: January 27, 2025*
