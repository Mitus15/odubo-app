# 2026-10-26: the posting restart, and the Studio redesigned

## The schedule moved a day

His words: "We will work on the studio today and start the posting tmr (besides the full billie jean)".
Work had thrown his day off.

- Every Reel and short is one day later. The first is Tue Oct 27: the Fils de joie Reel A at noon,
  then its short at 6 pm.
- Full songs stay on the Tue/Fri 10:00 rhythm: Level 1-2 on Tue Oct 27, the last on Fri Dec 11.
- The 5 older Billie Jean drafts are one day later too.
- The shift was done in Los Angeles time, because daylight saving ends Nov 1, and +24 h in UTC
  would have moved those posts an hour.
- `schedule.py --start=2026-10-27` rebuilt schedule.json (the old file is kept beside it as
  schedule-before-2026-10-26-shift.json). All 87 D1 dates were checked against the rebuilt file.
- The schedule page was republished (artifact QDB6bxCEv6ejmT4Rfg7pHM, version 2), now with the
  real song lines.

## The Studio (src/app/admin/social-studio)

His complaint: "no way the index.html u created before should be easier on the user than the
official social page". The old Studio had six views, two plus buttons and things covering things.

**Three tabs, paper and ink.** The look is the catalogue page's and the playbill's: light on
cream, with a dark version when the phone is dark. Each post carries its song's colour. The tabs:

- **Today** (`TodayView.tsx`) is the front door. It shows the next post: the 9:16 video on the
  song's colour, the caption (tap to copy), and the song. Under it, "Start the sound at 0:02"
  in large type, then one drawn button for the next app. After that, the next three days as rows.
- **Schedule** (`ScheduleView.tsx`) lists every post by day, each with a mark per app. A tap
  opens the post in Today.
- **Library** (`LibraryView.tsx`, rewritten) holds every clip, song by song, with filters for
  Reels, Shorts and Full songs. A clip plays where it sits.

The top bar has one + (a new post) and a menu: Check the apps now, New post, Month, Post for Me
(the old dashboard, with its sync, publish and analytics) and Settings. The old tools open as
full-screen rooms with an X. `PostView.tsx` is gone; Today replaces it. The three tabs load with
the page, so switching is instant.

**The marks.** Each app shows one of: ✓ out (with its link and views), ◷ waiting in the app
(scheduled on YouTube, or in the TikTok drafts), ! refused (with the reason), or ○ still to
post. They live in `platform_status`, and `postQueue.platformState` reads them.

## The link to the apps (his "simulate an API between the studio and Instagram, TikTok and YouTube")

**In:** `POST /api/social/feeds`. It reads each connected account's Post for Me feed, matches
each live post to a planned one (`lib/social/feedMatch.ts`), and ticks that app with its link
and numbers.

- A match needs the same app, the same caption (the app may add hashtags after it) and a live
  time from 2 days early to 10 days late.
- An exact caption beats one that only begins the same. "Again." vs "Again and again." are
  both in the catalogue.
- A post found once keeps the app's id, so later checks only refresh its numbers.
- The Studio runs the check when it opens (at most every 10 minutes) and from the menu. There
  is no cron; Vercel's crons stay as they were.

The dry run against the real feeds matched Billie Jean's live YouTube video
(https://youtu.be/VQVoXoFkd4s) to its planned post.

**Out:** `POST /api/social/posts/[id]/send`, sent only on his tap.

- **YouTube** is for a full song with the song laid in. A sheet shows the title (the campaign
  name, e.g. "1-2 · Fils de joie") and the description (the caption, then the song's credit)
  for him to change. Then Schedule sends it public for the post's time.
- **TikTok** is "Or send it to your TikTok drafts". Post for Me's `is_draft` puts the clip in
  his TikTok inbox. He adds the song from the start time there and posts.
- Instagram Reels and YouTube Shorts stay on the share sheet, because their APIs can't add a
  library song.

## Known issues

- **Instagram's feed returns 500 from Post for Me** (with or without metrics). Until Instagram
  is reconnected in Post for Me (or Post for Me fixes it), Instagram ticks come only from the
  share and the Posted button. TikTok and YouTube feeds work.
- **YouTube uploads through Post for Me use Post for Me's shared Google project.** Its daily
  "Video Uploads" quota refused all 15 uploads on Oct 26. The Studio says so in one sentence
  and keeps Save video. A dependable automatic YouTube needs our own YouTube API project
  (not built).
- In the dev preview (`/admin/social-studio?fixtures&now=<ISO>`, reading
  public/_dev/studio-fixtures.json, which is git-ignored), videos can't be fetched for sharing:
  the media proxy needs the sign-in. On the phone it works as before.
- The old rooms (Month, Post for Me, Settings, New post) are still the old dark design.

## Checked

- `npm test`: 1,280 pass. The 2 failures are the known ones (emailTemplates, videos GET).
- The route auth tests pass with the two new routes, which are gated with requireAdmin.
- `tsc`: 846 errors, all old (the baseline was 850).
- The dev preview was checked at phone size in light and dark.

## Later the same night: the brand kit, and the Studio on brand

He asked, "can we make it more on brand before deploying and also speaking of which, I need an
accessible brand kit."

**The Odubo Brand Kit** is at https://claude.ai/artifact/F87QSC3m9j4XVfMQiNrUta (a Design System
page). It is private until he shares it from its Share menu. It holds:

- **The names:** Mani Odubo, Odubo Studio, B.A.A.D, Loop Soul, Mitus Young History.
- **The marks:** the lockup, the danceman and the seal as SVG, plus the B.A.A.D wordmark, with
  the 96px rule.
- **The colours:** Poster and Vault modes built on the house palette (oxblood, ink, sand).
- **The type:** Libre Baskerville for the name, Jost 500/700 for artwork, Geist for interface,
  with the font files included.
- **The rules:** the playbill rules, the voice rules (captions in the game's voice, no em
  dashes) and a levels page for the HUD.
- **Previews:** PrimaryAction, PlaybillRow and LevelHUD.

He then said **"the loop soul dance colors are not part of the brand kit"**, so the 15 song
colours were taken out of the kit. They stay as the campaigns' own colours in the Studio, as
data that says which song a post belongs to.

**The Studio now uses the kit's tokens, under the same names:**

- The colour names are ground, raised, text, text-muted, rule, accent, on-accent, ok and warn.
- **Poster:** a sand-bright ground with ink type and an oxblood button.
- **Vault:** an ink ground with sand type and a sand button.

Other changes:

- **The top bar:** the danceman (masked in the accent colour) and "Studio" in Libre Baskerville
  Bold. `layout.tsx` loads that font through next/font, for the Studio only.
- **The Today tab:** its icon is the seal.
- **Type:** captions and big numbers are in Jost 700, and the labels are Jost caps eyebrows.
- **Schedule:** rows lost their coloured edge.

## B.A.A.D's names (later still)

His words: "the full name of the brand is BAAD Creative Wear. BAAD stands for Bold Authentic Aesthetic
Dreams/Dreamers", then "BAAD by Odubo is still the idea cause its like a natural byproduct of Odubo Studio
work. but the full name is with the creative wear." Settled as three parts, used by the moment:

| Form | Where | Set as |
|---|---|---|
| The full lockup | where a stranger meets the label | **B.A.A.D Creative Wear**, with "by Odubo" on its own line under it |
| The byline | where the house speaks | **B.A.A.D by Odubo**, one line |
| The name | where clothes are already the context | **B.A.A.D** |

Two rules: never "Creative Wear" alone, and never all three parts on one line. The brand kit (version 5)
has the table.

On the site:
- `src/lib/store/brands.ts` gained `labelLockup()` (the full lockup) and `STORE_FULL_NAME`;
  `STORE_NAME` became `STORE_BYLINE`.
- The product page shows the full lockup.
- /links keeps "Shop B.A.A.D by Odubo".
- The site's description reads "B.A.A.D Creative Wear".
- Tests: `src/__tests__/baadNames.test.ts`.
- The Shopify shop name, which shows at checkout, is his to change in Shopify.

## The Portrait Hoodie (was the Faceless Hoodie)

His words: "the 'faceless hoodie' isnt actually faceless. thats my face on the back which is the same image
used for the signs of Life cover". Renamed **Portrait Hoodie**, his pick. The name says nothing of the album,
whose name is still held back.

Applied in Shopify at 2026-10-27 02:5x UTC through `scripts/shopify/loop-soul-drop.ts --apply`:
- the title;
- the first line, now "The ∞ small on the chest, the portrait across the back. ...";
- the SEO title and description, and the photos' alt text.

The script now refreshes a house description's first line from the manifest. It kept the old one before.
The as-found backup is `docs/shopify/backup-2026-10-27-loop-soul-drop.json`.

**The address:** `src/lib/store/movedProducts.ts` forwards `/store/product/faceless-hoodie` permanently to
`/store/product/portrait-hoodie`. Until Shopify's handle moves, the new address reads the product at the old
handle, so the two can change in either order.

**DEPLOY STEP:** once this branch is live, run
`npx tsx --env-file=.env.local scripts/shopify/loop-soul-drop.ts --apply`. The manifest's handle is already
`portrait-hoodie`, so this moves Shopify's handle, with Shopify's own redirect.

Also, product pages now end their details with "Designed by Mani Odubo" (`labelCredit()`); the signature
stays "by Odubo" (his call).
