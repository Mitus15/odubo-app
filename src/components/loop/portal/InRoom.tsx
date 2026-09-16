"use client";

import { useEffect, useState } from "react";
import CameraSheet from "@/components/loop/pose/CameraSheet";
import WallGallery from "@/components/loop/wall/WallGallery";
import ModuleSheet from "@/components/loop/shell/ModuleSheet";
import RunOfShow from "@/components/loop/gathering/RunOfShow";
import BallotSheet from "@/components/loop/ballots/BallotSheet";
import type { RunOfShowItem } from "@/lib/loop/content";

type Surface = "camera" | "wall" | "program" | "tracklist" | "cover" | null;

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
          <div className="mt-6 border-t border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] pt-3 text-left">
            <div className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">On now</div>
            <div className="mt-1 text-lg font-bold">{nowLabel}</div>
          </div>
        )}

        {/* One drawn shape, the camera; the rest is type on hairlines. */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setSurface("camera")}
            className="flex w-full items-baseline justify-between rounded-full bg-[var(--foreground)] px-6 py-4 text-left text-[var(--background)] transition-transform active:scale-[0.98]"
          >
            <span className="text-lg font-extrabold">Camera</span>
            <span className="text-xs opacity-75">Shoot through the filter</span>
          </button>

          <div className="mt-5 border-t border-[color-mix(in_srgb,var(--foreground)_15%,transparent)]">
            {(
              [
                ["wall", "The Wall", "What the room is shooting, live"],
                ["tracklist", "The Tracklist", "Rank the record"],
                ["cover", "The Cover", "Vote the night's shots"],
                ["program", "The Night", "The programme"],
              ] as const
            ).map(([key, title, sub]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSurface(key)}
                className="flex min-h-[52px] w-full items-baseline justify-between gap-4 border-b border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] py-3.5 text-left"
              >
                <span className="text-lg font-extrabold">{title}</span>
                <span className="loop-muted text-xs">{sub}</span>
              </button>
            ))}
          </div>
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

      {surface === "tracklist" && (
        <ModuleSheet title="The Tracklist" onClose={() => setSurface(null)}>
          <BallotSheet kind="tracklist" />
        </ModuleSheet>
      )}

      {surface === "cover" && (
        <ModuleSheet title="The Cover" onClose={() => setSurface(null)}>
          <BallotSheet kind="cover" />
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
