# Heard Once: the campaign media, rebuilt — handoff for an agent with zero context

Written 2026-09-23 by the previous agent. Everything below is verified unless marked. Read it top to bottom once; then the owner's own words in §2 are the brief.

## 0. Who and what

- **Owner:** Mani Odubo (`maniodubo@gmail.com`), a Kamloops musician, not an engineer. He makes the calls; you make them buildable. He is direct and impatient with work that is "mid". Never send anything, post anything, or spend money without his explicit yes.
- **The album:** *Loop Soul*, 14 tracks, unreleased and not streaming anywhere. Only the single **1984** is public (free at `odubostudio.com/loop/1984`).
- **The night:** Saturday **10 October 2026**, the courtyard at Scott's Inn & Suites, Kamloops. Doors 6:30, album performed live front to back at 8 with Amen the DJ, 80s dance floor at 9, out by 10. **$5** pass at `odubostudio.com/loop`, 19+, dress code 80s, capacity 250. As of Sep 22, **2 passes sold** (both the owner's). The pass is emailed as a ticket and is also a pre-order: three tracks open immediately, the whole record after the night.
- **The repo:** `Mitus15/odubo-app` (public on GitHub). Next.js app at `odubostudio.com`. Work on a worktree branch and push to `main` (auto-deploys to Vercel). Gates: `npx tsc --noEmit` baseline 850 errors / 10 TS2307 (judge differentially), `npm test` 322 passing + 2 pre-existing failures. Read `docs/HANDOFF.md` for the app; this file is only the media campaign.
- **House rules for anything a guest sees:** no em dashes; never "Volume 1" (it's Loop Soul); never "the room/Portal/unlock"; 19+ on everything; no faces of guests (the filter); one link, `odubostudio.com/loop`.

## 1. What exists right now (all done, all on `main`)

| Thing | Where |
|---|---|
| The campaign plan, "Heard Once" (17 days of silent dance reels, 1984 with sound on Oct 1, three freezes, the night). Day-by-day table, captions, grid mock, rules. **The owner approved the idea.** | Artifact https://claude.ai/artifact/KBeQr4oerXjXLF3eN7vYL1 (private to him; ask him to share it with you or paste it) |
| The press kit page for promoters | `odubostudio.com/loop/press` (code: `src/app/loop/press/`, files via `npm run loop:press`, see `docs/loop/press.md`) |
| The single's own page + share card | `odubostudio.com/loop/1984` (`src/app/loop/1984/`) |
| Captions (tested: date, place, $5, 19+ in every one, no em dash) | `src/lib/loop/press/copy.ts` |
| The source video | `~/Downloads/IMG_0129.MOV` — 4.3 GB, 37:00, 1920×1080 HEVC 30 fps, locked-off camera, white room, a glossy TV (rect x 741–1345, y 91–435) showing a night-sky screen saver. Mani dances through most of the album **in headphones: the audio track has no music** (checked: no beat periodicity anywhere). Recorded 2026-06-20. |
| The album masters (m4a) | `~/Documents/Loop-soul-the-entertainment-room/social-2026-10/heard-once-work/m01..m14.m4a` (fetched from R2; keys in D1 `tracks.audio_url`). Track list §5. |
| **First cut of every post** (what the owner called "mid") | `~/Downloads/Loop Soul - Heard Once/` (14 MP4s named by post date + cover cards) and a copy at `~/Documents/Loop-soul-the-entertainment-room/social-2026-09/heard-once/` |
| The cover cards (sand tile, huge track number, Jost) + grid preview | same folder, `covers.py` in `scripts/loop/reel/scratch-2026-09-23/` |
| The video converter (the Loop Soul filter: ink figure on sand, room as flat shapes) | `scripts/loop/video-convert.mjs`. Added 2026-09-23: `--bgFloor=2` (room never darker than SAND_DEEP, so a dark TV can't swallow a dark shirt). Notes: `docs/decisions/loop-video-converter.md`, memory `loop-video-converter.md`. |
| MediaPipe (installed today, `pip3 install mediapipe` → 1.0.1 on Python 3.13) + models | `/tmp/claude-501/models/selfie_segmenter.tflite` (**re-download**: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`). The multiclass model is useless at this distance; don't bother. |
| Toolkit started (2 files) | `scripts/loop/reel/common.py` (palette, ffmpeg helpers, cached motion signal, onset envelope), `scripts/loop/reel/sync.py` (pin a song's start by movement-vs-beat correlation) |
| Scratch scripts of the first cut | `scripts/loop/reel/scratch-2026-09-23/` with a README |
| PostForMe (the posting API the repo already uses) | key `POSTFORME_API_KEY` in `.env.local`; client `src/lib/postforme.ts`; accounts: Instagram **@recoolman** `spc_UFAO8UmUS0uGFo5nGuCTi`, TikTok "Mani Odubo" `spc_qbdHpXQvZows3wsrTEIA`, YouTube "Mani Odubo" `spc_mvAVbZwNIHMfJAdApZzt`. Nothing scheduled since Sep 1. |
| Gmail drafts (not sent) | the co-host email (To: empty), the Castanet reply (in Harsha's thread). `docs/loop/promoters/`. |

## 2. What the owner asked for (his decisions, verbatim where it matters)

1. *"we need to actually create the media... i can give you the original time stamps for the beginning and end of each song in the original video so we can actually make something good. the posts we have now are mid. we need a media overhaul. equip the necessary skills"*
   → **Ask him for the 14 timestamps first.** Format: `song: start – end` (video time). Refine each with `sync.py` (§4.2). The first cut failed because the moments were picked by motion statistics, not by the songs.
2. **Sound:** *"Only a few seconds of each song."* A tease: silent dancing, the real song drops in synced for ~4 s at its peak, hard cut to silence and a freeze. 1984 (Oct 1) can carry sound throughout (it's public). Do **not** put more of the unreleased album online; the product promise is that it isn't streaming anywhere.
3. **Look:** *"me alone with the loop soul watermark no background like the album cover."* Flat sand ground, his ink figure with pale highlight cuts, the Loop Soul wordmark (`public/loop/branding/loop-soul.svg`, ink) top-right at the cover's proportion (~21% of the width, ~6% margin). Nothing else in frame. Reference: `public/loop/press/cover/loop-soul-cover-art-mani-version.png`.
4. **Then schedule it** with the existing PostForMe machinery to **Instagram @recoolman + TikTok + YouTube Shorts**, **6:00 pm Pacific** daily (Ghost World at 6:30 pm on Oct 10), and **monitor** it. He reviews the rebuilt clips before anything is scheduled.
5. **"Equip the necessary skills":** the tooling should be real, reusable, documented (a project skill `.claude/skills/loop-reels/SKILL.md`), not one-off scratch.

## 3. The approved plan (from the planning session; still valid)

Full text: `/Users/maniodubo/.claude/plans/i-feel-like-the-moonlit-hoare.md` (also summarised here).

1. **Equip:** MediaPipe selfie segmenter for the person mask (done, see §4.1 for the one fix it needs); a figure-only render (port the converter's figure styling to Python, or add `--figureOnly --maskIn=` to `video-convert.mjs`); a compose step that places the figure on sand with a tracked virtual camera and the wordmark.
2. **Timeline** from the owner → `docs/loop/campaign/timeline.json`, each start refined by `sync.py`.
3. **Edit engine** `scripts/loop/reel/edit.py --song=03`: pick the song's peak ∩ his strongest movement in that stretch; whole bars, cuts on beats; silent → 4 s of the song at the peak → hard cut + freeze (1.5 s). 1984: 20–25 s with sound. The film (first post): ~60 s, one beat-cut moment per song in album order, silent, closer drops in for the last 3 s, "October 10." The freezes (Oct 7–9): a real stop after a hit, held, with the numeral. Output to `Loop Soul - Heard Once/` (same names), contact sheet per clip.
4. **Schedule + monitor** `scripts/loop/campaign.ts` (pattern: `scripts/schedule-all.ts`): `upload` (Cloudflare Stream like `scripts/loop/stage-reel.mjs`; covers as public images), `schedule --dry` / `--go` (`createPost` per day to the three accounts, `scheduled_at` with explicit −07:00, `media:[{url,type:'video',thumbnail_url}]`, Instagram `placement:'REELS', share_to_feed:true`, YouTube title; **refuse any row without `scheduled_at`, PostForMe posts immediately otherwise**), write rows to D1 `social_content` so `/admin/social` shows them, `status` (getPost + `getAccountFeed(..., expand metrics)` + passes sold from `src/lib/loop/numbers.ts`), `cancel`. A local scheduled task at 9 pm Pacific runs `status` and reports.
5. **The skill** + `docs/decisions/loop-heard-once-media.md`.

## 4. What was learned the hard way (don't repeat)

### 4.1 The mask
- The plate-difference mask in the converter loses the head against the dark TV and draws the screen saver and light reflections as ink blobs. `--bgFloor=2` fixed the swallowing; nothing fixed the blobs.
- **MediaPipe selfie segmenter** (`ImageSegmenter`, VIDEO mode, `output_confidence_masks=True`) at 960×540 runs ~150 fps and catches the body cleanly. Its single confidence mask **is the person** (`cm[0]`; do not invert). It **bleeds into the dark TV around his head**. The fix that worked: inside the TV rectangle, AND the mask with the colour rule from `tvclean.py` (`keep = ((g>b)|(r>b+8)) & (lum>30) & ~((lum>170)&(sat<45))`), then binary opening, keep the largest component (+ components touching the rect's bottom edge that don't touch its sides), fill holes, dilate 4. Add temporal smoothing (median over ±1–2 frames). Verified visually on the 1984 moment (`/tmp/claude-501/dance/seg/masksheet2.jpg`, bottom row).
- Figure styling to reproduce from `video-convert.mjs` lines ~900–990: smooth the binary mask and re-threshold at 0.5 for a drawn edge; ink rim = blur(solid, r≈0.004·H) ≥ 0.72 is "interior"; inside, luminance cuts at `lo+span·0.55` and `lo+span·(0.55+0.45·0.55)` → INK / SAND_DEEP / SAND_BRIGHT (use SAND_BRIGHT for the top band so highlights read paler than the sand ground, like the cover); despeckle regions < 0.00008 of the frame.

### 4.2 Sync
- 12-second windows cross-correlated against a song's onset envelope find local locks well (dance 9:02 ↔ 1984 @1:57, score 0.38 vs a 0.23 chance ceiling from 2000 random pairs).
- Whole-song locks from a rough guess are **weak** (`sync.py --master=m02 --near=425 --window=30` → 448.4 s, z 3.7). Reason unknown: he may have paused, restarted, or danced to only part of a song. **This is why the owner's timestamps are required**; use `sync.py` only to refine a start he gives you by ±5 s, and trust him over the number when they disagree.
- Beat grid for cutting: tempo from onset autocorrelation of the master (fold to 65–135 BPM: 1984 = 80.7, Ghost World = 86.1, The Mind Pt 1 = 129.2, News Peak/Other Side = 99.4, Rap/Makunahea/Mind Pt 2 = 89.1, Hallucinogen = 73.8, In The Court = 80.7; Welcome and the three 35 s interludes have almost no beat), phase by maximising onset energy at beat positions. Dance pulse at 15 fps is too coarse for phase; use the audio grid and place cuts on it.

### 4.3 Framing and camera
- A vertical 608×1080 crop tracked per moment worked (whole body in frame); figure ~86% of frame height at normal distance. With the room gone, place the figure on the 1080×1920 sand canvas with a **smoothed virtual camera**: keep the feet on a fixed baseline (~88% of height), follow x, one scale per clip so he never crops.
- **Motion blur** of fast arm swings becomes big ink shapes. It reads as motion; the owner has not objected. Watch it.
- `ffmpeg -ss` seeks and the converter's own frame index do not land on the same frame; compare by content, not by index.

### 4.4 Shell and machine
- zsh: `$VAR:t`, `$B:path` and unquoted `$X` in filenames get mangled (`:t` is a zsh modifier). Build ffmpeg filter strings in Python, never in a shell heredoc.
- `zsh` globs error on no match (`rm -f x*.jpg` aborts a `&&` chain); use `find -delete`.
- No `timeout` on macOS. ffmpeg is `/opt/homebrew/bin/ffmpeg` (drawtext, libx264, videotoolbox available). `sharp` in node_modules rasterises SVG. PIL 11 available (Jost fonts in `public/loop/fonts/`).
- Node scripts need `node_modules`; in a worktree symlink it: `ln -s ../../../node_modules node_modules`.
- The converter at 1080×1920 renders ~13 fps; a 97 s context clip + 7 s render is ~2 min per moment.

### 4.5 Posting
- PostForMe `createPost` without `scheduled_at` publishes immediately. `status` goes `scheduled → processed`, never `published`; URLs only via `getAccountFeed` matching.
- Custom Reel cover: `thumbnail_url` on the media item is the only mechanism used in the repo; whether Instagram honours it is undocumented here. Test with one post first (schedule it a day out, check the IG preview, cancel).
- The old reels' soundtrack is Billie Jean (a commercial master): never reuse it, never tag the song or artist.

## 5. The tracklist (D1, verified)

| # | Title | s | notes |
|---|---|---|---|
| 01 | Welcome | 74 | ambient intro, no beat |
| 02 | 1984 | 294 | the public single |
| 03 | Hallucinogen | 249 | |
| 04 | The No End Theory | 35 | interlude, never posted |
| 05 | In The Court | 226 | |
| 06 | News Peak | 334 | |
| 07 | Every Generation | 35 | interlude, never posted |
| 08 | Rap | 219 | |
| 09 | Makunahea | 168 | |
| 10 | The Other Side | 331 | |
| 11 | The Mind Pt 1 | 517 | the long one |
| 12 | Midnight Marauders | 35 | interlude, never posted |
| 13 | The Mind Pt 2 | 261 | never posted ("only in the courtyard") |
| 14 | Ghost World | 287 | posted at 6:30 pm on the night |

Posting order (from the plan): Sep 23 film · 24 `01` · 25 `03` · 26 `05` · 27 rest · 28 `06` · 29 `08` · 30 `09` · Oct 1 `02` with sound · Oct 2 cover post (owner films) · Oct 3 street performance (owner) · Oct 4 the street film (owner) · Oct 5 `10` · Oct 6 `11` · Oct 7–9 freezes 3/2/1 · Oct 10 `14`. Days already past when you start: shift nothing, just skip them; the owner posts by hand if he wants.

## 6. The order of work

1. Read this, the plan file, `docs/loop/press.md`, `docs/decisions/loop-video-converter.md`. Open the artifact (ask the owner to share it).
2. **Ask the owner for the 14 timestamps** in one message. Offer him a contact sheet (`ffmpeg -vf "fps=1/30,scale=320:-2,tile=8x10"`) with timecodes if it helps him.
3. While waiting: build `segment.py` (mask with the §4.1 fix, cached as a mask video per range), `figure.py` (styling), `compose.py` (camera + wordmark), test on the 1984 moment at 542–554 s (9:02, known good).
4. Timeline in → `sync.py` refine → `edit.py` per song → render all → contact sheets → **owner review**.
5. `campaign.ts` upload/schedule `--dry` → one test post scheduled a day out for the cover check → `--go` for the rest → `status` → the 9 pm scheduled task.
6. The skill and the decision doc. Update `docs/loop/owner-checklist.md` (it already lists the campaign) and memory (`~/.claude/projects/-Users-maniodubo-Documents-Apps-odubo/memory/loop-press-kit.md`, section "Heard Once").

## 7. Working directories

- Work dir (masters, caches): `~/Documents/Loop-soul-the-entertainment-room/social-2026-10/heard-once-work/` (has `room.json` with the TV rect and the 14 masters).
- Deliverables: `~/Downloads/Loop Soul - Heard Once/` (replace the first cut in place, same names) and the archive folder under `social-2026-09/heard-once/`.
- Scratch from the first cut: `/tmp/claude-501/dance/` (may be gone; the scripts are in the repo).
