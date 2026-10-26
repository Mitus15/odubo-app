# 2026-10-25: every post's place in its song

He was going to time the 14 full videos by ear. A phone page for it ("Song Times" artifact, the
videos as 432x768 copies) played locally but not on his iPhone; then he chose the better way: the
real song audio, lined up by machine, which the YouTube versions will need anyway.

## Done

- `ytmp3` on his Mac (`~/.local/bin/ytmp3`, not in the repo): yt-dlp, updated from 2025.06.30 to
  2026.10.21. A song name searches YouTube Music's songs, so it gets the official album audio; plain
  YouTube search gave a re-upload. MP3 to ~/Downloads, "Artist - Title".
- The 12 official tracks fetched (Stromae's two were already lined up). Prayer in C is the Robin
  Schulz radio edit (3:09); the extended remix fits worse. Planet Rock is the 5:20 single (not the
  12", see below), Around the World and Lady the album versions.
- Every full video placed in its song: `Work files/catalogue/song-starts.json` (one number each),
  `song-locks.json` (song length, file, how sure). `catalog.py __none__` then wrote all 87 "Song:"
  lines in CATALOG.txt; only those lines changed.
- `scripts/loop/posts/song_lock.py`: the method that worked, as one command.
- `catalog.py`: a piece that opens before its song says "the song starts N s into the video" (and
  likewise past its end) instead of a negative time.

## How sure

Rhythm windows (the film's `sync_audio.lock`) locked 8 songs cleanly, but loop-built tracks fooled
them: every bar sounds like the last. The arrangement (24 bands' loudness over the whole video) put
all 12 in one place, agreeing with the clean rhythm locks to 0.02 s; right place 0.6 to 0.8, next
0.25 to 0.4.

- First pass: Planet Rock looked like a quiet room (r .25 vs .18, start 13.5 s, a raw-take check
  seemed to agree) and Around the World had one bar (1.98 s) of doubt.
- **Second pass (his "work on what's unsure"), 20 s parts each judged on their own, by arrangement
  and by harmony (chroma):**
  - Around the World: 91.88 s wins 31/31 parts (arrangement) and 30/31 (harmony). One bar off
    scores about 0, two bars off about .29: the riff spans two bars. Settled.
  - **Planet Rock was the wrong version.** Against the 6:24 12" the parts sat at four places,
    stepping later through the video (-13, +6, +13.5, +29): an edit. He played the 5:20 *Planet
    Rock* single (1982): 29/29 parts, r .68 vs .32, **the song starts 11.9 s into the video**. The
    13.5 s fit was the middle of the 12", the stretch both versions share; all 8 Planet Rock lines
    moved about 25 s. The 12" file is gone from Downloads, the single is there.
- `song_lock.py` now judges by parts and both features, says how many parts agree, and warns when
  they disagree (a different edit, or a skip); `--map` shows each part's own place.

## Next

- The YouTube full versions with the real song laid in (his call; Content ID will claim them).
- `stage.py --notes` carries these lines into the Studio drafts when they are staged (not yet).

## Checked by ear

Every start refined on the beat (onset lock near the place, 20 s windows, median): all within 18 ms
of what was saved; the catalogue's whole-second lines did not change. Line-up videos (picture
untouched, the official song at -16 LUFS over the room 3 dB under) in `Posts/Line-up check/`;
Stromae's room comes from the raw Oct 11 take, since their level videos carry the master.
**He listened to all 14: "they all look good."**

## Ready to post (his ask: YouTube cut naturally, the rest synced for the apps' sounds)

- **YouTube cuts** (`youtube.py`, `Posts/Ready to post/youtube/`): the official song laid in at its
  mastered level, no room sound. Ten open on the song's first note (he is already standing ready);
  Around the World, On Form, Prayer in C and Memories open on the first bar after he settles,
  eased in over half a second. Each closes on the last bar before he stops (Hold the Line 2:47,
  Lady 3:45, Fly as Me 3:34), the song fading over two bars, the picture fading to its floor; Santé
  ends with its song, Fils de joie keeps its own outro. In/out points: `youtube-cuts.json`, read
  from frame strips and the matte (camera setup = big near the lens, then the walk back).
- **Reels and shorts open on a whole second of the song**, because the Instagram and TikTok sound
  pickers start a song on one: the 53 cut by bars from the full renders open up to 0.9 s earlier,
  the 20 separate renders lose up to 0.9 s from the head, GLBTM reel A now opens on the song's
  first note. Checked by ear-equivalent: each clip's room sound locked to the official song, 73 of
  73 within 32 ms of the stated second (median 9 ms). CATALOG.txt: "Sound from 0:17 (to 0:59)",
  and the recording where the title alone could pick the wrong one (Planet Rock's 5:20 single,
  Prayer in C's radio edit, the album versions of Around the World and Lady).
- `stage.py` uploads a full piece as its YouTube cut; its note says to start the app's sound at
  that second and turn the original down.
