"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";

/**
 * Testing tool — simulate a full anthem session with N synthetic participants.
 * Run it stepwise (and watch the Standings/leaderboard above update) or all at
 * once. TEST-ONLY: remove or gate before launch; Reset after use.
 */
export function AnthemSim() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [count, setCount] = useState(75);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function run(action: string, label: string) {
    setBusy(action);
    setResult(null);
    try {
      const res = await fetch("/api/loop/admin/anthem/sim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, count }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      setResult(summarise(label, data));
    } catch {
      setResult(`${label}: failed`);
    } finally {
      setBusy(null);
      startTransition(() => router.refresh());
    }
  }

  const disabled = busy !== null;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-dashed border-ink/30 bg-ink/[0.03] p-3 text-xs opacity-70">
        Test-only. Injects {count} synthetic participants. Use <strong>Reset &amp; clear</strong>{" "}
        before going live so fake data doesn&apos;t ship.
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="font-bold">Participants</span>
        <input
          type="number"
          min={1}
          max={500}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
          className="w-20 rounded-xl border border-ink/15 bg-bone/40 px-3 py-1.5 text-sm tabular-nums outline-none focus:border-ink/40"
        />
      </label>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-50">Step by step</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <SimButton label="Reset & clear" busy={busy === "reset"} disabled={disabled} onClick={() => run("reset", "Reset")} />
          <SimButton label="Populate longlist" busy={busy === "populate"} disabled={disabled} onClick={() => run("populate", "Populate")} />
          <SimButton label={`Simulate ${count} likes`} busy={busy === "like"} disabled={disabled} onClick={() => run("like", "Likes")} />
          <SimButton label="Lock top 8" busy={busy === "lockTop8"} disabled={disabled} onClick={() => run("lockTop8", "Lock top 8")} />
          <SimButton label={`Simulate ${count} votes (this round)`} busy={busy === "voteRound"} disabled={disabled} onClick={() => run("voteRound", "Round votes")} />
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-50">One click</div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => run("runAll", "Full session")}
          className="mt-1.5 rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-electric disabled:opacity-50"
        >
          {busy === "runAll" ? <LoopLoader size={16} /> : `Run full ${count}-person session`}
        </button>
      </div>

      {result && (
        <div className="rounded-2xl border border-ink/15 bg-bone/40 p-3 text-sm">{result}</div>
      )}
    </div>
  );
}

function SimButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full bg-ink/10 px-4 py-2 text-xs font-bold disabled:opacity-50"
    >
      {busy ? <LoopLoader size={14} /> : label}
    </button>
  );
}

function summarise(label: string, data: Record<string, unknown>): string {
  if (data.error) return `${label}: ${String(data.error)}`;
  if (label === "Populate") return `Populate: added ${data.added} songs`;
  if (label === "Likes") return `Likes: ${data.likes} cast by ${data.voters} participants`;
  if (label === "Lock top 8") return `Locked 8 seeds ✓`;
  if (label === "Round votes") return `Round "${data.round ?? "—"}": ${data.ballots} ballots cast`;
  if (label === "Full session") return `Full session ✓ — champion: ${data.champion ?? "—"}`;
  if (label === "Reset") return "Reset ✓ — longlist & votes cleared";
  return `${label}: done`;
}

export default AnthemSim;
