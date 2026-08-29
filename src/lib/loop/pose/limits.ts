/**
 * Capture limits for the Pose Studio — one place for every number that
 * governs a take, because the same constants drive the recorder, the
 * viewfinder chrome and the front-door copy, and they drifted apart the last
 * time they lived in three files.
 */

/**
 * How long a clip may run, in seconds.
 *
 * Clip length is a function of BOTH who is shooting and whether the live
 * filter is running — not of one or the other.
 *
 * `guest` — 15s regardless. A moment, not a film, and short takes keep a
 * mid-range phone comfortable on the night.
 *
 * `studioFiltered` — still short. MediaPipe segmentation plus the vector
 * redraw is per-frame CPU that no phone holds for minutes at full height: it
 * thermal-throttles and the frame rate falls out of the middle of the take.
 *
 * `studioRaw` — the long take. There is no per-frame work at all here: the
 * recorder taps the camera track directly at native resolution and the house
 * look is applied later, offline, by `scripts/loop/video-convert.mjs` — which
 * wants the original unfiltered plate anyway (docs/decisions/loop-video-converter.md).
 */
export const CLIP_LIMITS = { guest: 15, studioFiltered: 60, studioRaw: 300 } as const;

export function clipLimitS(studio: boolean, filterOn: boolean): number {
  if (!studio) return CLIP_LIMITS.guest;
  return filterOn ? CLIP_LIMITS.studioFiltered : CLIP_LIMITS.studioRaw;
}

/**
 * True when the recorder taps the camera track directly instead of the engine
 * canvas — the long raw take. Photo never qualifies: the shutter already reads
 * the <video> element at full sensor resolution.
 */
export function isLongTake(
  studio: boolean,
  mode: "photo" | "video",
  filterOn: boolean,
): boolean {
  return studio && mode === "video" && !filterOn;
}

/** Engine canvas render cap (px of height). Irrelevant to the long take,
 *  which bypasses the canvas entirely. */
export const RENDER_MAX_HEIGHT = { guest: 720, studio: 1920 } as const;

/**
 * What to ASK the camera for, as a long edge in px.
 *
 * Without this getUserMedia hands back the UA default — 640x480 on both iOS
 * Safari and Chrome — so a render cap of 1920 has nothing to cap and studio
 * mode silently produces SD. Guests are deliberately not pushed to 1920: they
 * would only downscale it to a 720 canvas, wasting decode bandwidth.
 */
export const CAPTURE_LONG_EDGE = { guest: 1280, studio: 1920 } as const;

/** The reference plate is 30fps and the offline converter renders at ~12fps,
 *  so 60 would double the file and the render time for nothing. */
export const CAPTURE_FPS = 30;

/**
 * Encoder bitrate. The converter analyses at REDUCED resolution specifically
 * because that is where noise and compression mush average away, so source
 * bitrate above ~8 Mbps buys the house look nothing — while 5 min at 8 Mbps is
 * already ~300 MB, the practical ceiling for a phone blob plus a download.
 *
 * Filtered output is flat vector fields and compresses far below 6 Mbps anyway.
 *
 * Note: iOS Safari IGNORES videoBitsPerSecond and picks its own rate.
 */
export const REC_BPS = { filtered: 6_000_000, raw: 8_000_000 } as const;
export const AUDIO_BPS = 128_000;

/**
 * Above this a clip is download-only and never enters the on-device gallery.
 *
 * `WallGallery.loadMine()` reads EVERY stored blob at once (gallery.ts's
 * getAll) and object-URLs them on every visit to /loop/pose, so one 300 MB
 * take would wedge that page — and a studio plate is headed for
 * scripts/loop/video-convert.mjs, not the phone's grid.
 */
export const GALLERY_MAX_BYTES = 40 * 1024 * 1024;

/** Mirrors MAX_BYTES in src/app/api/loop/gallery/post/route.ts. Checked on the
 *  client so a long take is never offered a Wall button it would 413 on. */
export const WALL_MAX_BYTES = 30 * 1024 * 1024;

/** mm:ss for the recording timer. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
