import { unstable_cache } from 'next/cache';
import { lookFromPixels, settled, type VideoLook } from '@/lib/sampler';
import { correctedStill } from '@/lib/stillsServer';

/**
 * The sampler's server half: a video's look read once from the first moment
 * he stands in the room (its still in its true colour, lib/stillsServer: the
 * first frame, or a few seconds in when he opens up at the phone), kept 30 days in Next's
 * data cache, shared by every server. A video never changes under its uid, so
 * a new upload is sampled the first time its room is shown and never again.
 * A frame that cannot be read is not kept, so it is tried again next time.
 */

/** Small enough to read in a moment, large enough for a flat field and a silhouette */
const SAMPLE_HEIGHT = 640;
const KEPT_FOR_S = 60 * 60 * 24 * 30;

/**
 * The moments tried, seconds in, for the first where he stands in the room; none settled: the first
 * with him in it. A copy opens fading in from its field (site_copies.py), so its first second is 1.
 */
const MOMENTS = [0, 1, 2, 4, 6, 8, 10, 12, 15, 20];

const readLook = unstable_cache(
  async (uid: string): Promise<VideoLook> => {
    const { default: sharp } = await import('sharp');
    let first: VideoLook | null = null;
    for (const at of MOMENTS) {
      // A frame Stream would not give (busy, still processing) is not "no settled frame": nothing is kept, it is tried again
      const still = await correctedStill(uid, SAMPLE_HEIGHT, at);
      if (!still) throw new Error(`no still for ${uid} at ${at} s`);
      const { data, info } = await sharp(still).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const look = lookFromPixels(data, info.width, info.height, info.channels, at);
      if (!first || (!first.figure && look.figure)) first = look;
      if (settled(data, info.width, info.height, info.channels)) return look;
    }
    return first!;
  },
  ['video-look-v5'],
  { revalidate: KEPT_FOR_S },
);

/** A video's field and figure, or null when its frame cannot be read */
export async function videoLook(uid: string): Promise<VideoLook | null> {
  try {
    return await readLook(uid);
  } catch {
    return null;
  }
}
