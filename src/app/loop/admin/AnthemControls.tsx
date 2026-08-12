"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { AnthemStage, EffectiveSchedule, RoundKey } from "@/lib/loop/anthem-rounds";
import type { LeaderboardRow } from "@/lib/loop/anthem-candidates";
import type { Bracket } from "@/lib/loop/anthem";
import type { GateMode } from "@/lib/loop/event-codes";
import LoopLoader from "@/components/loop/brand/LoopLoader";

const ROUND_LABELS: { key: RoundKey; label: string }[] = [
  { key: "nominations", label: "Nominations" },
  { key: "qf", label: "Quarterfinals" },
  { key: "sf", label: "Semifinals" },
  { key: "final", label: "The Final" },
];

const STAGE_LABEL: Record<AnthemStage, string> = {
  nominating: "Nominating — crowd is suggesting & upvoting",
  seeding: "Seeding — nominations closed, choose the 8",
  bracket: "Bracket — voting in progress",
  champion: "Champion — the anthem is crowned",
};

export function AnthemControls({
  stage,
  schedule,
  rows,
  lockedSeedIds,
  gate,
  codeStats,
  serverNow,
  bracket,
}: {
  stage: AnthemStage;
  schedule: EffectiveSchedule;
  rows: LeaderboardRow[];
  lockedSeedIds: string[] | null;
  gate: GateMode;
  codeStats: { total: number; redeemed: number };
  serverNow: number;
  bracket: Bracket | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generated, setGenerated] = useState<string[]>([]);
  const [simulated, setSimulated] = useState<string | null>(null);

  async function simulatePurchase() {
    setBusy(true);
    const res = await fetch("/api/loop/admin/simulate-purchase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json()) as { code?: string; email?: string };
    setSimulated(data.code ? `${data.code} → ${data.email}` : "failed");
    setBusy(false);
    startTransition(() => router.refresh());
  }

  async function generateCodes(count: number) {
    setBusy(true);
    const res = await fetch("/api/loop/admin/anthem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "generateCodes", count }),
    });
    const data = (await res.json()) as { codes?: string[] };
    setGenerated(data.codes ?? []);
    setBusy(false);
    startTransition(() => router.refresh());
  }

  const locked = lockedSeedIds !== null;

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/loop/admin/anthem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    startTransition(() => router.refresh());
  }

  // Irreversible / public-facing actions get an "are you sure?" so the team
  // can't mis-tap (closing a round or locking the bracket can't be undone
  // cleanly mid-cycle).
  function confirmAct(message: string, body: Record<string, unknown>) {
    if (typeof window !== "undefined" && !window.confirm(message)) return;
    void act(body);
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 8) n.add(id);
      return n;
    });
  }

  const disabled = busy || pending;
  const lockedSet = useMemo(() => new Set(lockedSeedIds ?? []), [lockedSeedIds]);

  return (
    <div className="mt-4 space-y-8">
      <div className="rounded-2xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm font-medium">
        {STAGE_LABEL[stage]}
      </div>

      {/* Live bracket standings — so the team can watch (and post about) the
          race without leaving /admin. */}
      {bracket && <Standings bracket={bracket} />}

      {/* Nominations access */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Nominations access
        </h3>
        <p className="mt-1 text-xs opacity-60">
          Who can <strong>suggest</strong> songs. Everyone can always upvote &amp; vote.
        </p>
        <div className="mt-2 flex gap-2">
          {(["open", "ticket"] as GateMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => act({ action: "setGate", mode })}
              className={[
                "flex-1 rounded-2xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-50",
                gate === mode ? "border-ink bg-ink text-sand" : "border-ink/15 bg-ink/5",
              ].join(" ")}
            >
              <span className="font-bold">{mode === "open" ? "Open" : "Pass-holders"}</span>
              <span className="block text-xs opacity-70">
                {mode === "open" ? "Anyone can suggest" : "Event code required to suggest"}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => generateCodes(10)}
            className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-sand disabled:opacity-50"
          >
            Generate 10 codes
          </button>
          <span className="text-xs opacity-60">
            {codeStats.redeemed}/{codeStats.total} codes redeemed
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={simulatePurchase}
            className="rounded-full bg-ink/10 px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            Simulate a ticket purchase
          </button>
          <span className="text-xs opacity-60">
            Test the buy → code → email flow without taking money
          </span>
        </div>
        {simulated && (
          <div className="mt-2 rounded-2xl border border-ink/15 bg-bone/40 p-3 font-mono text-sm">
            {simulated}
          </div>
        )}

        {generated.length > 0 && (
          <div className="mt-2 rounded-2xl border border-ink/15 bg-bone/40 p-3">
            <div className="text-xs font-bold uppercase tracking-widest opacity-50">
              New codes — copy &amp; hand these out
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm sm:grid-cols-3">
              {generated.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Round cutoffs */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">Cutoffs</h3>
        <div className="mt-2 grid gap-2">
          {ROUND_LABELS.map(({ key, label }) => {
            const at = schedule[key];
            const remaining = at - serverNow;
            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink/10 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-bold">{label}</div>
                  <div className="text-xs opacity-60">
                    {fmtAt(at)} ·{" "}
                    {remaining > 0 ? `closes in ${fmt(remaining)}` : "closed"}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      confirmAct(
                        `Close ${label} now? This locks its result and opens the next round — it can't be undone.`,
                        { action: "closeNow", key },
                      )
                    }
                    className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-sand disabled:opacity-50"
                  >
                    Close now
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => act({ action: "extend", key, minutes: 60 })}
                    className="rounded-full bg-ink/10 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => act({ action: "extend", key, minutes: 60 * 24 })}
                    className="rounded-full bg-ink/10 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                  >
                    +1d
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Seeds */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
            Bracket seeds {locked ? "(locked)" : `· pick 8 (${selected.size}/8)`}
          </h3>
          {locked ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                confirmAct(
                  "Unlock the bracket? This clears the current bracket and its round timers so you can re-pick the 8. Votes already cast are kept but the bracket restarts.",
                  { action: "unlockSeeds" },
                )
              }
              className="rounded-full bg-ink/10 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
            >
              Unlock
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled || selected.size !== 8}
              onClick={() =>
                confirmAct(
                  "Lock these 8 as the bracket seeds? This opens the Quarterfinals and ends song-picking.",
                  { action: "lockSeeds", ids: Array.from(selected) },
                )
              }
              className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-sand disabled:opacity-40"
            >
              {disabled ? <LoopLoader size={14} /> : "Lock 8 seeds"}
            </button>
          )}
        </div>

        <div className="mt-2 grid gap-1.5">
          {rows.map((row, i) => {
            const id = row.candidate.id;
            const isSeed = lockedSet.has(id);
            const isPicked = selected.has(id);
            return (
              <div
                key={id}
                className={[
                  "flex items-center gap-3 rounded-2xl border px-3 py-2",
                  row.candidate.hidden
                    ? "border-ink/10 opacity-40"
                    : isSeed || isPicked
                      ? "border-ink/40 bg-ink/10"
                      : "border-ink/10",
                ].join(" ")}
              >
                <span className="w-5 text-center text-xs font-black tabular-nums opacity-40">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{row.candidate.title}</div>
                  <div className="truncate text-xs opacity-60">
                    {row.candidate.artist} · {row.votes} ♥
                    {row.candidate.suggestedBy === "house" ? " · house" : ""}
                  </div>
                </div>

                {!locked && !row.candidate.hidden && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(id)}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-bold",
                      isPicked ? "bg-ink text-sand" : "bg-ink/10",
                    ].join(" ")}
                  >
                    {isPicked ? "Picked" : "Pick"}
                  </button>
                )}

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    act({
                      action: "hideCandidate",
                      candidateId: id,
                      hidden: !row.candidate.hidden,
                    })
                  }
                  className="rounded-full bg-ink/5 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                >
                  {row.candidate.hidden ? "Unhide" : "Hide"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Standings({ bracket }: { bracket: Bracket }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">Live standings</h3>

      {bracket.champion ? (
        <div className="mt-2 rounded-2xl border border-ink bg-ink px-4 py-3 text-sand">
          <div className="text-xs font-bold uppercase tracking-widest opacity-70">
            The anthem is crowned
          </div>
          <div className="mt-0.5 text-lg font-extrabold">{bracket.champion.title}</div>
          <div className="text-sm opacity-80">{bracket.champion.artist}</div>
        </div>
      ) : (
        <p className="mt-1 text-xs opacity-60">
          {bracket.activeRound !== null
            ? `${bracket.rounds[bracket.activeRound].name} in progress — votes are live.`
            : "Waiting for the next round."}
        </p>
      )}

      <div className="mt-2 grid gap-3">
        {bracket.rounds.map((round) => {
          const isActive = round.round === bracket.activeRound;
          return (
            <div key={round.round}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-bold">{round.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                  {round.closed ? "closed" : isActive ? "voting now" : "upcoming"}
                </span>
              </div>
              <div className="grid gap-1">
                {round.matchups.map((m) => {
                  const leader =
                    m.votesA === m.votesB ? null : m.votesA > m.votesB ? "a" : "b";
                  const won = m.winner; // set only once the round is closed
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-ink/10 bg-bone/40 px-3 py-1.5 text-xs"
                    >
                      <Side
                        label={m.a ? m.a.title : "—"}
                        votes={m.votesA}
                        lead={leader === "a"}
                        win={won === "a"}
                      />
                      <Side
                        label={m.b ? m.b.title : "—"}
                        votes={m.votesB}
                        lead={leader === "b"}
                        win={won === "b"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Side({
  label,
  votes,
  lead,
  win,
}: {
  label: string;
  votes: number;
  lead: boolean;
  win: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={["truncate", win ? "font-extrabold" : lead ? "font-bold" : ""].join(" ")}>
        {win ? "★ " : ""}
        {label}
      </span>
      <span className="shrink-0 tabular-nums opacity-70">{votes}</span>
    </div>
  );
}

/**
 * Absolute cutoff time, formatted with an EXPLICIT locale + timezone so the
 * server and client always produce the same string (otherwise their differing
 * runtime locales/timezones cause a hydration mismatch). The series runs in
 * Kamloops, BC, so we pin it to Pacific time for the marketing team.
 */
function fmtAt(ms: number): string {
  return new Date(ms).toLocaleString("en-CA", {
    timeZone: "America/Vancouver",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default AnthemControls;
