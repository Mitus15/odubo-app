import Link from 'next/link';
import type { Metadata } from 'next';
import { RoomShell, SmallPrint, Symbol } from '@/components/room/RoomParts';
import SaveYourProgress from '@/components/room/SaveYourProgress';
import { generateSeoMetadata } from '@/lib/seo';
import { getLevels, KIND_LABEL } from '@/lib/levels';
import { onRoom, roomFor } from '@/lib/room';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const newest = (await getLevels())[0];
  return generateSeoMetadata({
    title: 'Levels',
    description: 'Odubo Studio: every level Mani Odubo has danced, as it comes out.',
    path: '/levels',
    ogImage: newest?.poster,
  });
}

interface PageProps {
  searchParams: Promise<{ room?: string }>;
}

/**
 * /levels: the level select, set in the room the visitor came from (?room=).
 * Every piece that is out (lib/levels), newest first, each a window into its
 * own room, a wall of them. A window opens the feed at that room. Nothing
 * that is not out yet, no dates, no locked tiles: the wall grows as he posts.
 */
export default async function LevelsPage({ searchParams }: PageProps) {
  const levels = await getLevels();
  const room = roomFor(levels, (await searchParams).room);
  const unlocked = new Set(levels.map((l) => l.song)).size;

  return (
    <RoomShell
      colour={room.colour}
      on={room.on}
      corner={
        <p className="room-display flex items-center gap-1.5 text-[15px]" aria-label={`${unlocked} unlocked`}>
          <Symbol name="unlocked" className="h-5 w-5" />
          {unlocked}
        </p>
      }
    >
      <main className="mx-auto flex min-h-[calc(100%-env(safe-area-inset-top)-56px)] w-full max-w-4xl flex-col px-4 pb-2 lg:px-10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <h1 className="sr-only">Levels</h1>
        <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          {levels.map((level) => (
            <li key={level.id}>
              <Link href={`/levels/${level.id}`} className="group block">
                <span className="relative block aspect-[9/16] overflow-hidden" style={{ background: level.colour, color: onRoom(level.colour) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={level.poster}
                    alt={`${level.label}: Mani Odubo dances ${level.song}${level.artist ? ` by ${level.artist}` : ''}`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </span>
                <span className="room-eyebrow mt-2 block">{level.label}</span>
                <span className="room-display block truncate text-[15px] leading-snug">{level.song}</span>
                <span className="block text-[13px] opacity-75">{KIND_LABEL[level.kind]}</span>
              </Link>
            </li>
          ))}
        </ul>

        <SaveYourProgress colour={room.colour} on={room.on} className="mx-auto mt-12 w-full max-w-sm" />
        <SmallPrint className="mt-auto pt-10" />
      </main>
    </RoomShell>
  );
}
