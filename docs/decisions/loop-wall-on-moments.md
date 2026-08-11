# The Wall — Loop Soul's guest gallery on the moments core (PR 2)

**Date:** 2026-08-10 · **Status:** implemented on `claude/loop-soul-mobile-app-54086c`

This is the integration PR sketched at the end of the merge plan: Loop Soul's
State-2 ("The Portal") and State-3 ("Legacy") gallery, built **on moments**
rather than green-field. Target: usable on phones at a 75-person test event.

## What it is

- **The Wall** — the shared, near-live photo/clip gallery of the event night.
  Guests post from the Portal (Pose Studio shots, saved clips, or camera-roll
  uploads). Everyone in the room watches it fill up.
- **Iconic Moments** — admin-curated (featured) shots, surfaced in Legacy.
- **Moderation** — approve / hide / feature / delete from `/loop/admin`, on a phone.

## Architecture

**Storage & data live in moments; gating & UI live in Loop.**

| Layer | Choice |
|---|---|
| Data | One `galleries` row per volume (code `LOOPVOL1`, derived from the event id). Photos are ordinary `gallery_photos` rows. |
| Files | R2 via `StorageService` (`src/lib/storage/StorageService.ts`) + `pathGenerators.gallery.*` — the moments primitives, imported by Loop. |
| API | Loop-realm routes `/api/loop/gallery/*` and `/api/loop/admin/gallery/*`. They enforce Loop's gate (`ls_voter` + `isHolder`, phase, `ls_admin` via middleware) and then read/write moments' tables directly with Loop's D1 client. |
| Integrity rule | Loop imports from moments; **no moments file knows Loop Soul exists**. The one moments-side change (visibility filter on `/api/moments/galleries/public`) is generic: it respects `config.visibility === "private"` for ANY gallery. |

### Why not call `/api/moments/*` from the Loop client?

Auth realms differ. Moments routes gate on odubo's JWT admin; Loop guests are an
`ls_voter` cookie + event-code holder, and the Loop admin is the `ls_admin`
cookie. Reusing the moments *routes* would mean either weakening their gates or
teaching them about Loop Soul — both violations. Reusing the moments *tables and
storage primitives* behind Loop's own thin routes keeps one storage core and one
gate per surface.

### Why a single atomic upload endpoint (no presigned PUT)?

The moments presigned-PUT flow has three live failure modes we cannot afford in
a room of 75 phones: Content-Type mismatch between presign and PUT, R2 CORS
depending on the current origin (domain is in flux), and the orphaned-object gap
between PUT and `/record`. `POST /api/loop/gallery/post` takes multipart
(file ≤ 30 MB), gates, uploads via `StorageService.uploadToR2`, and inserts the
row — one request, no partial states. Photos are canvas-downscaled client-side
(max 2048px JPEG) so uploads are ~300 KB–1 MB on venue Wi-Fi; this also
normalizes HEIC away.

### Migration 145 (`145_gallery_curation.sql`)

`gallery_photos` gains `moderated_at TEXT`, `moderated_by TEXT`, and
`featured INTEGER NOT NULL DEFAULT 0` + index. All three are generic moments
features: the first two are columns `/api/moments/moderate` already writes but
migration 018 never created (a live bug this fixes); `featured` is curation any
gallery can use. **144 is skipped on purpose** — the open Journal PR (#4) owns
it and it is already applied to remote D1.

## Gating

- **Read** (`GET /api/loop/gallery/list`): public. Hides `moderated = 2`.
  Powers the Portal wall, the Legacy vault, and Iconic Moments (`?featured=1`).
- **Post** (`POST /api/loop/gallery/post`): phase must be `live`, and the voter
  must be a holder (redeemed event code) — the same gate as the Portal itself.
  The Loop admin (`ls_admin`) may post in any phase. Rate-limited per voter.
- **Moderate** (`/api/loop/admin/gallery/*`): behind `ls_admin` automatically
  (middleware gates all `/api/loop/admin/*`).

## Event codes admin

The test event needs 75 codes in hand, and the lib (`generate`, `listCodes`,
`countRedeemed`) existed with no UI. `/loop/admin` gains an Event Codes section
(generate N, list with redeemed state, copy-all) backed by
`/api/loop/admin/codes`. This closes the "Event codes — generate & issue"
backlog line alongside "Photo moderation & Iconic Moments curation".

## Alternatives considered

- **Presigned PUT + record (moments' own flow)** — rejected for event-night
  reliability (see above); can be layered back later for big video files.
- **Reusing moments' moderation UI** — wrong auth realm, desktop-oriented, and
  the owner runs the night from `/loop/admin` on a phone.
- **A Loop-owned media table** — would fork storage from moments and forfeit the
  whole point of PR 2 (galleries, retention, future moments features accrue to
  Loop for free).

## Deferred

- Presigned direct-to-R2 uploads for long clips.
- Video poster thumbnails (ffmpeg worker exists but is Node-runtime-bound; wall
  tiles render `<video preload="metadata">` instead).
- Per-voter attribution column on `gallery_photos` (guests may type a display
  name; moderation is the abuse control).
- Journal "Iconic Moments" hookup — once PR #4 merges, `journal_moments` can
  read the featured set from the same gallery.
