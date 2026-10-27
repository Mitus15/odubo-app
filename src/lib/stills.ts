/**
 * A site copy's still, in the room's true colour.
 *
 * Stream makes its thumbnails with the SD colour formula (BT.601) from a copy
 * tagged HD (BT.709), so the still came out darker than the room and the video
 * it stands in for: Billie Jean's field #ea85a3 in the still, #f593a6 in the
 * room, #f291a2 in the playing video (2026-10-27). The still is turned back
 * here, the same 3 x 3 step the browser takes on the video: BT.601's RGB to
 * YUV, then BT.709's YUV to RGB, on the gamma-encoded values. It then matches
 * the video to a level or two, and the room around it.
 */

/** RGB from YUV by BT.709, times YUV from RGB by BT.601 (full range; the offsets cancel) */
export const STILL_CORRECTION: [[number, number, number], [number, number, number], [number, number, number]] = (() => {
  const toYuv601 = [
    [0.299, 0.587, 0.114],
    [-0.299 / 1.772, -0.587 / 1.772, 0.886 / 1.772],
    [0.701 / 1.402, -0.587 / 1.402, -0.114 / 1.402],
  ];
  const toRgb709 = [
    [1, 0, 1.5748],
    [1, -0.1873, -0.4681],
    [1, 1.8556, 0],
  ];
  return toRgb709.map((row) => [0, 1, 2].map((c) => row.reduce((sum, v, k) => sum + v * toYuv601[k][c], 0))) as typeof STILL_CORRECTION;
})();

/** The heights a still is made at: a tile, a card, a phone */
export const STILL_HEIGHTS = [640, 960, 1260, 1920] as const;

/** A Stream video's uid: 32 hex characters, nothing else */
export function isStreamUid(uid: string | null | undefined): uid is string {
  return !!uid && /^[a-f0-9]{32}$/.test(uid);
}

/** The latest moment a still may be taken from, seconds into the video */
export const STILL_LATEST_S = 30;

/** A still's moment, whole seconds within 0..STILL_LATEST_S (anything else is the first frame) */
export function stillMoment(at: unknown): number {
  const t = Math.round(Number(at));
  return Number.isFinite(t) && t > 0 ? Math.min(t, STILL_LATEST_S) : 0;
}

/** The site's own address for a copy's still, corrected (app/stills/[name]): its first frame, or the moment `at` seconds in */
export function stillUrl(uid: string, height = 1920, at = 0): string {
  const t = stillMoment(at);
  return `/stills/${uid}.jpg?h=${height}${t ? `&t=${t}` : ''}`;
}
