import Link from 'next/link';
import { RoomShell, Symbol } from '@/components/room/RoomParts';
import { onRoom, ROOM_DARK } from '@/lib/room';

/**
 * A door that opens onto nothing (a typo, a level that is not out, an album
 * that is not there), set in the house's dark room: the lock in the middle,
 * one line, and the room's one drawn shape back home.
 */
export default function NotFound() {
  const on = onRoom(ROOM_DARK);
  return (
    <RoomShell colour={ROOM_DARK} on={on}>
      <main
        className="flex min-h-[calc(100%-env(safe-area-inset-top)-56px)] flex-col items-center justify-center px-6 text-center"
        // as much under it as the danceman's header above, so the lock sits in the middle of the screen
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--room-top))' }}
      >
        <Symbol name="lock" className="h-20 w-20" />
        <h1 className="room-display mt-8 text-[22px] leading-tight">Nothing behind this door.</h1>
        <Link
          href="/"
          className="mt-10 flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-full text-[15px] font-semibold tracking-wide transition-transform active:scale-[0.98]"
          style={{ background: on, color: ROOM_DARK }}
        >
          Back to the room
        </Link>
      </main>
    </RoomShell>
  );
}
