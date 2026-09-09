import Link from "next/link";

/**
 * The Cover Contest — the reason the filter exists on the night.
 *
 * The cover is FLUID (owner, 2026-09-08). The artwork already shipping on the
 * single is not a placeholder waiting to be replaced — it is the owner's
 * version, and it stays his version. Anyone can hold their own. What the night
 * decides is which one becomes OFFICIAL.
 *
 * That distinction matters to the copy: this module used to say the album
 * "needs a cover", which stopped being true the moment the single rendered one
 * and would have read as a contradiction to anyone who saw both. A record with
 * many covers and one official cover has no such problem, and is a truer
 * statement of the closed circle than a vacancy would have been — the people in
 * the room are not filling a gap, they are entering a version.
 *
 * Numbers are stated plainly and on purpose. A contest that names its payment
 * reads as an offer; one that doesn't reads as free labour.
 */
export function CoverContest() {
  return (
    <section className="w-full space-y-5">
      <p className="text-sm opacity-80">
        The cover of this album is fluid. The one you have seen is mine — you
        can hold your own. On the 26th the room decides which one is official.
      </p>

      <ol className="relative ml-2 space-y-4 border-l border-ink/20">
        {[
          [
            "Shoot through the filter",
            "Every photo taken in the room goes through the Loop Soul filter — ink on sand, no faces. Those frames are the entries. You don't sign up for anything.",
          ],
          [
            "It lands on the Wall",
            "The room's gallery. Everyone in the room can see it, and everyone in the room keeps it.",
          ],
          [
            "The room votes",
            "The standout shots are shortlisted, and everyone in the room votes. The winning frame becomes the official cover, credited to whoever took it. Every other version stays valid — it just isn't the one on the record.",
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
        <div className="text-[11px] font-semibold uppercase tracking-[0.25em] opacity-60">
          What it pays
        </div>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt>The official cover</dt>
            <dd className="font-black tabular-nums">$50</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>Any shot used in the magazine</dt>
            <dd className="font-black tabular-nums">$5</dd>
          </div>
        </dl>
        <p className="loop-muted mt-3 text-xs">
          Credit is fixed at the moment the shot is taken, so it stays yours.
        </p>
      </div>

      <Link
        href="/loop/pose"
        className="block w-full rounded-full bg-ink py-3 text-center text-sm font-bold text-sand"
      >
        Try the filter
      </Link>
    </section>
  );
}

export default CoverContest;
