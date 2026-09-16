"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The member ballots, from the admin.
 *
 * Two jobs: open or close voting without a deploy (Auto = the phase default,
 * open from live onward), and DECLARE the outcome once the room has voted.
 * The standings are live and would rewrite themselves if a shot were
 * unfeatured after the vote, so the winner is frozen here, once, by a human
 * looking at who is top and who they can pay. The $50 needs a person: each
 * cover option shows how to reach whoever shot it.
 */

type Kind = "tracklist" | "cover";
const LABELS: Record<Kind, string> = { tracklist: "The Tracklist", cover: "The Cover" };

type Contact = {
  displayName: string | null;
  email: string | null;
  buyerEmail: string | null;
  shots: number;
} | null;

type Option = { id: string; title: string; subtitle: string | null; imageSrc: string | null; votes: number; contact?: Contact };
type Result = { winner: string | null; declaredAt: string; note: string | null } | null;
type Ballot = { open: boolean; result: Result; options: Option[] };

export function BallotControls() {
  const [state, setState] = useState<Record<Kind, Ballot> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/loop/admin/ballots");
    if (!res.ok) return;
    const data = (await res.json()) as { ballots: Record<Kind, Ballot> };
    setState(data.ballots);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/loop/admin/ballots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function contactLine(c: Contact): string {
    if (!c) return "no credit yet";
    const who = c.displayName ?? "unnamed";
    const reach = c.email ?? c.buyerEmail ?? "no address";
    return `${who} · ${reach} · ${c.shots} shot${c.shots === 1 ? "" : "s"}`;
  }

  return (
    <div className="grid gap-3">
      {(Object.keys(LABELS) as Kind[]).map((kind) => {
        const b = state?.[kind];
        const winner = b?.result?.winner;
        return (
          <div key={kind} className="rounded-2xl border border-ink/15 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold">{LABELS[kind]}</div>
                <div className="loop-muted text-xs">
                  {!b ? "…" : b.result ? "Decided" : b.open ? "Voting is OPEN" : "Voting is closed"}
                </div>
              </div>
              <div className="flex gap-2">
                {(["open", "closed", "auto"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => post({ kind, state: s })}
                    className="rounded-full border border-ink/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* The cover is decided against real people; the tracklist result
                is a whole running order, declared elsewhere when it is frozen. */}
            {kind === "cover" && b && b.options.length > 0 && (
              <ul className="mt-3 grid gap-1.5 border-t border-ink/10 pt-3">
                {b.options.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold">{o.votes} · {o.title}</span>
                      <span className="loop-muted block text-[11px]">{contactLine(o.contact ?? null)}</span>
                    </span>
                    {winner === o.id ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => post({ kind, declare: null })}
                        className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-sand disabled:opacity-50"
                      >
                        The one · undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || !o.contact}
                        title={o.contact ? "" : "No reachable contact — the $50 needs a person"}
                        onClick={() => post({ kind, declare: o.id })}
                        className="shrink-0 rounded-full border border-ink/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40"
                      >
                        Declare
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <p className="loop-muted text-xs">
        Auto = open from the moment the room goes live, through Legacy, until you close it.
        The cover ballot lists whatever is ✦ featured on the Wall: feature a shot and it is on
        the ballot. Declaring freezes the winner and names it on the record and the Single;
        undo reopens the question.
      </p>
    </div>
  );
}

export default BallotControls;
