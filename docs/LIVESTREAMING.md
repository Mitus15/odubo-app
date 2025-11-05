# Livestreaming with Cloudflare Stream (Live Inputs)

This app supports livestreaming via Cloudflare Stream Live Inputs, with automatic recording to VOD.

## Prerequisites

- Cloudflare account with Stream enabled
- Environment variables set in Pages/Functions:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_STREAM_API_TOKEN` (or `CLOUDFLARE_API_TOKEN`) with Stream write scope
  - `NEXT_PUBLIC_SITE_URL` (e.g., https://odubo.studio)

## Create or ensure a Live Input

- Admin → Live (`/admin/live`)
  - Click "Ensure Live Input" (creates a default input named `odubo-live` with recording mode `automatic`)
  - Copy the RTMPS URL and Stream Key
  - Verify playback preview loads

Under the hood, `/api/stream/live-input` ensures the default input and returns:
- RTMPS and WHIP ingest details
- Playback UID (same as live input UID), plus HLS and iframe URLs

## Stream from OBS/Streamlabs

- In OBS/Streamlabs, set the streaming service to Custom/RTMPS
- RTMPS URL: paste from Admin → Live
- Stream Key: paste from Admin → Live
- Start streaming
- The public `/live` page will play the stream via Cloudflare’s iframe

## Recording to VOD

- Recording mode is set to `automatic` when creating the Live Input
- When the stream ends, Cloudflare Stream will finalize the recording as a VOD asset
- Import options:
  1. Manual: In Admin → Videos, create a new video with `url = https://iframe.videodelivery.net/<UID>` and optional poster from `https://videodelivery.net/<UID>/thumbnails/thumbnail.jpg`
  2. Webhook (recommended): Configure a Stream webhook for `video.ready` events → `/api/webhooks/stream` (to implement). The webhook can auto-insert new VOD entries into D1.

## Optional enhancements

- Display a "Live now" badge on the site when the Live Input status is active
- Auto-import new recordings via webhook (see above)
- Add an "Import by Stream UID" button in Admin → Videos for manual rescue
- Add basic metrics (viewers, uptime) using Stream analytics endpoints

## Troubleshooting

- If Admin → Live shows an error creating the input: verify `CLOUDFLARE_ACCOUNT_ID` and token scopes
- If the player does not appear on `/live`: ensure the Live Input exists and OBS is streaming to the provided RTMPS/Key
- If the VOD doesn’t show up: use the manual import method, or implement the webhook
