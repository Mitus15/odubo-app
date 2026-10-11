# 2026-10-11: B.A.A.D on the landing, the Studio plans the week, and the social API closed

## Asked

- The landing's mark and the link tree's store tile: the B.A.A.D icon (the
  quatrefoil seal), not the studio's dancer. Shipped earlier the same day
  (3a3ad8ec, 075c6c26, deployed with the store fixes: main 075c6c26).
- "Shop all" says "Shop B.A.A.D by Odubo"; the label's name is "B.A.A.D by
  Odubo" in general, but only where the full name is needed: "its just the
  name but where its not necessary to have the full thing ... no need to over
  do it". So the tag over the product stays "B.A.A.D".
- Every Billie Jean piece on the Social Studio (/admin/social-studio), which is
  where he plans the week.

## Done

- `brandLockup()` (`src/lib/store/brands.ts`) reads "B.A.A.D by Odubo" (was
  "by Odubo Studio"): the product page's lockup line. `STORE_NAME` for the
  landing's link. The landing's tag over the product is the plain vendor.
- The Social Studio: campaign "1-1 · Billie Jean" (`camp_20261011_billie_jean_1_1`,
  rose `#f593a6`, Oct 12-16) and six DRAFTS in `social_posts`, each dated
  10:00 PDT, with platforms, the connected account ids, caption, hashtags,
  a note, the Stream MP4 and thumbnail, and the hidden site clip as source:
  Mon the Reel (IG, TikTok) and the full song (YouTube), Tue the clap, Wed the
  feet, Thu raw vs gloss (note: his face and the polo's logos, his call), Fri
  the open. Drafts never auto-publish: `process-scheduled` takes only
  `status = 'scheduled'`. The /admin/social drafts (#8-#13) are still there.
- The Studio's post sheet (`PostDetailSheet.tsx`) gained what posting by hand
  from the phone needs: Download (the MP4), Copy caption (caption and
  hashtags), Mark posted (status published, `published_at` now; the update
  route now accepts `published_at`), the post's note, and "Planned for" on a
  draft instead of "Scheduled for".

## Found and closed

**The whole `/api/social/**` surface answered anyone, live.** Anyone could
create a post with their own video and publish it straight to the owner's
Instagram, TikTok and YouTube (`POST /api/social/posts/publish`), or mark one
scheduled for the cron to publish, and read or delete every draft. Now:

- `handleSocialApi` in `src/middleware.ts`, fail-closed at the edge like
  `/api/admin`: a verified admin session, or `Authorization: Bearer
  <CRON_SECRET>` on the two paths the social-sync cron calls
  (`/api/social/posts/process-scheduled`, `/api/social/sync`).
- `requireAdmin` inside the post routes too (list, create, publish, read,
  edit, delete).
- Verified on the dev server: all of them 401 without a session.

## Checks

tsc 849 (baseline unchanged); the two old jest failures only (`emailTemplates`,
`videos.get`); no lint errors on changed lines; build passes. The Studio UI
itself was not clicked through (no admin sign-in in the preview); its data is
in place and its routes answer 401 to outsiders.

## Then: Post, the Studio's way to post by hand

The owner: "i wanna be able to open my social page and systematically post
stuff with as little friction as possible (not using postforme though)", and
"i also wanna be able to preview".

- A **Post** view, first in the Studio's bottom bar with a count of what is
  due, and the view the Studio opens on when anything is due today
  (`components/PostView.tsx`, logic in `src/lib/social/postQueue.ts`, tested).
  Today and overdue first, in time order, then coming up, then undated; the
  first one opens by itself.
- Each post: the **preview** at phone proportions (9:16), with an overlay per
  app (Instagram, TikTok, YouTube view) showing roughly where its header,
  caption and button rail sit, to check the HUD and the moves stay clear; the
  note; the caption as it will be pasted (tap to copy).
- One button per platform, **Share to Instagram / TikTok / YouTube**: it copies
  that platform's caption and opens the phone's share sheet with the video
  attached (Web Share API, files), so the app's composer opens with it. A
  completed share ticks the platform (`platform_status`, now accepted by the
  update route); "Done" ticks one posted another way; "Undo" unticks. When all
  are ticked the post is marked published and the next opens. On a desktop
  (no file sharing) the tap opens the video to save, caption copied.
- The video is fetched when the post opens (progress bar), because iOS only
  allows the share in direct answer to a tap. Stream's download link
  redirects without the cross-origin header, so the browser could not fetch
  it; `/api/social/media` (admin only, Stream hosts only,
  `src/lib/social/streamDownload.ts`, tested) resolves it to the signed link,
  which the browser can.
- Verified on a throwaway local page with the six real posts at 375x812: the
  queue, the preview, the Instagram overlay (the HUD sits just under its
  header), the note, the caption, the share buttons. The share sheet itself
  only exists on a phone: first real test is his.
