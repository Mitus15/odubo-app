"use client";

import { useState } from "react";
import CameraSheet from "./CameraSheet";
import WallGallery from "@/components/loop/wall/WallGallery";
import { CLIP_LIMITS, clipLimitS } from "@/lib/loop/pose/limits";

/**
 * Pose Studio, standalone (`/loop/pose`) — the public camera page, outside the
 * gated Portal. The camera itself is the full-bleed CameraSheet; this page is
 * just its front door plus your own saved shots.
 *
 * `canPost` is NOT hardcoded off. It mirrors `hasRoomAccess`, resolved on the
 * server — the same rule that governs the Wall everywhere else, so a code
 * holder or an open-doors night can post from here too, and nobody else can.
 * Hardcoding it off meant the only way to exercise camera → Wall was to flip
 * the event phase to `live`, which changes what every visitor to /loop sees.
 */
export function PoseStudioShell({
  canPost = false,
  isAdmin = false,
}: {
  canPost?: boolean;
  /**
   * Shows the studio switch. A CAPABILITY HINT, NOT A SECURITY BOUNDARY —
   * anyone can flip the React state below in devtools, and the worst they get
   * is a slower camera and a large file on their own phone. Never hang
   * anything that matters off this prop.
   */
  isAdmin?: boolean;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [studio, setStudio] = useState(false);

  const guestLimit = clipLimitS(false, true);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-5 px-5 py-8">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold">Pose Studio</h1>
        <p className="loop-muted mt-1 text-sm">
          Strike a pose — we&apos;ll Loop Soul it. Everything happens on your device.
        </p>
      </header>

      {isAdmin && (
        <button
          type="button"
          role="switch"
          aria-checked={studio}
          onClick={() => setStudio((v) => !v)}
          className={`flex items-center justify-between rounded-2xl border px-5 py-3 text-left transition-colors ${
            studio
              ? "border-transparent bg-[var(--foreground)] text-[var(--background)]"
              : "border-[color-mix(in_srgb,var(--foreground)_25%,transparent)]"
          }`}
        >
          <span>
            <span className="block text-sm font-extrabold">Studio mode</span>
            <span className="block text-xs opacity-75">
              Full HD, {CLIP_LIMITS.studioRaw / 60}-minute raw takes with sound
            </span>
          </span>
          <span aria-hidden className="text-xs font-bold uppercase tracking-widest">
            {studio ? "On" : "Off"}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={() => setCameraOpen(true)}
        className="flex items-center justify-between rounded-3xl bg-[var(--foreground)] px-6 py-5 text-left text-[var(--background)] transition-transform active:scale-[0.98]"
      >
        <span>
          <span className="block text-xl font-extrabold">Open the camera</span>
          <span className="block text-sm opacity-75">
            {studio
              ? `Studio · photo, ${clipLimitS(true, true)}s filtered or ${
                  CLIP_LIMITS.studioRaw / 60
                } min raw`
              : `Photo or ${guestLimit}s clip`}
          </span>
        </span>
        <span aria-hidden className="text-2xl">
          ◉
        </span>
      </button>

      <section>
        <h2 className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
          Your shots
        </h2>
        <div className="mt-3">
          {/* Wall reading is attendee-gated, so this page renders the shared
              grid in device-only mode. Re-mounts when the camera closes so a
              shot you just kept is already here. */}
          <WallGallery key={cameraOpen ? "open" : "closed"} deviceOnly />
        </div>
      </section>

      {cameraOpen && (
        // Keyed on `studio`: toggling it changes the requested capture
        // resolution, whether the engine runs at all, and whether a mic is
        // asked for. A clean remount removes a whole class of stale-stream
        // bugs rather than trying to reconcile them.
        <CameraSheet
          key={studio ? "studio" : "guest"}
          canPost={canPost}
          studio={studio}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </main>
  );
}

export default PoseStudioShell;
