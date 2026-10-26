# 2026-10-02 · The Foundation: a real plan and a real team

The owner asked for a mentor's read of everything built here, turned into a
legitimate business: what kind, which customers, the structure, the launch,
the operations, the market and a team. The answer is the living doc
**"The Foundation"**:
https://claude.ai/code/artifact/b7451057-4db7-4b02-b204-f2b2654df7be
The decisions are in `docs/decisions/the-foundation.md`.

## How the plan was shaped (the owner steered it four times)

1. **First draft.** I read the whole repo plus the vision and brief documents
   and proposed four boxes, one of them an education pilot.
2. **The day job came out.** I had read an employment document outside the
   repo and built the day job into the plan. The owner pointed out the business
   has nothing to do with it, so it was removed. The boundary is now
   a memory: the workplace stays out of business plans.
3. **"The school is a future campus, not Odubo Studio."** For now Odubo is a
   design company. It makes tools for creating, plus works and art that flow
   from them, and creative wear blurs the two.
4. **"I need a team to run this studio" and the event spin-off.** Product one
   became a tool for event curators, built on Loop Soul and Moments. The team
   became three founding seats, a crew paid per event, and advisors.
5. **"Simplify planning, hosting and posting; hold all assets; a portfolio
   for hosts; a memory gallery for guests."** This set the seven parts. A
   wedge rule was added: curators pick the first job to fix.

## The evidence the plan stands on

- About 790 commits on main since 2025-07-30, nearly all the owner's (two
  GitHub names).
- About 199,000 lines, 365 API routes and 165 migrations.
- Outside revenue: none. 2 passes sold for the 10 October night, both the
  owner's; 0 garments sold; about 2 real customer emails in a year.
- The data is already keyed per event: `loop_attendance`,
  `loop_media_credits` and `danceyokey_signups` all carry `event_id`, and
  Moments `events` has `created_by`.
- `loop_settings` is a global key/value store and everything is branded Loop
  Soul. Curator accounts are therefore the main missing piece.

## Found in passing

- **`GET` and `PUT /api/customers/[id]` had no auth check.** The list route
  next to them does check. This was spun off as its own task (lock it behind
  admin auth and sweep similar routes). The owner started it in a separate
  session.
- **`CLAUDE.md` is out of date.** It still calls Odubo "a multimedia artist
  platform" and describes Capacitor folders that don't exist. Flagged to the
  owner, not changed.

## Next steps (from the plan, October 2026)

- Register Odubo Studio; first advisory meeting.
- Founding-team conversations: technical lead first, then partnerships lead.
- Finish the security repair, then freeze all code except product one.
- List 20 curators, talk to 10, and pick one for a free pilot night.
