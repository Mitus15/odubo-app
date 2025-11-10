# Music Page & Album CMS Specification (2025-11-07)

## 1. Objectives
Deliver a production-grade music experience:
- Public browsing of albums/singles/EPs with filtering, search, and sorting.
- Rich album page (track list, credits, artwork, metadata, playback integration).
- Global unified audio player (mini bar + full-screen + album embedded player) with queue + HLS fallback.
- Admin CMS to create/manage albums, tracks, artwork, stems, ordering, publish/unpublish.
- Robust streaming layer: adaptive (HLS) when available, progressive AAC/MP3 fallback otherwise.
- Accessibility, performance, resiliency under degraded networks.
- Analytics hooks for playback and engagement.

## 2. Current State (Audit)
Existing pieces identified:
- `src/app/music/page.tsx`: Fetches albums (basic SELECT + aggregate). Static-ish revalidate 300s.
- `src/components/MusicLibrary.tsx`: Client library with filters (genre, type), search, list/grid/hero states, visual glass UI.
- `src/app/music/albums/[albumId]/page.tsx`: Detailed album view + `AlbumPlayer` (tracks with credits JSON aggregation).
- Player contexts/components: `MusicPlayerContext.tsx`, `FullScreenMusicPlayer.tsx`, `FullScreenPlayer.tsx`, `player/*` (SeekBar, QueueDrawer, MiniBar, TrackActions).
- Types: `src/types/music.ts` (Album, Track, TrackCredit, TrackGenre, form data interfaces).
- Streaming utilities: `lib/audioStreaming.ts` (test/load/play/retry, optimal quality, format support).
- Likes foundation: `lib/setupLikes.ts` (user likes tables for albums/tracks/videos) and `LikeButton`.
- Middleware references redirect logic for `/music` (temporary QR/featured logic).

Gaps:
- No admin CRUD for albums/tracks (needs `/admin/albums`, `/admin/albums/[id]`, `/admin/tracks/new`, etc.).
- Missing DB migrations for stems, HLS manifest URL fields, ordering (disc/track), publish flag.
- No artwork processing pipeline (resize, optimize, variant generation).
- No endpoint for streaming tracks (`/api/tracks/:id/stream` references assumed but not fully spec'd here).
- No analytics/logging events yet (play, complete, error, buffer).
- No playlist/favorites feature beyond likes foundation.
- HLS fallback logic partly present (test functions) but no manifest negotiation at play time.
- Queue persistence (localStorage) & resume not fully implemented.
- Admin auditing & error observability minimal.

## 3. Data Model (D1)
### Albums Table (existing + additions)
```
albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  release_type TEXT CHECK(release_type IN ('album','ep','single','compilation','mixtape')) NOT NULL,
  release_date TEXT, -- ISO
  record_label TEXT,
  genre TEXT,
  subgenre TEXT,
  cover_art_key TEXT, -- R2 key (store URL separately if needed)
  cover_art_url TEXT, -- CDN/public URL
  explicit_content INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  description TEXT,
  published INTEGER DEFAULT 0, -- NEW: admin publish gate
  sort_order INTEGER DEFAULT 0, -- NEW: manual ordering
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```
Indexes:
```
CREATE INDEX IF NOT EXISTS idx_albums_featured ON albums(featured);
CREATE INDEX IF NOT EXISTS idx_albums_published ON albums(published);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_name);
```

### Tracks Table (existing + additions)
```
tracks (
  id TEXT PRIMARY KEY,
  album_id TEXT REFERENCES albums(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  track_number INTEGER DEFAULT 1,
  disc_number INTEGER DEFAULT 1,
  duration INTEGER DEFAULT 0, -- seconds
  audio_key TEXT, -- original audio file R2 key
  audio_url TEXT, -- progressive URL
  hls_manifest_key TEXT, -- NEW: R2 key or constructed path
  hls_url TEXT, -- NEW: public HLS manifest URL
  waveform_url TEXT, -- optional precomputed waveform JSON
  preview_url TEXT, -- 30s preview clip (optional)
  audio_status TEXT CHECK(audio_status IN ('pending','ready','error')) DEFAULT 'pending',
  processing_status TEXT CHECK(processing_status IN ('pending','processing','complete','failed')) DEFAULT 'pending',
  isrc TEXT,
  explicit_content INTEGER DEFAULT 0,
  bpm INTEGER,
  key_signature TEXT,
  language TEXT,
  lyrics TEXT,
  published INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```
Indexes:
```
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_published ON tracks(published);
CREATE INDEX IF NOT EXISTS idx_tracks_audio_status ON tracks(audio_status);
```

### Track Credits (existing concept)
```
track_credits(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT REFERENCES tracks(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- e.g. Producer, Writer, Featured
  name TEXT NOT NULL,
  is_featured INTEGER DEFAULT 0
)
```
Index: `idx_track_credits_track_id`

### Track Genres (optional refinement)
```
track_genres(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT REFERENCES tracks(id) ON DELETE CASCADE,
  genre TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0
)
```
Index: `idx_track_genres_track_id`

### Playback Analytics (future)
```
playback_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT,
  album_id TEXT,
  event_type TEXT CHECK(event_type IN ('start','complete','error','buffer','seek')),
  client_ts INTEGER, -- epoch ms from client
  server_ts TEXT DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,
  error_code TEXT,
  user_id TEXT
)
```

## 4. Storage Layout (R2)
```
music/albums/{albumId}/cover/{originalFile}
music/albums/{albumId}/cover/{sizeVariant}-{w}x{h}.{ext}
music/tracks/{trackId}/original.{ext}
music/tracks/{trackId}/hls/manifest.m3u8
music/tracks/{trackId}/hls/segment_000.ts
music/tracks/{trackId}/preview.{ext}
music/tracks/{trackId}/stems/{stemType}.m4a  (vocal|drum|bass|other)
music/tracks/{trackId}/waveform.json
```

## 5. API Surface (Edge Runtime Preferred)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/music/albums` | GET | public | List published albums w/ aggregates |
| `/api/music/albums` | POST | admin | Create album |
| `/api/music/albums/:id` | GET | public | Album detail + tracks (published only) |
| `/api/music/albums/:id` | PATCH | admin | Update album metadata |
| `/api/music/albums/:id/publish` | POST | admin | Toggle publish flag |
| `/api/music/tracks` | POST | admin | Create track metadata (before upload) |
| `/api/music/tracks/:id` | GET | public | Track detail (if published) |
| `/api/music/tracks/:id/upload-url` | GET | admin | Presigned PUT for original audio |
| `/api/music/tracks/:id/process` | POST | admin/worker | Trigger transcoding → HLS + preview |
| `/api/tracks/:id/stream` | GET | public | Progressive or 302 redirect to HLS manifest selection |
| `/api/music/tracks/:id/publish` | POST | admin | Publish track |
| `/api/music/tracks/:id/credits` | POST | admin | Bulk upsert credits |
| `/api/music/tracks/:id/genres` | POST | admin | Bulk upsert genres |
| `/api/music/playback/event` | POST | public/auth | Log playback analytics (optional user_id) |

## 6. Audio Processing Pipeline
1. Upload original file (mp3/m4a/flac/wav).
2. Worker job or on-demand script:
   - Extract metadata (duration, bitrate, loudness, waveform sample).
   - Transcode variants: HLS 64k/128k/192k AAC; optionally maintain lossless original.
   - Generate 20–30s preview clip.
   - Store waveform JSON (downsampled 512 points).
   - Update `tracks.processing_status` and `audio_status`.
3. Validation step ensures manifest + segments accessible before marking ready.

## 7. Player Architecture
- Source selection: prefer `hls_url`; fallback `audio_url` if HLS unsupported (`canPlayAudioFormat` + user agent heuristics).
- Context drives: `state.queue`, `originalQueue`, `autoPlay`, `isLibraryShuffleMode`, `repeatMode` (add), `volume`, `currentTime`, `bufferedPct`.
- Actions to add: `SET_REPEAT_MODE`, `SET_VOLUME`, `TOGGLE_SHUFFLE`, `SEEK_TO`, `QUEUE_ADD`, `QUEUE_REMOVE`, `QUEUE_CLEAR`, `PLAY_NEXT`, `PLAY_PREV`.
- Persist subset of state (`currentTrackId`, `queueTrackIds`, `volume`, `lastPosition`) in localStorage for resume.

## 8. Admin CMS UI
Pages:
- `/admin/albums` (list + search + create button).
- `/admin/albums/new` (form: core metadata + cover upload + explicit flag + featured/published toggles).
- `/admin/albums/:id` (edit album, track list with drag-sort, add track modal, bulk publish, stems status per track).
- `/admin/tracks/:id` (edit track metadata, manage credits/genres, upload stems, show processing status & logs).
Components:
- Reusable form with Zod validation (`albumSchema` / `trackSchema` alignment).
- Artwork upload dropzone + client resize preview.
- Track ordering drag-and-drop (updates `track_number` & optional `disc_number`).
- Credit editor (role autocomplete + featured toggle).

## 9. Performance Strategy
- Code splitting: dynamic import player modals (`FullScreenMusicPlayer`, stem mixer, credits editor).
- Image `next/image` with appropriate `sizes` responsive hints (already present hero & grid examples).
- Prefetch next track’s manifest while current track is at ≥70% duration.
- Virtualized long album track lists if > 50 tracks (future).
- Server-side aggregated album queries (avoid N+1 on likes/credits using joined JSON). Consider caching layer.

## 10. Accessibility
- Focus management when opening full-screen player or album modal.
- Keyboard shortcuts: Space (play/pause), ArrowLeft/Right (seek 5s), ArrowUp/Down (volume), `F` (toggle full screen), `Q` (open queue), `M` (mute).
- ARIA roles: `role="slider"` for seek/volume; `aria-label` on play controls; announce track changes.
- High contrast fallback and reduced motion preference (disable complex animations if `prefers-reduced-motion`).

## 11. Analytics & Observability
Events:
- `start`: user began playback.
- `complete`: reached >= 95% of duration.
- `buffer`: waiting event with timestamp & buffered percentage.
- `error`: includes error code / message.
- `seek`: from → to time.
Transport: POST batched or individual to `/api/music/playback/event`; optional debounce for buffer events.
Future: aggregate daily play counts; trending logic for featured highlight.

## 12. Security & Rate Limiting
- Admin endpoints require auth scope (session middleware). Add per-IP + per-user RL for upload/process actions.
- Signed URLs expire quickly (60s) + enforce content-type.
- Validate file extension + MIME mapping (reuse logic from `worker/upload.ts`).
- Avoid over-processing by idempotent job checks (`processing_status`).

## 13. Backlog / Phased Delivery
Phase 1 (MVP): Migrations (albums/tracks fields), list & album page refinements, admin album CRUD, track upload + basic transcoding, global player enhancements, publish flags.
Phase 2: Stems handling, waveform, preview clips, queue persistence, credits/genres editors, playback analytics.
Phase 3: Playlists/favorites expansion, advanced HLS quality selection, crossfade, lyric sync.

## 14. Open Questions
- Do we require multi-disc support beyond numeric field? (UI grouping?).
- Policy for lossless originals retention vs storage cost.
- Album pre-save cover art processing (client-side canvas vs worker).
- Privacy / authentication for unreleased (unpublished) albums—preview links for stakeholders?

## 15. Acceptance Criteria (MVP)
- Visiting `/music` shows at least one published album grid with responsive layout.
- Album page displays tracks sorted by `track_number` and plays via global player.
- Uploading a track through admin yields progressive playback within < 2 min (transcoding pipeline success path).
- Player auto-fallback to progressive when HLS not ready or unsupported.
- LocalStorage resume: re-open site, last track + position restored (if > 30s into track previously).
- All player controls keyboard accessible and screen reader announces track changes.

## 16. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Transcoding delay stalls availability | Show processing badge + progressive temp fallback if original playable |
| Large cover art impacting LCP | Pre-size & compress variants; lazy load secondary images |
| HLS segment 404 | Health check after job, retry manifest build, fallback progressive |
| Mobile autoplay blocked | First interaction enabling audio (already in context logic) |
| Over-fetch credits | JSON aggregation + parse approach retained |

## 17. Next Actions
1. Create migrations for added columns (published flags, hls fields, sort_order).
2. Scaffold admin album list & create form.
3. Endpoint: POST `/api/music/albums` + validation.
4. Track upload flow (presigned URL + processing job trigger).
5. Player context action expansion (repeat/shuffle/queue persistence).
6. LocalStorage persistence layer.

---
Generated 2025-11-07 by AI assistant; iterate as implementation evolves.
