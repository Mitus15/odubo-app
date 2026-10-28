import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getLevels } from '@/lib/levelsServer';
import { onRoom, ROOM_DARK } from '@/lib/room';
import { correctedStill } from '@/lib/stillsServer';
import { streamUid } from '@/lib/streams';

/**
 * The share cards: what a pasted link to the site looks like in Messages,
 * WhatsApp, X or Facebook, at the 1200 x 630 those apps crop to.
 *
 *   /share/<level id>   that level: the dancer standing in his room
 *   /share/newest       the newest level (the home, /links, /levels)
 *   /share/house        the danceman alone in the house's dark (every other page)
 *
 * No .png on the address: next.config keeps every *.png a year, and the
 * newest level changes.
 *
 * The still is the site copy's first frame, whose field is the room's own
 * colour, so the card is one colour edge to edge with him in the middle. No
 * words: the page's title travels with the card.
 */

const SIZE = { width: 1200, height: 630 };
/** Kept an hour at the edge: a new level reaches its card within that */
const KEPT_FOR_S = 3600;

/** Where down the still's edge its field is read, top to bottom: the floor's light changes it as it goes */
const EDGE_STOPS = [0, 0.25, 0.5, 0.75, 1];

/**
 * The still (lib/stills, its colour corrected), and its field as it is in the
 * photo, read down its left edge: the floor's light shades the field, and a
 * JPEG's colours are not the room's hex exactly, so the card is painted from
 * the still itself and the two meet with no seam.
 */
async function stillOf(uid: string): Promise<{ src: string; field: string } | null> {
  try {
    const bytes = await correctedStill(uid, 1260);
    if (!bytes) return null;
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (y: number) => {
      const row = Math.min(info.height - 1, Math.max(0, Math.round(y * (info.height - 1))));
      const i = (row * info.width + 2) * info.channels;
      return `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]}) ${Math.round(y * 100)}%`;
    };
    return {
      src: `data:image/jpeg;base64,${bytes.toString('base64')}`,
      field: `linear-gradient(to bottom, ${EDGE_STOPS.map(at).join(', ')})`,
    };
  } catch {
    return null;
  }
}

async function house(): Promise<ImageResponse> {
  const svg = (await readFile(join(process.cwd(), 'public/brand-logos/odubo-brand/odubo-mark.svg'), 'utf8')).replace(
    /fill="#[0-9a-f]{6}"/i,
    `fill="${onRoom(ROOM_DARK)}"`,
  );
  const mark = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ROOM_DARK }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mark} alt="" width={200} height={252} />
      </div>
    ),
    { ...SIZE, headers: { 'Cache-Control': `public, max-age=${KEPT_FOR_S}, s-maxage=${KEPT_FOR_S}` } },
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ card: string }> }) {
  const name = (await params).card.replace(/\.png$/, '');
  if (name === 'house') return house();
  const levels = await getLevels();
  const level = name === 'newest' ? levels[0] : levels.find((l) => l.id === name || l.pieceIds.includes(name));
  if (!level) return house();
  const uid = streamUid(level.hls);
  const card = uid ? await stillOf(uid) : null;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: card?.field || level.colour }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {card && <img src={card.src} alt="" width={354} height={630} style={{ objectFit: 'cover' }} />}
      </div>
    ),
    { ...SIZE, headers: { 'Cache-Control': `public, max-age=${KEPT_FOR_S}, s-maxage=${KEPT_FOR_S}` } },
  );
}
