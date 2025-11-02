# Dev audio CORS for HLS (hls.js)

When developing over LAN (e.g. http://192.168.x.x:3000), the audio playlists and segments served from media.odubo.studio are cross-origin. hls.js uses XHR to fetch these, so CORS must be enabled on the media origin for the dev origin(s).

Minimum headers on media.odubo.studio (Cloudflare/R2/CDN):

- Access-Control-Allow-Origin: http://192.168.1.68:3000
- Access-Control-Allow-Methods: GET, HEAD, OPTIONS
- Access-Control-Allow-Headers: Range, Origin, Access-Control-Request-Method, Access-Control-Request-Headers
- Access-Control-Expose-Headers: Accept-Ranges, Content-Range, Content-Length, Content-Type

Recommended content types:
- .m3u8: application/vnd.apple.mpegurl (or application/x-mpegURL)
- .ts: video/mp2t
- .m4a/.mp4: audio/mp4 or video/mp4 (as appropriate)

Notes:
- In production, if the app and media share the same origin, no special CORS configuration is required.
- The player will fall back to progressive streaming via `/api/tracks/:id/stream` when CORS is not available, but you lose adaptive bitrate.
