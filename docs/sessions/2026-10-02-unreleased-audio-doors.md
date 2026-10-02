# 2026-10-02 · The unreleased record, at every door

Branch `claude/mystifying-cannon-149bb7`, stacked on `claude/clever-pare-7d5cfb`
(the read sweep, `2026-10-02-read-routes.md`, "Open, for the owner", item 1).
Not merged: main waits on the owner.

## What was open

- **The media proxy's key gaps.** `src/lib/loop/audioAccess.ts` knew a key
  only when it equalled a track's `audio_url`. Two kinds of key belong to a
  track and were presigned for anyone: its HLS files (`<song>.hls/…`, beside
  `<song>.web.m4a`, or beside a master, which `transcode_audio_to_hls.ts` also
  accepts), and the key of a track whose `audio_url` still names
  `media.odubo.studio`. The stream route rewrites that host to the proxy, so
  the bytes were one request away.
- **The detail routes.** `GET /api/tracks/[id]` and `GET /api/albums/[id]`
  handed anyone an unreleased track's `audio_url`, `hls_url` and stem URLs,
  which `GET /api/tracks` withholds. Loop Soul's album id is a constant in the
  source.
- **Found on the way: a public cache in front of the gate.** `next.config.ts`
  gave every `/api/media/**` response `public, s-maxage=60,
  stale-while-revalidate=300`, which replaced the route's own header (seen on
  `next dev`: the presigned redirect's `private, max-age=900` never reached
  the client). A CDN that kept an admin's or a pass-holder's redirect could
  hand it to the next stranger asking for the same key, for up to six
  minutes. The same rule covered `GET /api/media/all`, the editors' list of
  every video, hidden ones included.

## Live D1, read only

One album, Loop Soul, `draft`, 14 tracks. Every `audio_url` is
`/api/media/audio/warehouse/…`; none is `.web.`, so `hls_url` is null for all
of them. No previews, stems or `audio_id` anywhere. No single has a release
date (`loop_settings.singles` unset), `featured_track` is unset, so 1984 is the
public one, and `album_released` is 0.

So neither key gap was reachable with today's rows. The detail routes were:
`/api/albums/<loop soul>` gave anyone all 14 URLs.

## Fixed

Commits `012532b` (the gate), `e79b2b2` (the cache) and `f46e7da` (a track
on another host).

- `src/lib/release/audioSource.ts`, pure:
  - `mediaKeyOfAudioUrl`: the R2 key in every form `audio_url` takes (the
    proxy path, also with an origin in front; the dead host; the bare key).
    For a URL on any other host it gives the path, because both transcode
    scripts strip the host and write that track's renditions there in our
    bucket. It shares `keyOnDeadHost` with `resolveAudioSource`, so the gate
    and the stream route cannot disagree about which key a URL names.
  - `hlsDirOfKey`, `mediaKeyBelongsTo`: a key is a track's if it is the file,
    or sits under the `.hls/` directory the script writes beside it. Exact and
    case-sensitive: `song.hls/` is not `song-remix`'s.
  - `withoutAudio`: the one list of what an unheard track is served without
    (`audio_url`, `preview_url`, `hls_url`, every `*_stem_url`), as null,
    which is how the players already read "not playable".
- `src/lib/loop/audioAccess.ts`:
  - The key lookup narrows with `instr(audio_url, ?)` and decides with
    `mediaKeyBelongsTo`. A key gets the verdict of every track it belongs to;
    a recording two releases share is as open as the more open of them.
  - `gatherFacts` takes the tracks of one album and asks about the caller
    once (admin, singles, owed, the draw). `audibleTrackIds(req, albumId)`
    decides a whole album for what one track costs. Per track, the verdict is
    the old one; it still fails closed.
- `GET /api/tracks/[id]` and `GET /api/albums/[id]` withhold those fields
  unless the caller may hear the track: the admin (cookie or bearer, or the
  Loop admin session), a pass-holder's draw, every track after release, the
  public single. When the album is not published the answer depends on who
  asks, so it is `private, no-store`; a published album keeps its public
  cache. `GET /api/tracks` uses `withoutAudio` too, which adds the stems.
- The three routes moved from `KNOWN_OPEN` to `PUBLIC_READS`.
- `next.config.ts`: the `/api/media/:path*` rule is gone, with a comment
  saying why. Each route's own header stands: the redirect is private, a
  cover is public and immutable, a 404 carries none. The service workers
  never read it.

Callers checked. The player loads a track through `fetchTrackStreamInfo`
(`/api/tracks/[id]`) and a HEAD on the stream route, both per caller, so an
entitled listener gets both. `QueueDrawer`, `AlbumPlayer`, `StemPlayer`,
`FullScreenMusicPlayer` and the player's choice of next track read a missing
`audio_url` or stem as not playable. `AlbumDetailView`'s Play all starts at
track 1 whatever it carries, so a stranger gets the stream route's "not
accessible", as before. The admin screens only write to these routes. The
stream route forwards the listener's cookies, so the proxy reaches the same
verdict on the inner hop, now for dead-host keys too.

## Checked

- `npx tsc --noEmit`, no `.next`: 850 before, 850 after, the same error list
  with positions stripped.
- `npm test`: 673 pass (630 + 43 new), the 2 known failures unchanged
  (`brandedEmailHTML`, the `GET /api/videos` fallback).
- Against the code as it was, 28 of the 43 fail: the 15 key rules, 12 route
  tests and the cache tripwire. Of the 15 that pass either way, 14 check what
  must keep working (the admin on a cookie or a bearer token, the public
  single, a released pass-holder, the published catalogue, keys that are no
  track or only look like one) and one checks the tripwire's own matcher.
- `src/__tests__/loopAudioDoors.test.ts` runs the routes' own SQL on
  node:sqlite with a real signed admin token; only the Loop facts are stubbed.
- On `next dev`, against live D1, as a stranger: Ghost World's track has no
  `audio_url`; 1984 keeps its; the album lists 14 tracks with 1984 the only
  playable one, `private, no-store`. On the proxy, Ghost World's file, HLS
  master and a segment are 404; 1984's file and HLS still redirect, now
  `private, max-age=900`; the cover is `public, max-age=31536000, immutable`.
- ESLint: no touched file worse; `tracks/[id]/route.ts` 4 to 1 (the three
  `any`s in the GET it rewrote).
- An independent review of the diff found nothing at its confidence bar. Its
  one coverage note, the album route's admin on a bearer token, is a test now.

## Merging

- **`claude/album-performance-social-plan-4084d5` (Vol. 1 and Vol. 2)
  conflicts in `audioAccess.ts`, and git also auto-merges one line that
  breaks silently.** Its `const albumId = track.album_id ?? ALBUM_ID;` lands
  in the batched `gatherFacts`, where there is no `track`. That throws inside
  the `try`, the gate fails closed, and pass-holders lose their draw without
  an error; `next build` will not notice (`ignoreBuildErrors`). Resolve as:

  ```ts
      const albumId = tracks[0].album_id ?? ALBUM_ID;
      const access = await albumAccessFor(event.id, voterId, albumId);
      const owed = access.entitled || access.holder;
      // (its comment, "pull the whole album … off for Vol. 2")
      let earlySet: number[] = [];
      if (owed && access.early.enabled) {
        const { loadAlbum } = await import("@/lib/loop/album");
        const data = await loadAlbum(albumId);
        if (data) earlySet = earlySetFor(access.email ?? voterId, data.tracks, featured, access.early);
      }
      return tracks.map(/* this branch's, unchanged */);
  ```

  Tried on a scratch tree: `tsc` 850, and the loop, audio and guard suites
  pass (85). Leaving `track.album_id` in fails the two pass-holder tests in
  `loopAudioDoors.test.ts`.
- `claude/mystifying-hugle-0cde7d`: only the three `videos/*` conflicts the
  base already has with it. `audioAccess.ts` merges clean (its
  `isAdminRequest` move was left untouched).
- `claude/stem-player-live-c8f826`: only the base's own conflicts
  (`.claude/launch.json`, `AlbumPlayer.tsx`, `FieldPlayer.tsx`). It pipes field
  files as `public, max-age=31536000, immutable` (`pack.json`: `public,
  max-age=300`). A pack of an unreleased single is admin-only, so that
  response should be `private` until the single is out.
- `claude/epic-joliot-d0eb9b` (`tracks/route.ts`, in POST) and
  `claude/beautiful-curran-ad6154`: the base's conflicts, none from here.
- Clean: `claude/gifted-matsumoto-a1f193`, `claude/arsenal-sync-fail-closed`,
  `claude/infallible-morse-0d84ed`, `claude/epic-faraday-f0a742`, `main`.

## Still open

- **The album page still prints every URL.** `/music/albums/[albumId]`
  server-renders `SELECT t.*` into `AlbumPlayer`, so the draft's 14
  `audio_url`s sit in the page for anyone, and strangers see 13 tracks as
  playable that then 404. The bytes are gated in every form now, so this is
  the door's address, not the door. Fix: `audibleTrackIds` plus
  `withoutAudio` in `getAlbumData`; a server component needs a cookie-based
  check for the Odubo `token` (`isAdminRequest(null)` reads only the Loop
  admin cookie).
- Matching is literal. A stored URL with percent-escapes would not equal the
  decoded key the proxy is handed. Every writer sanitises keys to
  `[A-Za-z0-9._-]`, and no live row has a `%`.
- HLS through the proxy cannot play past the master playlist: the proxy
  answers with a redirect to a presigned R2 URL, and the playlist's relative
  URIs resolve against it, unsigned. Moot while no track is `.web.`.
- Public tracks' redirects are no longer shared-cached, so each play reaches
  the function. A route-level `public, s-maxage` for keys everyone may hear
  (a published album, the public single, keys that are no track) would win
  it back; `mayHearMediaKey` would need to say "public" apart from
  "allowed for you".
- `QueueDrawer`'s Browse tab reads `/api/albums` as a bare array and
  `/api/albums/[id]` as `data.tracks`; both are wrapped, so it never shows a
  track. Older than this work.
