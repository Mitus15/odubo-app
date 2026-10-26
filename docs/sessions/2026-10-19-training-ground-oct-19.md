# 2026-10-19: the training ground, Oct 19

## Asked

"check out my downloads folder. i have a new dance video to work on." The take:
`~/Downloads/IMG_0344.MOV`, 10 min, portrait, HEVC HLG 30 fps, the storage
room, room music throughout. He named the first song (Planet Rock) and said
"these are training btw". On a walk-up that clips his shoes at the frame's
bottom: "its all good if im out of frame then im out of frame."

## Done

- The songs, from the room: Planet Rock (Afrika Bambaataa & the Soulsonic
  Force) from about 0:40 to 6:12, 126 bpm; Fly as Me (Silk Sonic) from about
  6:12 to 9:51, the whole song, about 99 bpm. Fly as Me was named from the
  lyrics (Whisper turbo; Demucs vocals for the first seven minutes). Planet
  Rock was his word; the chant fits.
- Seven feed cuts, each a whole number of bars from a beat tracked in the room
  audio (librosa, `tightness=400`), 11 to 15 s:
  | | move | take | bars |
  |---|---|---|---|
  | 01 | slide | 78.959-90.291 | 6 |
  | 02 | step-in | 190.311-203.500 | 7 |
  | 03 | lean-back | 308.906-320.226 | 6 |
  | 04 | ground | 346.604-359.770 | 7 |
  | 05 | reach | 444.922-459.307 | 6 |
  | 06 | hands | 502.508-516.916 | 6 |
  | 07 | wings | 536.130-550.515 | 6 |
- Each cut is its own windowed take, `film-work/train-0344-<move>`, ingested
  straight from IMG_0344 (`--from/--to`, no pick files this time), the window's
  room audio as `songs/room.wav` with `setup --at=<from>` (absolute take
  seconds), then segment (RVM), figure (gloss), `cut --show=.. --outro=no`
  full and silent. About 2.5 min a cut on the M1 Pro.
- Both songs whole, to watch (his ask): `train-0344-full-planet-rock`
  (46.916-375.000, from when he is in place to the crossfade at about 6:15)
  and `train-0344-full-fly-as-me` (375.297-596.500, until he reaches for the
  phone). Two takes segmented in parallel, each at 8 fps.
- The last two colours of the world's eight: Planet Rock chartreuse
  `#c9e05c`, Fly as Me mint `#8fdcc0`. Every field on the colour sheet is now
  spoken for.
- Delivered to `social-2026-10/training-ground-oct-19/`: 01 to 07, room sound
  at -14 LUFS (one-pass loudnorm, -14.0 to -15.4) and a silent twin, the
  overview sheet, `Captions.txt`.

## The arm lines (later the same evening)

- His ask, "for the filter in general": "you cant see what my arms are doing
  when they are in front of me cause everythings just black with no outline".
- Built `film:skin` (MediaPipe multiclass selfie model, body-skin class, square
  crops down his outline, GPU) and `figure.arm_lines` (a ring-coloured line
  round a bare arm where it lies over him). Decision record: "An arm across
  him is drawn" in `docs/decisions/loop-film.md`.
- Before/after on 0:49 to 1:01 and 1:45 to 1:57 sent; he approved. Both full
  songs redrawn and replaced in the delivery folder (same names); the seven
  clips were left for later at his word ("just the full songs rn, clips
  later").

## Oct 20: the clips redrawn, everything to post in one place

- The seven Oct 19 clips redrawn with the arm lines and re-delivered (same
  names, room and silent).
- "surface all the clips since billie jean. i havent posted any of them yet":
  `social-2026-10/to-post/` holds the latest of each, 18 videos named by take
  date: Levels 1-2 and 1-3 (Stromae, the v4 renders), Oct 13 (2, room sound),
  Oct 14 (5, silent), Oct 19 (7 clips and both full songs). `TO-POST.txt`
  lists credit, length and a caption for each (the levels' captions are new:
  "Next level.", "Cheers, player one."); `00-everything-to-post.jpg` is the
  overview. All 18 sent to his phone (the four long ones as 720p previews).
- Billie Jean is left out: it went up on Instagram on Oct 13.
- Only the Oct 19 pieces have the arm lines; Stromae and Oct 13 to 14 were
  drawn before them.

## Oct 20, later: every piece redrawn, and Reels, not clips

- Stromae redrawn with the arm lines (`img-0327`: skin, figure, both levels
  cut as v4 was: `--to=200.46` / `--to=411.10`, now `-v5`). Same lengths.
- The seven Oct 13/14 cuts redrawn on their old ranges, recovered from their
  sound (cross-correlation of each render's audio with its room.wav, 0.98 to
  0.999; each started 1.5 s into its window). Oct 13 was a hoodie: lines only
  round his hands (about 15% of frames); Oct 14, 74 to 99% of frames.
- He wanted clips for every song, then: "whats up with these 7 and 10 second
  clips. I though we were working with 30s - 1 minute reels?" The 8 to 15 s
  length was carried over from the Oct 13/14 batch; nobody asked for it.
  Now 15 Reels, 50 to 63 s, cut on 8-bar phrases:
  - Stromae from the v5 levels (A from the open, B to the end with the
    Danceman); Oct 19 from the full songs (frame-exact, VideoToolbox, ~20 s
    each, no new drawing).
  - Oct 13/14 rendered fresh from the phone files (`film-work/reel-*`),
    three workers at once, ~20 min each.
- `to-post/` = the 15 Reels + 4 full versions; the short cuts in
  `to-post/short-clips/`; each session folder keeps both versions of its
  Reels. All sent to his phone.
- IMG_0330 states r_frame_rate 120 over 30 real frames a second: ingest took
  120 and the first two Oct 13 Reels read every frame four times over. Fixed
  (`ingest.true_rate`, readers pinned to the take's rate), rerun.
- "all this type of video work is gpu stuff": figure and compose draw on one
  CPU core. Proposed and started as its own session ("Film pipeline: drawing
  and encoding on the GPU").

## Code

- `data/loop/film/shows/training/planet-rock.json`, `fly-as-me.json`.
- This branch merges `claude/dance-rehearsal-clips-e866e4` (the training HUD
  and `--outro=no`), which sits on the Stromae and Billie Jean branches.

## Notes

- Room loudness tells the usable takes apart: IMG_0344 -27.1 LUFS and IMG_0330
  (Oct 13) -28.4 hold up; IMG_0337 (Oct 14) -41.8 needed the library song.
- The khaki trousers catch the gloss highlight on the thighs; the look reacting
  to light clothing, left alone.
- 02 and 04 end on a walk up to the phone, shoes clipped by the frame. Kept,
  on his word.
- Planet Rock's credit: Afrika Bambaataa has faced child sexual abuse
  allegations since 2016 (he denies them). Flagged; he will post them with
  the credit as is.

- The skin model on the CPU took 130 ms a crop (3.6 fps); on the GPU, 11 ms.
  On the GPU it leaks like the pose does: Planet Rock's skin pass aborted at
  frame 8100 ("Error creating pixel buffer: -6662", a macOS "Python quit"
  dialog). `seg.Skin` rebuilds it every 1000 crops; the rerun went through.

## Next

- He posts by hand. Never offer to post ("i dont want them to nurf my content").
- When he posts some of `to-post/`, ask which, so the folder stays the truth.
- Molowo Noni (the first song of Oct 13) has no Reel; nobody asked for one yet.
- A `film:train` driver would make this weekly job one command (the driver
  lived in the session scratchpad: ingest, room.wav, setup, segment, figure,
  cut twice, deliver).
