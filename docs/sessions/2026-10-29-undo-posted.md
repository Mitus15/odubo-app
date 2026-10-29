# 2026-10-29: a post marked out could not be opened again

**His words:** "looks like I can't access previously posted videos. the youtube one was a draft that I cant
repost cause its marked posted. the draft is gone and i need it again"

## What happened
- The Fils de joie Short "Ready?" (`eec2e98d…`, YouTube only, due Oct 28 18:00) was ticked posted at
  23:00 on his clock by the share sheet: the Studio ticks a hand post as soon as the share goes to the
  app. On YouTube it stayed a draft. No YouTube link was ever attached (the feed never saw it).
- Once every app is ticked, the post is `published` and leaves the queue. Two faults kept it there:
  - Today only opened posts still in the queue, so a tap on it in the Schedule, the Library or the
    admin home's rail opened the next post instead. Undo was never on screen.
  - Undo only cleared the tick. The status stayed `published`, so the post stayed out of the queue.

## Done
- **Restored live, same morning:** status `draft`, `published_at` NULL, `platform_status`
  `{"youtube":{"posted":false}}`. Guarded on the share tick's exact values, read back. The row
  before: `short-before-restore-2026-10-29.json` in the session scratchpad. It heads Today again.
- **Code** (branch `claude/vigorous-chaum-29fdc9`, with the admin home):
  - `markPatch` (`lib/social/postQueue.ts`): what a tick or an Undo writes. The last tick makes
    the post published; an Undo on a published post makes it a draft again.
  - Today opens any post asked for, out or not, showing ✓ and Undo for each app. It skips fetching
    the video for a post that is out everywhere.
  - Out today's rows open their post.
  - Tests: `socialPostQueue.test.ts` (an Undo puts the Short back in the queue).
- Checked in the dev Studio at phone width (`?fixtures`): `?post=` on a post that is out, Undo,
  Posted then Out today, and the Schedule's past days.

## Left as it was
- The share sheet still ticks on the share. If he backs out in the app, Undo now puts the post back.
