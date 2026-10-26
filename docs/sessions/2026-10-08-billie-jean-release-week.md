# 2026-10-08: 1-1 Billie Jean, the release week

## Asked

How to release the 4:48 performance so it gives people something instead of
asking for five minutes; then: render and plan everything on /social so on
Monday he opens admin.odubostudio.com on his phone, downloads the right
version of each post and posts from the apps. "Your turn" (duets) dropped: he
goes quiet after this week.

## Done

- Three moments cut from the full render (`out/dance-1-1-full-full.mp4`, 30 fps)
  with its sound, on bar lines. The render starts 1.12 s into the song, so
  bar n starts at output 0.1434 + (n-1) x 2.0556745 s:
  - the open, bars 1-4, frames 4-251 (8.23 s)
  - the feet, bars 70-73, frames 4260-4506 (8.2 s), close-up on bar 71
  - the clap, bars 79-82, frames 4815-5061 (8.2 s), the jump clap at 164.06 s
- Raw vs gloss, bars 91-98 (frames 5555-6048, 16.4 s): `compose.py --plate`
  writes the phone's picture through the same camera; `--body=961.917` pins
  the whole song's scale (registration against the full render: 0.104 mean
  difference outside the HUD). `split.py` cuts down the middle of him and lays
  the HUD across both halves.
- Files in `~/Documents/Loop-soul-the-entertainment-room/social-2026-10/billie-jean-gloss/`:
  `1-1-moment-open.mp4`, `1-1-moment-feet.mp4`, `1-1-moment-clap.mp4`,
  `1-1-raw-vs-gloss.mp4`.
- /admin/social: folder "1-1 · Billie Jean" (#10). All dated 10:00 PDT, captions
  "Billie Jean, in silhouette." + #billiejean #michaeljackson #dance on every
  platform it goes to, each with a hidden clip opening the Infinity Hoodie:

  | Day | Draft | Piece | Platforms |
  |---|---|---|---|
  | Mon 12 | #8 | the Reel, 60 s | Instagram, TikTok |
  | Mon 12 | #9 | the whole song, 4:49 | YouTube |
  | Tue 13 | #13 | the clap | IG, TikTok, YouTube Short |
  | Wed 14 | #12 | the feet | IG, TikTok, YouTube Short |
  | Thu 15 | #11 | raw vs gloss (status review) | IG, TikTok, YouTube Short |
  | Fri 16 | #10 | the open | IG, TikTok, YouTube Short |

  The folder lists newest first, so #8 and #9 had their `created_at` moved to
  now to read in posting order. All six download links answer 200 with the MP4.

## Open, his

- Raw vs gloss shows his face and the polo's logos: post or archive (#11).
- Posting by hand keeps the site clips hidden; make each public in
  /admin/videos when he wants it in the feed. Billie Jean next to a product on
  the site is not covered by any platform licence (see the chat of this day).
- If a platform mutes the baked-in song, re-post with the app's own Billie
  Jean sound.

## Branch

`claude/billie-jean-gloss`: compose `--plate` and `--body`, `split.py`,
`tests/test_split.py` (71 film tests pass), skill and decision notes.
Unmerged, unpushed.
