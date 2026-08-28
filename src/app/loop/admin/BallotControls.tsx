"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Open/close the two member ballots without a deploy. `Auto` is the default —
 * derived from the phase (open from live onward). An explicit Open/Closed
 * overrides it either way; the common use is closing the vote once the
 * result is being announced.
 */

type Kind = "tracklist" | "cover";
const LABELS: Record<Kind, string> = { tracklist: "The Tracklist", cover: "The Cover" };

export function BallotControls() {
  const [open, setOpen] = useState<Record<Kind, boolean> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/loop/admin/ballots");
    if (!res.ok) return;
    const data = (await res.json()) as { ballots: Record<Kind, { open: boolean }> };
    setOpen({ tracklist: data.ballots.tracklist.open, cover: data.ballots.cover.open });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function set(kind: Kind, state: "open" | "closed" | "auto") {
    setBusy(true);
    try {
      await fetch("/api/loop/admin/ballots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, state }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      {(Object.keys(LABELS) as Kind[]).map((kind) => (
        <div
          key={kind}
          className="flex items-center justify-between gap-3 rounded-2xl border border-ink/15 px-4 py-3"
        >
          <div>
            <div className="font-bold">{LABELS[kind]}</div>
            <div className="loop-muted text-xs">
              {open === null ? "…" : open[kind] ? "Voting is OPEN" : "Voting is closed"}
            </div>
          </div>
          <div className="flex gap-2">
            {(["open", "closed", "auto"] as const).map((state) => (
              <button
                key={state}
                type="button"
                disabled={busy}
                onClick={() => set(kind, state)}
                className="rounded-full border border-ink/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
              >
                {state}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="loop-muted text-xs">
        Auto = open from the moment the room goes live, through Legacy, until you close
        it. The cover ballot lists whatever is ✦ featured on the Wall — feature a shot
        and it is on the ballot.
      </p>
    </div>
  );
}

export default BallotControls;
