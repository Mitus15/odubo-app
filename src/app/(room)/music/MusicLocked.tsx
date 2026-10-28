import PlatformIcon from '@/components/linktree/PlatformIcon';
import { RoomShell, SmallPrint, Symbol } from '@/components/room/RoomParts';
import SaveYourProgress from '@/components/room/SaveYourProgress';
import { CATCHING_LIGHT } from '@/lib/music/catchingLight';

/**
 * /music while nothing on the site is out, set in the room the visitor came
 * from (?room=, lib/room): the record that is out lives on the streaming
 * services, and the next one is locked.
 *
 *   Catching Light          its cover standing on the floor, its year and
 *                           songs, the services' marks, straight to the album
 *   a lock, World 2         the next record, with no title and no tracks: its
 *                           story is kept back until it is out (2026-10-24)
 *   Save your progress      the list, the room's one drawn shape
 */
export default function MusicLocked({ colour, on }: { colour: string; on: string }) {
  return (
    <RoomShell colour={colour} on={on}>
      <main className="mx-auto flex min-h-[calc(100%-env(safe-area-inset-top)-56px)] w-full max-w-md flex-col px-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <section className="mt-6 flex flex-col items-center" aria-labelledby="catching-light">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CATCHING_LIGHT.cover}
            alt={`${CATCHING_LIGHT.title}, the album by Mani Odubo (${CATCHING_LIGHT.year})`}
            width={600}
            height={600}
            className="on-the-floor-short aspect-square w-full max-w-[16rem] shadow-[0_18px_30px_-18px_rgb(42_15_10/0.6)]"
          />
          <h1 id="catching-light" className="room-display mt-12 text-[24px] leading-tight">
            {CATCHING_LIGHT.title}
          </h1>
          <p className="room-eyebrow mt-1">
            {CATCHING_LIGHT.year} · {CATCHING_LIGHT.songs} songs
          </p>
          {/* Where it streams: each service's own mark */}
          <ul className="mt-5 flex items-center gap-4">
            {CATCHING_LIGHT.listen.map((link) => (
              <li key={link.platform}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Listen to ${CATCHING_LIGHT.title} on ${link.label}`}
                  title={link.label}
                  className="flex h-14 w-14 items-center justify-center rounded-full transition-[opacity,transform] hover:opacity-70 active:scale-95"
                >
                  <PlatformIcon platform={link.platform} mono className="h-8 w-8" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 flex flex-col items-center gap-3" aria-labelledby="world-two">
          <Symbol name="lock" className="h-10 w-10" />
          <h2 id="world-two" className="room-eyebrow">
            World 2
          </h2>
          <SaveYourProgress colour={colour} on={on} className="w-full max-w-sm" />
        </section>

        <SmallPrint className="mt-auto pt-10" />
      </main>
    </RoomShell>
  );
}
