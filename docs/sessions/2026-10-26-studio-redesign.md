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
