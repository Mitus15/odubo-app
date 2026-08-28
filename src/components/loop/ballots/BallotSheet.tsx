"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * One ballot, rendered as a ranked list the room can push on. Used for both
 * member votes — the tracklist and the album cover — because they are the
 * same interaction: a scarce budget of votes spread across a list, standings
 * visible to everyone, voting for the circle.
 *
 * Standings load on open and refresh after every toggle, so the list a voter
 * reorders is always the room's current one, not a stale snapshot.
 */

type Option = {
  id: string;
  title: string;
  subtitle: string | null;
  imageSrc: string | null;
  votes: number;
  mine: boolean;
};

type Ballot = {
  kind: "tracklist" | "cover";
  open: boolean;
  canVote: boolean;
  options: Option[];
  votesUsed: number;
  voteLimit: number;
};

export function BallotSheet({ kind }: { kind: "tracklist" | "cover" }) {
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/loop/ballots/${kind}`);
      if (!res.ok) throw new Error("standings unavailable");
      setBallot((await res.json()) as Ballot);
    } catch {
      setError("Couldn't load the standings — try again in a moment.");
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string) {
    if (!ballot?.canVote || busy) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/loop/ballots/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "That didn't go through — try again.");
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!ballot) {
    return (
      <p className="loop-muted py-6 text-center text-sm">
        {error ?? "Loading the standings…"}
      </p>
    );
  }

  const intro =
    kind === "tracklist"
      ? "The room ranks the record. Your votes help decide the album's running order."
      : "The cover comes from the room. Vote on the shortlisted shots — the winner becomes the album's cover art, credited and paid.";

  return (
    <section className="w-full">
      <p className="text-sm opacity-80">{intro}</p>

      <div className="loop-muted mt-2 text-xs font-semibold uppercase tracking-widest">
        {!ballot.open
          ? "Voting hasn't opened yet — standings only."
          : ballot.canVote
            ? `${ballot.voteLimit - ballot.votesUsed} of ${ballot.voteLimit} votes left · tap to vote, tap again to take it back`
            : "Voting is for the room — enter your event code to take part."}
      </div>

      {ballot.options.length === 0 ? (
        <p className="loop-muted mt-6 text-center text-sm">
          {kind === "cover"
            ? "The shortlist appears here once shots from the night are featured."
            : "Nothing to rank yet."}
        </p>
      ) : (
        <ol className="mt-4 grid gap-2">
          {ballot.options.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => toggle(o.id)}
                disabled={!ballot.canVote || busy !== null}
                aria-pressed={o.mine}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-transform active:scale-[0.99] ${
                  o.mine ? "border-current bg-current/10" : "border-current/15"
                } ${ballot.canVote ? "" : "cursor-default"}`}
              >
                <span className="loop-muted w-6 shrink-0 font-mono text-sm tabular-nums">
                  {i + 1}
                </span>
                {o.imageSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.imageSrc}
                    alt={o.title}
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{o.title}</span>
                  {o.subtitle && (
                    <span className="loop-muted block text-xs">{o.subtitle}</span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-black tabular-nums">{o.votes}</span>
                  <span className="loop-muted block text-[10px] uppercase tracking-widest">
                    {o.mine ? "yours ✓" : "votes"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="mt-3 text-center text-sm font-semibold">{error}</p>}
    </section>
  );
}

export default BallotSheet;
