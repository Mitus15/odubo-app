"use client";

import { useCallback, useEffect, useState } from "react";

type CodeRow = { code: string; redeemed: boolean };
type Stats = { total: number; redeemed: number };

/**
 * Event codes — generate & issue. Bulk-mint codes for the door (a 75-person
 * night needs 75 in hand), watch redemptions tick up, copy the unused batch
 * out to wherever tickets are delivered.
 */
export function EventCodes() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, redeemed: 0 });
  const [count, setCount] = useState("75");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/codes", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load codes (${res.status})`);
      const data = await res.json();
      setCodes(data.codes ?? []);
      setStats(data.stats ?? { total: 0, redeemed: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    const n = Math.min(Math.max(parseInt(count, 10) || 0, 1), 100);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: n }),
      });
      if (!res.ok) throw new Error(`Generation failed (${res.status})`);
      await load();
      flash(`${n} codes minted`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyUnused() {
    const unused = codes.filter((c) => !c.redeemed).map((c) => c.code);
    try {
      await navigator.clipboard.writeText(unused.join("\n"));
      flash(`${unused.length} unused codes copied`);
    } catch {
      setError("Couldn't reach the clipboard — long-press a code to copy it.");
    }
  }

  const visible = showAll ? codes : codes.slice(0, 24);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="w-24 rounded-full border border-ink/20 bg-transparent px-4 py-3 text-center font-mono text-sm outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="flex-1 rounded-full bg-ink py-3 text-sm font-bold text-sand transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? "Minting…" : "Generate codes"}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-ink/15 bg-ink/5 px-5 py-3 text-sm">
        <span>
          <b className="tabular-nums">{stats.redeemed}</b> redeemed ·{" "}
          <b className="tabular-nums">{stats.total}</b> issued
        </span>
        {codes.some((c) => !c.redeemed) && (
          <button
            type="button"
            onClick={copyUnused}
            className="rounded-full border border-ink/25 px-3 py-1.5 text-xs font-bold active:scale-95"
          >
            Copy unused
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-center text-sm opacity-60">Loading…</p>
      ) : codes.length > 0 ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {visible.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.code);
                    flash(`${c.code} copied`);
                  } catch {
                    /* long-press fallback */
                  }
                }}
                className={`rounded-xl border px-2 py-2 font-mono text-xs tracking-wider ${
                  c.redeemed
                    ? "border-ink/10 opacity-40 line-through"
                    : "border-ink/20 active:scale-95"
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
          {codes.length > visible.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 w-full rounded-full py-2 text-xs font-bold uppercase tracking-widest opacity-60"
            >
              Show all {codes.length}
            </button>
          )}
        </>
      ) : null}

      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-2 text-sm font-bold text-sand shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default EventCodes;
