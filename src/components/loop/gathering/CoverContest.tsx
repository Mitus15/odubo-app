"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// The camera pulls in the segmenter and the GL stylizer — a large payload that
// nobody scanning a flyer should download before they have asked for a camera.
const CameraSheet = dynamic(
  () => import("@/components/loop/pose/CameraSheet"),
  { ssr: false },
);

/**
 * The Vinyl — the cover contest, and the tracklist vote that follows it.
 *
 * Reframed 2026-09-11 (owner): BOTH votes are about the vinyl, not the album.
 * That is the thing that makes them worth voting on. The album is already
 * fourteen tracks and already carries Mani's cover, so a vote could only ever
 * overwrite finished work. The record you can hold is not decided yet, a side
 * of vinyl is shorter than the album, and the room is who decides what it is.
 *
 * The 30-minute side limit is the real reason and is deliberately left unsaid
 * (owner: "I don't want to communicate all that, keep it simple"). "Fourteen
 * won't fit" carries the whole constraint without the manufacturing lecture.
 *
 * Voting happens AFTER the night, not during it: people need the album in their
 * hands before they can argue about the running order. The contest module
 * therefore sells the shoot now and dates the vote later.
 *
 * Numbers are stated plainly and on purpose. A contest that names its payment
 * reads as an offer; one that doesn't reads as free labour. The magazine rate
 * is gone with the magazine (owner, 2026-09-11) — the Wall is where shots live.
 *
 * The camera opens HERE rather than sending people to /loop/pose. Entering was
 * a two-page journey off the front door, which is a lot to ask of someone who
 * has had the idea explained to them ten seconds ago and is holding a piece of
 * paper. Shooting has never needed a pass — only posting to the Wall does.
 */
export function CoverContest() {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <section className="w-full space-y-5">
      <p className="text-sm opacity-80">
        Fourteen tracks won&apos;t fit on a record. The room decides what the
        Loop Soul vinyl is: which tracks are on it, and whose photograph is on
        the front. The cover you have seen is mine. It doesn&apos;t have to be
        the one you hold.
      </p>

      <ol className="relative ml-2 space-y-4 border-l border-ink/20">
        {[
          [
            "Shoot through the filter",
            "Every photo you take for the contest goes through the Loop Soul filter. Those frames are the entries.",
          ],
          [
            "It lands on the Wall",
            "The room's gallery. Everyone who was there can see it, and everyone who was there keeps it.",
          ],
          [
            "The room votes, after",
            "Once everyone has the album, the room votes, and you can watch it happen. The winning frame is the cover of the vinyl, credited to whoever took it. Every other version stays yours to use.",
          ],
        ].map(([title, body]) => (
          <li key={title} className="ml-5">
            <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-ink" />
            <div className="font-bold">{title}</div>
            <p className="mt-0.5 text-sm opacity-70">{body}</p>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-ink/20 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm">The cover of the vinyl</span>
          <span className="font-black tabular-nums">$50</span>
        </div>
        <p className="loop-muted mt-3 text-xs">
          Credit is fixed at the moment the shot is taken, so it stays yours.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setCameraOpen(true)}
        className="block w-full rounded-full bg-ink py-4 text-center text-sm font-bold text-sand transition-transform active:scale-95"
      >
        Make your cover
      </button>

      <p className="loop-muted text-center text-[11px] leading-relaxed">
        Nothing to sign up for. It happens on your phone, and nothing leaves it
        until you say so.
      </p>

      {/* The other half of the vinyl. Dated, not detailed: the running order is
          an argument people can only have once they have heard the record. */}
      <div className="border-t border-ink/15 pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.25em] opacity-60">
          The tracklist
        </div>
        <p className="loop-muted mt-1.5 text-sm leading-relaxed">
          The other half of what the room decides. It opens after the night,
          once everyone who was there has the album.
        </p>
      </div>

      {cameraOpen && <CameraSheet onClose={() => setCameraOpen(false)} />}
    </section>
  );
}

export default CoverContest;
