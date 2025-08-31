# Stem Feature Sprint — Progress & Goal (2025-08-30)

Purpose: capture current progress, what was delivered this session, and the next work items to continue implementing stem splitting and stem playback (vocals/drums/bass/other).

## Sprint goal
- Implement end-to-end support for stem playback in the web app: database support, admin API for status, UI for a Stem Mixer, and a light client implementation that keeps stems in sync with the main player. Leave a clear next-work list for the worker/ops pieces.

## Summary of progress (what's done)
- Database migration added: `database/migrations/007_add_stem_fields_to_tracks.sql`
  - Adds `vocal_stem_url`, `drum_stem_url`, `bass_stem_url`, `other_stem_url`, and `processing_status` to `tracks`.
- Type updates: `src/types/music.ts`
  - `Track` now includes optional stem URL fields and `processing_status` union.
- API: added admin PATCH endpoint to update processing status
  - `src/app/api/tracks/[id]/status/route.ts`
- Frontend UI and client behavior:
  - New `StemPlayer` component that loads four hidden `audio` elements, provides per-stem volume sliders, and syncs play/pause/seek with the global `MusicPlayerContext`.
    - `src/components/StemPlayer.tsx`
  - Integrated a Stem Mixer button into the full-screen player and lazy-loaded the stem UI to keep bundle size small.
    - `src/components/FullScreenMusicPlayer.tsx` (edited)

## Files created/edited (one-line purpose)
- `database/migrations/007_add_stem_fields_to_tracks.sql` — migration to add stem metadata fields
- `src/types/music.ts` — `Track` type extended with stem fields and processing_status
- `src/app/api/tracks/[id]/status/route.ts` — admin-only route to update `processing_status`
- `src/components/StemPlayer.tsx` — new UI + hidden audio elements for stem mixing
- `src/components/FullScreenMusicPlayer.tsx` — Stem Mixer button/modal integration (lazy loaded)

## Requirements checklist (mapped to status)
- Add stem fields to DB (migration) — Done
- Update `Track` type to include stems — Done
- Admin upload flow sets `processing_status` to `pending` and shows progress — Partially done (status API and types present; admin upload needs small UI hook to set `pending` at upload time)
- Background worker (Spleeter + upload to R2) — Deferred (not implemented in this sprint)
- R2 uploads for stems, MIME and cache headers — Deferred (worker responsibility)
- Stem playback UI + sync with main player — Done (basic, HTMLAudio-based)
- Production-grade sync (Web Audio API) — Deferred (optional improvement)
- Security: signed URLs / access controls for stems — Deferred (ops)

## Quality gates / verification done
- Type updates applied to `src/types/music.ts` (no type errors flagged for changed files)
- New components added and `FullScreenMusicPlayer` updated; quick static checks passed for changed files

## Next tasks (priority ordered)
1. Worker: implement `stem_splitter_worker.py` using Spleeter and ffmpeg to:
   - Download master track from R2; run Spleeter (4 stems); transcode stems to a web-friendly codec (AAC/Opus) and upload to R2 under `stems/{track_id}/`.
   - Update DB `tracks` row with stem URLs and set `processing_status` to `complete` or `failed` on error.
   - Suggested runtime: dedicated VM/container (not serverless) due to long-running jobs.
2. Admin panel: set `processing_status = 'pending'` immediately after a successful file upload (in `src/components/TracksClient.tsx` upload handler) and add a small status indicator.
3. Ops: confirm R2 CORS and bucket policy for stem files; consider signed URL flow if stems must be private.
4. Improve client sync: evaluate moving from separate `HTMLAudioElement`s to Web Audio API AudioBufferSources for sample-accurate sync (important on low-end devices).
5. Post-processing: reduce stem file sizes (AAC/Opus), add cache headers; consider HLS for stems if you want adaptive bitrate stems.
6. Testing: add unit tests for the status API, and E2E test for the admin upload -> worker -> playback flow (can be integration tests that mock R2).

## Short how-to (apply migration, test locally)
1. Apply the SQL migration to your database (example using Wrangler D1 if you use Cloudflare D1):

```bash
# Example (your command may vary). This runs the D1 migration set on the remote database named `odubo`.
npx wrangler d1 migrations apply odubo --remote
```

2. Manually set stem URLs on a track row to test the UI quickly (SQL):

```sql
UPDATE tracks
SET vocal_stem_url = 'https://<r2-host>/stems/<track_id>/vocals.aac',
    drum_stem_url = 'https://<r2-host>/stems/<track_id>/drums.aac',
    bass_stem_url = 'https://<r2-host>/stems/<track_id>/bass.aac',
    other_stem_url = 'https://<r2-host>/stems/<track_id>/other.aac',
    processing_status = 'complete'
WHERE id = '<track_id>';
```

3. Start the app locally and open a track in the full-screen player — you should see the "Stem Mixer" button if all four stem URLs exist. Open it to see per-stem sliders and basic sync controls.

## Risks & Notes
- Using multiple hidden `audio` elements is simple but can drift; Web Audio API is more robust but requires significant refactor.
- Stems (WAV) are large — add a required post-processing step to transcode to AAC/Opus before uploading to R2.
- Long-running Spleeter jobs should run on a dedicated worker; do not attempt to run in Edge/short-lived serverless functions.

## Work items I can take next (pick one)
- Implement the Python worker (`stem_splitter_worker.py`) with `requirements.txt` and sample config for R2 & DB.
- Implement admin-side upload changes to set `processing_status = 'pending'` automatically after upload and add a status indicator.
- Implement Web Audio API-based stem playback for tighter sync.

If you want, tell me which next item to pick and I'll implement it and add tests and a README for the worker.
