"use client";

import { useCallback, useEffect, useState } from "react";

type Stats = { entitled: number; addresses: number; notified: number; claimed: number };
type TrackRow = { number: number; title: string; seconds: number; free: boolean; dealable: boolean };
type EarlyRule = { enabled: boolean; extra: number };

/**
 * Release the record and tell the people who pre-ordered it. Two buttons, in
 * the order they should be pressed, and the numbers that say what happened.
 */
export function AlbumRelease() {
  const [released, setReleased] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [early, setEarly] = useState<EarlyRule>({ enabled: true, extra: 2 });
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/loop/admin/album", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { released: boolean; stats: Stats; early: EarlyRule; tracks: TrackRow[] };
      setReleased(data.released);
      setStats(data.stats);
      setEarly(data.early ?? { enabled: true, extra: 2 });
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

  async function setRule(patch: Partial<EarlyRule>) {
    setBusy("early");
    setNote(null);
    try {
      const res = await fetch("/api/loop/admin/album", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "setEarly", ...patch }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; early?: EarlyRule };
      if (!res.ok) throw new Error(data.error ?? `${res.status}`);
      if (data.early) setEarly(data.early);
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

      {/* Before it is out: the single, free, plus a draw per listener. */}
      <div className="rounded-2xl border border-ink/15 px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
          Before it&apos;s out · what a pass-holder hears
        </div>
        <p className="mt-2 text-sm">
          <b>{tracks.find((t) => t.free)?.title ?? "The single"}</b> free to everyone, plus{" "}
          <b>{early.extra}</b> more dealt to each listener at random. Their two never change, and two
          people rarely get the same pair.
        </p>
        <p className="mt-1 text-xs opacity-70">
          Never dealt: the intro, and the {tracks.filter((t) => !t.dealable && !t.free && t.number !== 1).length}{" "}
          interlude{tracks.filter((t) => !t.dealable && !t.free && t.number !== 1).length === 1 ? "" : "s"} under
          90 seconds. {tracks.filter((t) => t.dealable).length} songs are in the draw.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRule({ enabled: !early.enabled })}
            disabled={busy !== null || released}
            className={`min-h-[40px] rounded-full px-4 text-xs font-bold disabled:opacity-50 ${
              early.enabled ? "bg-ink text-sand" : "border border-ink/25"
            }`}
          >
            {early.enabled ? "On" : "Off"}
          </button>
          {[0, 1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRule({ extra: n })}
              disabled={busy !== null || released || !early.enabled}
              aria-pressed={early.extra === n}
              className={`min-h-[40px] w-11 rounded-full text-xs font-bold disabled:opacity-40 ${
                early.extra === n ? "border-2 border-ink" : "border border-ink/20"
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-xs opacity-60">extra each</span>
        </div>
        {released && <p className="mt-2 text-xs opacity-70">The whole record is out, so this no longer applies.</p>}
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
