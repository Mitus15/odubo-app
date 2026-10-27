'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RoomShell, Symbol } from '@/components/room/RoomParts';
import { onRoom, ROOM_DARK } from '@/lib/room';

/** A line drawn in the room's writing, faint */
const HAIRLINE = 'color-mix(in srgb, currentColor 35%, transparent)';

/**
 * A page that fell over, set in the house's dark room: a piece tipped on its
 * side, one line, Try again as the one drawn shape, and the way home.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service (Sentry)
    console.error('Global error:', error);
  }, [error]);

  const on = onRoom(ROOM_DARK);

  return (
    <RoomShell colour={ROOM_DARK} on={on}>
      <main
        className="flex min-h-[calc(100%-env(safe-area-inset-top)-56px)] flex-col items-center justify-center px-6 text-center"
        // as much under it as the danceman's header above, so the piece sits in the middle of the screen
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--room-top))' }}
      >
        <Symbol name="one" className="h-20 w-20 origin-bottom rotate-[14deg]" />
        <h1 className="room-display mt-8 text-[22px] leading-tight">Something slipped.</h1>
        <button
          type="button"
          onClick={reset}
          className="mt-10 flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-full text-[15px] font-semibold tracking-wide transition-transform active:scale-[0.98]"
          style={{ background: on, color: ROOM_DARK }}
        >
          Try again
        </button>
        <Link href="/" className="room-eyebrow mt-3 flex min-h-[44px] items-center px-2 underline underline-offset-4 hover:!opacity-100">
          Back to the room
        </Link>

        {/* What broke, for the developer only */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-10 w-full max-w-md text-left">
            <summary className="room-eyebrow flex min-h-[44px] cursor-pointer items-center">Error details</summary>
            <pre className="mt-2 max-h-40 overflow-auto border-t pt-3 text-[12px] leading-relaxed opacity-75" style={{ borderColor: HAIRLINE }}>
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}
      </main>
    </RoomShell>
  );
}
