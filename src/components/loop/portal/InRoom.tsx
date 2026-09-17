"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CameraSheet from "@/components/loop/pose/CameraSheet";
import WallGallery from "@/components/loop/wall/WallGallery";
import ModuleSheet from "@/components/loop/shell/ModuleSheet";
import RunOfShow from "@/components/loop/gathering/RunOfShow";
import BallotSheet from "@/components/loop/ballots/BallotSheet";
import YourTicket, { type HeldPass } from "@/components/loop/gathering/YourTicket";
import type { RunOfShowItem } from "@/lib/loop/content";

type Surface = "camera" | "wall" | "program" | "tracklist" | "cover" | "ticket" | null;

/**
 * STATE 2 — the in-room home for pass-holders. Their ticket first (the door
 * asks for it), then what's happening now, then the two things people came
 * to do: shoot, and watch the Wall fill up. Both open as full surfaces over
 * this one, so the camera gets the whole screen and you never lose your place.
 */
export function InRoom({
  heads: initialHeads,
  runOfShow,
  nowLabel,
  held = [],
}: {
  /** Who is in the room, resolved server-side; polled from here after that. */
  heads: number;
  runOfShow: RunOfShowItem[];
  /** The current run-of-show slot, resolved server-side. */
  nowLabel: string | null;
  /** The pass(es) this phone holds. Empty on an open-doors night with no pass. */
  held?: HeldPass[];
}) {
  const [surface, setSurface] = useState<Surface>(null);
  const [wallBump, setWallBump] = useState(0);
  const [heads, setHeads] = useState(initialHeads);
  const holder = held.length > 0;

  // Re-mount the Wall after a post so a freshly-posted shot is already there.
  useEffect(() => {
    if (surface === "wall") setWallBump((k) => k + 1);
  }, [surface]);

  // The count is people walking through a door: it moves all night.
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/loop/room", { cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { heads?: number };
          if (typeof d.heads === "number") setHeads(d.heads);
        }
      } catch {
        /* keep last known */
      }
    };
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="mt-10 w-full max-w-md">
        <div className="text-center">
          <div className="font-sans text-6xl font-extrabold leading-none tabular-nums">{heads}</div>
          <div className="loop-muted mt-2 text-sm font-semibold uppercase tracking-widest">Here tonight</div>
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
            {holder && (
              <>
                <Row title="Your ticket" sub="Show it at the door" onClick={() => setSurface("ticket")} />
                <Link
                  href="/loop/album"
                  className="flex min-h-[52px] w-full items-baseline justify-between gap-4 border-b border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] py-3.5 text-left"
                >
                  <span className="text-lg font-extrabold">Your record</span>
                  <span className="loop-muted text-xs">Listen</span>
                </Link>
              </>
            )}
            {(
              [
                ["wall", "The Wall", "What the room is shooting, live"],
                ["tracklist", "The Tracklist", "Rank the record"],
                ["cover", "The Cover", "Vote the night's shots"],
                ["program", "The Night", "The programme"],
              ] as const
            ).map(([key, title, sub]) => (
              <Row key={key} title={title} sub={sub} onClick={() => setSurface(key)} />
            ))}
          </div>
        </div>
      </div>

      {surface === "camera" && (
        <CameraSheet canPost onClose={() => setSurface(null)} onPosted={() => setWallBump((k) => k + 1)} />
      )}

      {surface === "ticket" && (
        <ModuleSheet title="Your ticket" onClose={() => setSurface(null)}>
          <YourTicket passes={held} />
        </ModuleSheet>
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

function Row({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full items-baseline justify-between gap-4 border-b border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] py-3.5 text-left"
    >
      <span className="text-lg font-extrabold">{title}</span>
      <span className="loop-muted text-xs">{sub}</span>
    </button>
  );
}

export default InRoom;
