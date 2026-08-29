/**
 * Hold the screen awake for the duration of a take.
 *
 * Not a nicety: iOS auto-lock defaults to 30 seconds, so without this a
 * five-minute recording dies before minute one and the failure looks like a
 * bug in the camera rather than the phone doing exactly what it was told.
 *
 * Deliberately total — every failure mode resolves to "no lock held" rather
 * than throwing, because losing the screen lock must never cost you the take.
 * The caller can ask whether a lock is actually held and say so in the UI.
 */

type WakeLockSentinelLike = { release: () => Promise<void>; released: boolean };
type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

function api(): WakeLockLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock ?? null;
}

/** Whether this browser can hold the screen at all (absent below iOS 16.4). */
export function wakeLockSupported(): boolean {
  return api() !== null;
}

export type ScreenHold = {
  /** True only if a lock is genuinely held — drives the "keep the screen on"
   *  warning for devices that can't do it themselves. */
  held: boolean;
  release: () => void;
};

/**
 * Request the screen lock and keep it across tab switches.
 *
 * The lock is dropped by the platform whenever the document hides, so it has
 * to be re-acquired on the way back — otherwise returning to a take that is
 * still rolling leaves the screen free to sleep again.
 */
export async function holdScreen(): Promise<ScreenHold> {
  const wakeLock = api();
  if (!wakeLock) return { held: false, release: () => {} };

  let sentinel: WakeLockSentinelLike | null = null;
  let done = false;

  const acquire = async () => {
    if (done || document.hidden) return;
    try {
      sentinel = await wakeLock.request("screen");
    } catch {
      // Throws on a hidden document, and on some devices under low battery.
      sentinel = null;
    }
  };

  const onVisible = () => {
    if (document.hidden) return;
    if (sentinel && !sentinel.released) return;
    void acquire();
  };

  await acquire();
  document.addEventListener("visibilitychange", onVisible);

  return {
    held: sentinel !== null,
    release: () => {
      done = true;
      document.removeEventListener("visibilitychange", onVisible);
      try {
        void sentinel?.release();
      } catch {
        /* already gone */
      }
      sentinel = null;
    },
  };
}
