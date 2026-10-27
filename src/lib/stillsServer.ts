import { isStreamUid, STILL_CORRECTION, STILL_HEIGHTS, stillMoment } from './stills';

/**
 * The server's half of lib/stills: fetching a copy's first frame from Stream
 * and turning its colour back. Kept apart, so the room's client code (which
 * reads lib/levels, which reads lib/stills) never bundles the image library.
 */

/** A frame of a site copy from Stream (its first, or `at` seconds in), corrected; null when Stream has none */
export async function correctedStill(uid: string, height: number, at = 0): Promise<Buffer | null> {
  if (!isStreamUid(uid)) return null;
  const h = STILL_HEIGHTS.find((x) => x >= height) ?? STILL_HEIGHTS[STILL_HEIGHTS.length - 1];
  const res = await fetchFrame(`https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=${stillMoment(at)}s&height=${h}`);
  if (!res) return null;
  const { default: sharp } = await import('sharp');
  return sharp(Buffer.from(await res.arrayBuffer()))
    .recomb(STILL_CORRECTION)
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

/** Tries a frame takes before it is called unavailable: a dropped connection or a busy Stream is usually gone on the next try */
const TRIES = 3;

async function fetchFrame(url: string): Promise<Response | null> {
  for (let i = 0; i < TRIES; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) return null; // a frame that is not there
    } catch {
      // the connection dropped: try again
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}
