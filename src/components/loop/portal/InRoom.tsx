"use client";

import { useEffect, useState } from "react";
import CameraSheet from "@/components/loop/pose/CameraSheet";
import WallGallery from "@/components/loop/wall/WallGallery";
import ModuleSheet from "@/components/loop/shell/ModuleSheet";
import RunOfShow from "@/components/loop/gathering/RunOfShow";
import DanceyokeyPanel from "@/components/loop/danceyokey/DanceyokeyPanel";
import type { RunOfShowItem } from "@/lib/loop/content";

type Surface = "camera" | "wall" | "danceyokey" | "program" | null;

/**
 * STATE 2 — the in-room home for pass-holders. A short stack of what's
 * happening now, then the two things people actually came to do: shoot, and
 * watch the Wall fill up. Both open as full surfaces over this one, so the
 * camera gets the whole screen and you never lose your place.
 */
export function InRoom({
  sold,
  runOfShow,
  nowLabel,
}: {
  sold: number;
  runOfShow: RunOfShowItem[];
  /** The current run-of-show slot, resolved server-side. */
  nowLabel: string | null;
}) {
  const [surface, setSurface] = useState<Surface>(null);
  const [wallBump, setWallBump] = useState(0);

  // Re-mount the Wall after a post so a freshly-posted shot is already there.
  useEffect(() => {
    if (surface === "wall") setWallBump((k) => k + 1);
  }, [surface]);

  return (
    <>
      <div className="mt-10 w-full max-w-md">
        <div className="text-center">
          <div className="font-sans text-6xl font-extrabold leading-none tabular-nums">
            {sold}
          </div>
          <div className="loop-muted mt-2 text-sm font-semibold uppercase tracking-widest">
            In The Room
          </div>
        </div>

        {nowLabel && (
          <div className="loop-panel mt-6 rounded-2xl px-5 py-4 text-left">
            <div className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
              On now
            </div>
            <div className="mt-1 text-lg font-bold">{nowLabel}</div>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => setSurface("camera")}
            className="flex items-center justify-between rounded-3xl bg-[var(--foreground)] px-6 py-5 text-left text-[var(--background)] transition-transform active:scale-[0.98]"
          >
            <span>
              <span className="block text-xl font-extrabold">Camera</span>
              <span className="block text-sm opacity-75">
                Strike a pose — we&apos;ll Loop Soul it
              </span>
            </span>
            <span aria-hidden className="text-2xl">
              ◉
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSurface("wall")}
            className="loop-panel flex items-center justify-between rounded-3xl px-6 py-5 text-left transition-transform active:scale-[0.98]"
          >
            <span>
              <span className="block text-xl font-extrabold">The Wall</span>
              <span className="block text-sm opacity-75">
                Everything the room is shooting, live
              </span>
            </span>
            <span aria-hidden className="text-2xl">
              ▦
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSurface("danceyokey")}
            className="loop-panel flex items-center justify-between rounded-3xl px-6 py-5 text-left transition-transform active:scale-[0.98]"
          >
            <span>
              <span className="block text-xl font-extrabold">Danceyokey</span>
              <span className="block text-sm opacity-75">
                Claim the floor — pick your song
              </span>
            </span>
            <span aria-hidden className="text-2xl">
              ✦
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSurface("program")}
            className="rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] py-3 text-xs font-bold uppercase tracking-widest"
          >
            The Night — full program
          </button>
        </div>
      </div>

      {surface === "camera" && (
        <CameraSheet canPost onClose={() => setSurface(null)} onPosted={() => setWallBump((k) => k + 1)} />
      )}

      {surface === "wall" && (
        <ModuleSheet title="The Wall" onClose={() => setSurface(null)}>
          <WallGallery key={wallBump} canPost />
        </ModuleSheet>
      )}

      {surface === "danceyokey" && (
        <ModuleSheet title="Danceyokey" onClose={() => setSurface(null)}>
          <DanceyokeyPanel />
        </ModuleSheet>
      )}

      {surface === "program" && (
        <ModuleSheet title="The Night" onClose={() => setSurface(null)}>
          <RunOfShow items={runOfShow} showHeader={false} />
        </ModuleSheet>
      )}
    </>
  );
}

export default InRoom;
