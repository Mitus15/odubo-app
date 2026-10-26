# 2026-10-02 · Adding a track from the album screens uploads it

"Upload N Tracks" in AlbumModal failed every time. The modal sent one
multipart form to `POST /api/tracks`, which reads JSON, so the route answered
500 "Failed to create track". It also read `trackId` from a route that answers
`id`, and sent its credits in a field the route never read. The route has read
only JSON in every version in git, so no track has ever been added this way.
Fixed on branch `claude/epic-joliot-d0eb9b`, **not merged, not deployed**.

## Where the modal is (checked in code)

- `/admin`, Content → Music (`TabContent` → `MusicTab` → `AlbumsClient` →
  `AlbumActions`): "View & Add Tracks" on every album.
- `/admin/albums`: the same `AlbumsClient`, reached by URL only (its old nav,
  `AdminNavigation`, is mounted nowhere).
- `/admin/albums/edit/[id]` (`AlbumEditClient`, from "Edit Album"): "Edit
  Tracks", and also the "Edit Cover" overlay, which opens the same modal.

## Live, not replaced by Release Control

- Release Control creates tracks (reconcile: title only) and gives them audio
  (ship) only for an album linked to a warehouse project. Its list page cannot
  create a project, so today that means Loop Soul alone.
- For any other album the modal is the only screen that adds a track with
  audio to an existing album. `/admin/tracks` (`TracksClient`) would too, and
  has the same multipart bug, but nothing links to it.

## What changed

- `2f7e080` The modal hands each file to `uploadAlbumTrack`
  (`src/lib/uploads/albumTrackUpload.ts`), which follows the contract
  `AlbumCreationWizard` uses: the audio goes to `/api/upload` first, then the
  track is created from JSON pointing at it, then the credits are filed under
  the `id` the route answers with, through `PUT /api/tracks/[id]/credits` (the
  route "Edit Credits" already uses). The route's `id` change is 8610ea7's,
  byte for byte.
- `audio_url` is stored as `/api/media/audio/<key>`, not the bucket URL
  `/api/upload` returns. The media proxy holds an unreleased album's audio
  back only when `trackByMediaKey` recognises the key as a track's, and it
  matches only this form (or the bare key).
- A missing title or track number is refused before the audio is sent, so
  nothing is left in storage. A track saved without its credits is reported,
  not failed, so a retry cannot make it twice. The alert names what failed and
  why instead of "check the console".
- `17f66b7` `POST /api/tracks` stores `explicit_content`, which the modal and
  the wizard both send and the album player shows as a badge. The column is
  in the first `tracks` definition (`database/schema.sql`, `database/odubo.db`).

## Verification

- `npx tsc --noEmit` with no `.next`: 850 errors before and after,
  identical with line numbers stripped.
- `npm test`: 397 passed (387 + 10 new), the 2 known failures unchanged
  (`brandedEmailHTML`, `GET /api/videos` fallback).
- `albumTrackUpload.test.ts` runs the flow through the real `/api/upload`
  (R2 write stubbed), `POST /api/tracks` and the credits route over
  node:sqlite. Checked by breaking it on purpose: it fails on the old multipart
  contract, on the route as it is on main, and when the bucket URL is stored.
  `albumModalUpload.test.tsx` fails on the old modal.
- Not done: a real upload to R2, or anything against production.

## Merging with `claude/unruffled-goldstine-331edc`

`2f7e080` merges with it cleanly. `17f66b7` stops on the INSERT in
`src/app/api/tracks/route.ts`: keep this side (that branch's change plus the
column). Then add `explicit_content BOOLEAN DEFAULT FALSE` to the `tracks`
table in its `d1WriteResults.test.ts`, or its `POST /api/tracks` test fails
"table tracks has no column named explicit_content". Done on a trial merge
with its tip `d15b5e4`: the full suite passes (538) but for the 2 known
failures, `routeWriteAuth.test.ts` included.

## Open

1. **4.5 MB.** `/api/upload` takes the file through a Vercel function, and
   Vercel refuses a request body over 4.5 MB (413; see
   `docs/systems/arsenal-upload.md`, where Arsenal hit the same wall). A WAV,
   or a few minutes of 320 kbps MP3, is over it, so in production only small
   files get through, from the modal and from the wizard. Release Control
   uploads straight to R2 and has no ceiling. Moving these uploads to a
   presigned R2 URL is the fix if the Music tab is to take real files.
2. **Release Control overlap.** On an album with a release project (Loop
   Soul), a track added from the modal gets no delivery-sheet row and no
   warehouse piece. Whether the Music tab should send those albums to Release
   instead is the owner's call.
3. **`/api/upload` has no login check on main**, and its track keys are
   predictable, so anyone can overwrite a song's audio. `8f01cf7` on
   `claude/unruffled-goldstine-331edc` gates it with `requireAdmin`; until that
   merges, the hole is live.
4. **The wizard** stores the bucket URL, which the media proxy does not know as
   a track's, so a wizard-made track on an unreleased album is served to anyone
   who asks the proxy for its (predictable) key. It also ignores upload
   failures and the `/api/tracks` answer, and drops its free-text credits.
   `uploadAlbumTrack` is there for it once this branch is merged.
5. Duration still defaults to 180 s per file in the modal. Release Control
   reads the real length from the file.
