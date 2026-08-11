"use client";

import { useCallback, useEffect, useState } from "react";

type Signup = {
  id: string;
  performers: string;
  songTitle: string | null;
  songArtist: string | null;
  status: "waiting" | "queued" | "performing" | "done" | "cut";
  position: number | null;
};

type View = {
  settings: { spots: number; mode: string; open: boolean };
  mine: Signup | null;
  myPlace: number | null;
  counts: { waiting: number; queued: number; spots: number };
  onNow: { performers: string; songTitle: string | null } | null;
  upNext: { performers: string; songTitle: string | null } | null;
};

/**
 * Danceyokey, guest side — claim a spot, then put the phone away. Deliberately
 * one screen with no feed: your act, your place in line, and who's on the floor
 * right now. Used both before the night (advance sign-up) and in the room.
 */
export function DanceyokeyPanel() {
  const [view, setView] = useState<View | null>(null);
  const [performers, setPerformers] = useState("");
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/loop/danceyokey", { cache: "no-store" });
      if (res.ok) setView(await res.json());
    } catch {
      /* keep last known */
    }
  }, []);

  useEffect(() => {
    void load();
    // Slow poll: you glance at this, you don't watch it.
    const t = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 20_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/danceyokey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          performers,
          songTitle: song,
          songArtist: artist || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Couldn't sign up (${res.status})`);
      setPerformers("");
      setSong("");
      setArtist("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!view?.mine) return;
    setBusy(true);
    try {
      await fetch(`/api/loop/danceyokey?id=${view.mine.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return <p className="loop-muted py-6 text-center text-sm">Loading the floor…</p>;
  }

  const mine = view.mine;

  return (
    <div className="grid gap-4">
      {/* What's happening on the floor */}
      {(view.onNow || view.upNext) && (
        <div className="loop-panel rounded-2xl px-5 py-4">
          {view.onNow && (
            <>
              <div className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
                On the floor
              </div>
              <div className="mt-1 font-bold">
                {view.onNow.performers}
                {view.onNow.songTitle ? (
                  <span className="loop-muted font-normal"> · {view.onNow.songTitle}</span>
                ) : null}
              </div>
            </>
          )}
          {view.upNext && (
            <div className={view.onNow ? "mt-3" : ""}>
              <div className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
                Up next
              </div>
              <div className="mt-1 font-bold">
                {view.upNext.performers}
                {view.upNext.songTitle ? (
                  <span className="loop-muted font-normal"> · {view.upNext.songTitle}</span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {mine ? (
        <div className="loop-panel rounded-2xl px-5 py-4">
          <div className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
            {mine.status === "performing"
              ? "You're up — go"
              : mine.status === "queued"
                ? "You're in the running order"
                : "You're on the list"}
          </div>
          <div className="mt-1 text-lg font-bold">{mine.performers}</div>
          <div className="loop-muted text-sm">
            {mine.songTitle}
            {mine.songArtist ? ` — ${mine.songArtist}` : ""}
          </div>
          {mine.status === "waiting" && view.myPlace && (
            <div className="mt-2 text-sm">
              <b className="tabular-nums">#{view.myPlace}</b> on the waiting list ·{" "}
              <span className="loop-muted">{view.counts.spots} spots tonight</span>
            </div>
          )}
          {mine.status !== "performing" && (
            <button
              type="button"
              onClick={withdraw}
              disabled={busy}
              className="loop-muted mt-3 text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4 disabled:opacity-50"
            >
              Take my name off
            </button>
          )}
        </div>
      ) : view.settings.open ? (
        <form onSubmit={submit} className="grid gap-2">
          <p className="loop-muted text-sm leading-relaxed">
            {view.counts.spots} spots tonight. Pick your song, bring whoever you
            want — the floor is yours for one song.
          </p>
          <input
            value={performers}
            onChange={(e) => setPerformers(e.target.value)}
            placeholder="Who's dancing? (you, or you + crew)"
            maxLength={200}
            className="rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-50 focus:border-[var(--foreground)]"
          />
          <input
            value={song}
            onChange={(e) => setSong(e.target.value)}
            placeholder="Your song"
            maxLength={160}
            className="rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-50 focus:border-[var(--foreground)]"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist (optional)"
            maxLength={160}
            className="rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-50 focus:border-[var(--foreground)]"
          />
          <button
            type="submit"
            disabled={busy || !performers.trim() || !song.trim()}
            className="rounded-full bg-[var(--foreground)] py-4 text-base font-bold text-[var(--background)] transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "Adding you…" : "Put me on the list"}
          </button>
          {view.counts.waiting > 0 && (
            <p className="loop-muted text-center text-xs">
              {view.counts.waiting} already waiting
            </p>
          )}
        </form>
      ) : (
        <p className="loop-panel rounded-2xl px-5 py-4 text-sm">
          Sign-ups are closed right now — catch the host if you want in.
        </p>
      )}

      {error && (
        <p className="loop-panel rounded-2xl px-4 py-3 text-sm">{error}</p>
      )}
    </div>
  );
}

export default DanceyokeyPanel;
