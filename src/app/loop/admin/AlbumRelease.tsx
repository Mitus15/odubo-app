"use client";

import { useCallback, useEffect, useState } from "react";

type Stats = { entitled: number; addresses: number; notified: number; claimed: number };
type TrackRow = { number: number; title: string };

/**
 * Release the record and tell the people who pre-ordered it. Two buttons, in
 * the order they should be pressed, and the numbers that say what happened.
 */
export function AlbumRelease() {
  const [released, setReleased] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [early, setEarly] = useState<number[]>([]);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/loop/admin/album", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { released: boolean; stats: Stats; early: number[]; tracks: TrackRow[] };
      setReleased(data.released);
      setStats(data.stats);
      setEarly(data.early ?? []);
      setTracks(data.tracks ?? []);
    } catch {
      /* leave unknown */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "release" | "unrelease" | "notify" | "backfill") {
    if (action === "notify" && !window.confirm("Email every address that pre-ordered and has not been told? One email each, once.")) return;
    setBusy(action);
    setNote(null);
    try {
      const res = await fetch("/api/loop/admin/album", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; released?: boolean; stats?: Stats; sent?: number; failed?: number; added?: number };
      if (!res.ok) throw new Error(data.error ?? `${res.status}`);
      if (typeof data.released === "boolean") setReleased(data.released);
      if (data.stats) setStats(data.stats);
      if (action === "notify") setNote(`Told ${data.sent ?? 0}${data.failed ? `, ${data.failed} failed` : ""}.`);
      if (action === "backfill") setNote(`Added ${data.added ?? 0} missing pre-order${data.added === 1 ? "" : "s"}.`);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleEarly(n: number) {
    const next = early.includes(n) ? early.filter((x) => x !== n) : [...early, n].sort((a, b) => a - b);
    setBusy("early");
    setNote(null);
    try {
      const res = await fetch("/api/loop/admin/album", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "setEarly", tracks: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; early?: number[] };
      if (!res.ok) throw new Error(data.error ?? `${res.status}`);
      setEarly(data.early ?? next);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (released === null || stats === null) return null;

  return (
    <div className="mt-4 grid gap-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["pre-orders", stats.entitled],
            ["inboxes", stats.addresses],
            ["told", stats.notified],
            ["listened", stats.claimed],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="rounded-2xl border border-ink/15 bg-ink/5 px-2 py-3">
            <div className="text-xl font-extrabold tabular-nums">{n}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => act(released ? "unrelease" : "release")}
        disabled={busy !== null}
        className={`w-full rounded-2xl px-5 py-4 text-left transition-transform active:scale-[0.99] disabled:opacity-50 ${
          released ? "bg-ink text-sand" : "border border-ink/20 bg-ink/5"
        }`}
      >
        <span className="block text-sm font-bold">{released ? "The record is OUT" : "The record is not out yet"}</span>
        <span className={`block text-xs ${released ? "opacity-80" : "opacity-70"}`}>
          {released
            ? "/loop/album plays for everyone who pre-ordered. Tap to close it again."
            : "/loop/album plays the early tracks below and says the rest is coming. Tap when the whole album is ready to be heard."}
        </span>
      </button>

      {/* Before it is out: what a pass buys you today. One tap per track. */}
      <div className="rounded-2xl border border-ink/15 px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
          Before it&apos;s out · what pass-holders can hear now
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tracks.map((t) => {
            const on = early.includes(t.number);
            return (
              <button
                key={t.number}
                type="button"
                onClick={() => toggleEarly(t.number)}
                disabled={busy !== null || released}
                aria-pressed={on}
                className={`min-h-[36px] rounded-full border px-3 text-xs font-bold disabled:opacity-50 ${
                  on ? "border-ink bg-ink text-sand" : "border-ink/20"
                }`}
              >
                {t.number} · {t.title}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs opacity-70">
          {released
            ? "The whole record is out, so this no longer applies."
            : early.length === 0
              ? "Nothing plays until the record is out."
              : `${early.length} track${early.length === 1 ? "" : "s"} play at /loop/album for anyone owed the record.`}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act("notify")}
          disabled={busy !== null || !released || stats.addresses - stats.notified === 0}
          className="min-h-[44px] flex-1 rounded-2xl bg-ink px-4 text-sm font-bold text-sand disabled:opacity-40"
        >
          {busy === "notify" ? "Sending…" : `Tell ${Math.max(stats.addresses - stats.notified, 0)} by email`}
        </button>
        <button
          type="button"
          onClick={() => act("backfill")}
          disabled={busy !== null}
          className="min-h-[44px] rounded-2xl border border-ink/20 px-4 text-sm font-bold disabled:opacity-40"
          title="Any real pass order without a pre-order row gets one"
        >
          Backfill
        </button>
      </div>
      {note && <p className="text-xs opacity-70">{note}</p>}
    </div>
  );
}

export default AlbumRelease;
