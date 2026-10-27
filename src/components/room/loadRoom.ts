import { getVerse } from '@/lib/homepageHelpers';
import type { Level } from '@/lib/levels';
import { unstable_cache } from 'next/cache';
import { getLevels, getLevelsOrThrow, getNextRoomColour } from '@/lib/levelsServer';
import { getActiveLinks, isStoreLink } from '@/lib/linktree';
import { isStorePublished } from '@/lib/storeSettings';
import type { LinkTreeItem } from '@/types/linktree';

export interface RoomData {
  /** Out, newest first */
  levels: Level[];
  /** How many songs have a piece out */
  unlocked: number;
  /** The next room's colour, shown locked after the levels: a colour, no song, no day */
  nextRoom: string | null;
  verse: { text: string; reference: string } | null;
  /** The bio link's marks, where the audience is first, then listening */
  platforms: LinkTreeItem[];
  storeOpen: boolean;
}

const PLATFORM_ORDER = ['instagram', 'tiktok', 'youtube', 'spotify', 'apple_music'];

/** How long the room's reads are kept on the server: the levels, the verse, the bio link's marks, the next room */
const ROOM_KEPT_S = 60;

/** Everything the room shows, kept a minute (Next's data cache), so the title screen never waits on the database. A read that fails is not kept. */
const roomKept = unstable_cache(
  async (): Promise<RoomData> => {
    const [levels, verse, links, storeOpen] = await Promise.all([getLevelsOrThrow(), getVerse(), getActiveLinks(), isStorePublished()]);
    return shape(levels, verse, links, storeOpen, await getNextRoomColour(levels));
  },
  ['room-v1'],
  { revalidate: ROOM_KEPT_S, tags: ['levels'] },
);

/** Everything the room shows, read together on the server: kept, else read now with each part falling back to nothing on its own. */
export async function loadRoom(): Promise<RoomData> {
  try {
    return await roomKept();
  } catch {
    // fall through: read each part on its own
  }
  const [levels, verse, links, storeOpen] = await Promise.all([
    getLevels(),
    getVerse().catch(() => null),
    getActiveLinks().catch(() => [] as LinkTreeItem[]),
    isStorePublished().catch(() => false),
  ]);
  return shape(levels, verse, links, storeOpen, await getNextRoomColour(levels));
}

function shape(
  levels: Level[],
  verse: { text: string; reference: string } | null,
  links: LinkTreeItem[],
  storeOpen: boolean,
  nextRoom: string | null,
): RoomData {
  const rank = (p?: string | null) => {
    const i = PLATFORM_ORDER.indexOf(p || '');
    return i < 0 ? 99 : i;
  };
  return {
    levels,
    unlocked: new Set(levels.map((l) => l.song)).size,
    nextRoom,
    verse: verse ? { text: verse.text, reference: verse.reference } : null,
    platforms: links.filter((l) => !isStoreLink(l)).sort((a, b) => rank(a.platform) - rank(b.platform)),
    storeOpen,
  };
}
