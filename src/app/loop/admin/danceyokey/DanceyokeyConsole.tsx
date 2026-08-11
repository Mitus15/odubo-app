"use client";

import { useCallback, useEffect, useState } from "react";

type Signup = {
  id: string;
  performers: string;
  songTitle: string | null;
  songArtist: string | null;
  note: string | null;
  status: "waiting" | "queued" | "performing" | "done" | "cut";
  position: number | null;
  source: "advance" | "in-room" | "wildcard";
  volumes: number;
  createdAt: string;
};
type Settings = { spots: number; mode: string; open: boolean };

const MODES: [string, string, string][] = [
  ["firstcome", "First come", "Sign-up order, regulars nudged ahead"],
  ["hostpick", "You pick", "Promote whoever you want from the list"],
  ["random", "Random draw", "Draw from the list — regulars get extra tickets"],
];

/**
 * Danceyokey, host side — the running order in one hand at the back of a room.
 * Big targets, current act first, everything one tap: start, done, promote,
 * draw, wildcard.
 */
export function DanceyokeyConsole() {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wildcard, setWildcard] = useState({ performers: "", songTitle: "" });
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/loop/admin/danceyokey", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load the list (${res.status})`);
      const data = await res.json();
      setSignups(data.signups ?? []);
      setSettings(data.settings ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function act(payload: Record<string, unknown>, note?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/danceyokey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Action failed (${res.status})`);
      await load();
      if (note) flash(note);
      return data;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const performing = signups.find((s) => s.status === "performing") ?? null;
  const queued = signups.filter((s) => s.status === "queued");
  const waiting = signups.filter((s) => s.status === "waiting");
  const done = signups.filter((s) => s.status === "done");

  return (
    <div className="mt-4 grid gap-6">
      {/* Settings */}
      {settings && (
        <section className="loop-panel rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">
                {settings.spots} spots · {done.length} done
              </div>
              <div className="loop-muted text-xs">
                {waiting.length} waiting · {queued.length} in the running order
              </div>
            </div>
            <button
              type="button"
              onClick={() => act({ action: "settings", open: !settings.open })}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                settings.open
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "border border-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
              }`}
            >
              {settings.open ? "Sign-ups open" : "Sign-ups closed"}
            </button>
          </div>

          <div className="mt-3 grid gap-1.5">
            {MODES.map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                onClick={() => act({ action: "settings", mode: id })}
                className={`rounded-xl px-4 py-2.5 text-left text-sm ${
                  settings.mode === id
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)]"
                }`}
              >
                <b>{label}</b>
                <span className={settings.mode === id ? " opacity-80" : " loop-muted"}> — {hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="loop-muted text-xs font-bold uppercase tracking-widest">Spots</span>
            <input
              type="number"
              min={1}
              max={20}
              defaultValue={settings.spots}
              onBlur={(e) => act({ action: "settings", spots: Number(e.target.value) })}
              className="w-20 rounded-full border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-3 py-2 text-center text-sm"
            />
            {settings.mode === "random" && (
              <button
                type="button"
                onClick={() => act({ action: "draw" }, "Drawn!")}
                disabled={busy || waiting.length === 0}
                className="ml-auto rounded-full bg-[var(--foreground)] px-5 py-2.5 text-sm font-bold text-[var(--background)] disabled:opacity-40"
              >
                🎲 Draw
              </button>
            )}
          </div>
        </section>
      )}

      {error && <p className="loop-panel rounded-2xl px-4 py-3 text-sm">{error}</p>}

      {/* On the floor */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">On the floor</h2>
        {performing ? (
          <div className="mt-2 rounded-2xl bg-[var(--foreground)] px-5 py-4 text-[var(--background)]">
            <div className="text-lg font-extrabold">{performing.performers}</div>
            <div className="text-sm opacity-80">
              {performing.songTitle}
              {performing.songArtist ? ` — ${performing.songArtist}` : ""}
            </div>
            <button
              type="button"
              onClick={() => act({ action: "status", id: performing.id, status: "done" }, "Done")}
              disabled={busy}
              className="mt-3 w-full rounded-full bg-[var(--background)] py-3 text-sm font-bold text-[var(--foreground)]"
            >
              Finish
            </button>
          </div>
        ) : (
          <p className="loop-muted mt-2 text-sm">Nobody on the floor — start the next act.</p>
        )}
      </section>

      {/* Running order */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Running order ({queued.length})
        </h2>
        <div className="mt-2 grid gap-2">
          {queued.length === 0 && (
            <p className="loop-muted text-sm">Nothing queued yet — promote or draw someone.</p>
          )}
          {queued.map((s, i) => (
            <div key={s.id} className="loop-panel rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold">
                    <span className="loop-muted tabular-nums">{i + 1}. </span>
                    {s.performers}
                    {s.source === "wildcard" && (
                      <span className="loop-muted text-[10px] font-bold uppercase tracking-widest">
                        {" "}
                        · wildcard
                      </span>
                    )}
                  </div>
                  <div className="loop-muted text-sm">
                    {s.songTitle}
                    {s.songArtist ? ` — ${s.songArtist}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => act({ action: "move", id: s.id, direction: "up" })}
                    disabled={busy || i === 0}
                    aria-label="Move up"
                    className="h-9 w-9 rounded-full border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => act({ action: "move", id: s.id, direction: "down" })}
                    disabled={busy || i === queued.length - 1}
                    aria-label="Move down"
                    className="h-9 w-9 rounded-full border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => act({ action: "status", id: s.id, status: "performing" }, "They're up")}
                  disabled={busy}
                  className="rounded-full bg-[var(--foreground)] py-2.5 text-sm font-bold text-[var(--background)]"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => act({ action: "status", id: s.id, status: "cut" })}
                  disabled={busy}
                  className="rounded-full border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] py-2.5 text-sm font-bold"
                >
                  Cut
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Waiting list */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          Waiting ({waiting.length})
        </h2>
        <div className="mt-2 grid gap-2">
          {waiting.length === 0 && <p className="loop-muted text-sm">Nobody waiting.</p>}
          {waiting.map((s) => (
            <div key={s.id} className="loop-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <div className="font-bold">
                  {s.performers}
                  {s.volumes > 0 && (
                    <span className="loop-muted text-[10px] font-bold uppercase tracking-widest">
                      {" "}
                      · regular ×{s.volumes}
                    </span>
                  )}
                </div>
                <div className="loop-muted truncate text-sm">
                  {s.songTitle}
                  {s.songArtist ? ` — ${s.songArtist}` : ""}
                  {s.source === "advance" ? " · signed up early" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => act({ action: "promote", id: s.id }, "Queued")}
                disabled={busy}
                className="shrink-0 rounded-full bg-[var(--foreground)] px-4 py-2.5 text-sm font-bold text-[var(--background)]"
              >
                Queue
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Wildcard */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">Wildcard</h2>
        <p className="loop-muted mt-1 text-sm">
          Someone going for it on the floor? Put them straight in the running order.
        </p>
        <div className="mt-2 grid gap-2">
          <input
            value={wildcard.performers}
            onChange={(e) => setWildcard((w) => ({ ...w, performers: e.target.value }))}
            placeholder="Who?"
            className="rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 text-sm outline-none"
          />
          <div className="flex gap-2">
            <input
              value={wildcard.songTitle}
              onChange={(e) => setWildcard((w) => ({ ...w, songTitle: e.target.value }))}
              placeholder="Song (optional)"
              className="min-w-0 flex-1 rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                await act({ action: "wildcard", ...wildcard }, "Wildcard in");
                setWildcard({ performers: "", songTitle: "" });
              }}
              disabled={busy || !wildcard.performers.trim()}
              className="shrink-0 rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-bold text-[var(--background)] disabled:opacity-40"
            >
              ✦ Add
            </button>
          </div>
        </div>
      </section>

      {done.length > 0 && (
        <section className="loop-muted text-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest">Done tonight</h2>
          <ul className="mt-2 grid gap-1">
            {done.map((s) => (
              <li key={s.id}>
                {s.performers}
                {s.songTitle ? ` — ${s.songTitle}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[var(--foreground)] px-5 py-2 text-sm font-bold text-[var(--background)] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default DanceyokeyConsole;
