# Posts: from full renders to the Social Studio

The weekly training posts (Reels, shorts, full songs) after `film:dance` has rendered each song whole.
Data lives in `projects/Loop Soul Dance/Work files/catalogue/` (gitignored, like all dance media).

- `draw.sh <take>...` segment, paint and figure each take; run it through `detach.py <log> draw.sh ...`
  so it survives the app (never under `taskpolicy -b` while he is away: that pins it to the slow cores).
- `pick.py <slug>` choose a song's Reels and shorts by how much he moves per bar, on its own bar grid.
- `catalog.py [names | __none__]` cut the pieces from the full renders, pair each with a silent twin,
  write `Posts/Ready to post/` (catalog.json, CATALOG.txt, index.html, contact sheets).
- `offsets.py` where each clip sits in its full video, matched by sound (for the song-time lines).
- `youtube.py [names]` the YouTube cuts: each full video with the official song laid in, opening on
  the song's first note (or the first bar after he settles) and closing on the last bar before he
  stops, the song fading over two bars; in/out points in `youtube-cuts.json`, output `youtube/`.
- Every Reel and short opens on a whole second of its song (`catalog.py` `first_frame`), because the
  apps' sound pickers start a song on a whole second: post the silent file, start the sound there.
- `song_lock.py <full video> <song file>` where a full video sits in its song, by the arrangement over
  the whole video; the answer goes in `song-starts.json` (and how in `song-locks.json`), which
  `catalog.py __none__` turns into every piece's "Song: a to b" line. The official tracks come from
  `ytmp3 "<artist> <song>"` (his Mac, `~/.local/bin`: YouTube Music's song result, MP3 to ~/Downloads).
- `stage.py [--apply] [--notes]` each piece as an undated draft in the Social Studio (dry run by default).
