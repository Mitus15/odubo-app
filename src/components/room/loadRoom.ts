import { getVerse } from '@/lib/homepageHelpers';
import { getLevels, getNextRoomColour, type Level } from '@/lib/levels';
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

/** Everything the room shows, read together on the server. Each part falls back to nothing on its own. */
export async function loadRoom(): Promise<RoomData> {
  const [levels, verse, links, storeOpen] = await Promise.all([
    getLevels(),
    getVerse().catch(() => null),
    getActiveLinks().catch(() => [] as LinkTreeItem[]),
    isStorePublished().catch(() => false),
  ]);
  const nextRoom = await getNextRoomColour(levels);
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
