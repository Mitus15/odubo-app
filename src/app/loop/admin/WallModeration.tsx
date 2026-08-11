"use client";

import { useCallback, useEffect, useState } from "react";
import type { WallPhotoDto } from "@/lib/loop/wall/client";

type Filter = "pending" | "all" | "featured" | "hidden";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "all", label: "All" },
  { id: "featured", label: "Iconic ✦" },
  { id: "hidden", label: "Hidden" },
];

/**
 * The Wall — moderation & Iconic Moments curation, sized for a phone at the
 * venue. Approve / hide keep the room's wall clean; ✦ features a shot into
 * Iconic Moments (Legacy's public face); delete removes file + record.
 */
export function WallModeration() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [photos, setPhotos] = useState<WallPhotoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/loop/admin/gallery/list?filter=${f}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Couldn't load the Wall (${res.status})`);
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function act(id: number, action: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/gallery/moderate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Action failed (${res.status})`);
      }
      await load(filter);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  }

  const statusOf = (p: WallPhotoDto) =>
    p.moderated === 2 ? "hidden" : p.moderated === 1 ? "approved" : "pending";

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-full border border-ink/15 bg-ink/5 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex-1 rounded-full py-2 text-xs font-bold ${
                filter === f.id ? "bg-ink text-sand" : "opacity-60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => load(filter)}
          aria-label="Refresh"
          className="shrink-0 rounded-full border border-ink/20 px-4 py-2 text-sm font-bold"
        >
          ↻
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-center text-sm opacity-60">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-ink/15 bg-ink/5 px-5 py-6 text-center text-sm opacity-70">
          {filter === "pending" ? "Nothing waiting — the Wall is clean." : "Nothing here."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <div
              key={p.uid}
              className="overflow-hidden rounded-2xl border border-ink/15 bg-ink/5"
            >
              <div className="relative aspect-[3/4] bg-black">
                {p.media_type === "video" ? (
                  <video
                    src={p.r2_url}
                    preload="metadata"
                    muted
                    playsInline
                    controls
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.r2_url} alt="" className="h-full w-full object-cover" />
                )}
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    statusOf(p) === "hidden"
                      ? "bg-red-700 text-white"
                      : statusOf(p) === "approved"
                        ? "bg-ink text-sand"
                        : "bg-sand-bright text-ink"
                  }`}
                >
                  {statusOf(p)}
                </span>
                {p.featured === 1 && (
                  <span className="absolute right-2 top-2 text-lg text-sand-bright">✦</span>
                )}
              </div>

              <div className="px-2 py-1.5 text-[11px] opacity-70">
                {p.user_name ?? "anonymous"}
              </div>

              <div
                className={`grid grid-cols-4 gap-1 px-2 pb-2 ${busyId === p.id ? "opacity-40" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => act(p.id, "approve")}
                  disabled={busyId !== null}
                  aria-label="Approve"
                  className="rounded-full bg-ink py-2 text-xs font-bold text-sand active:scale-95"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => act(p.id, "hide")}
                  disabled={busyId !== null}
                  aria-label="Hide"
                  className="rounded-full border border-ink/25 py-2 text-xs font-bold active:scale-95"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => act(p.id, p.featured === 1 ? "unfeature" : "feature")}
                  disabled={busyId !== null}
                  aria-label={p.featured === 1 ? "Remove from Iconic Moments" : "Feature as Iconic Moment"}
                  className={`rounded-full py-2 text-xs font-bold active:scale-95 ${
                    p.featured === 1 ? "bg-sand-bright text-ink" : "border border-ink/25"
                  }`}
                >
                  ✦
                </button>
                <button
                  type="button"
                  onClick={() =>
                    confirmDelete === p.id ? act(p.id, "delete") : setConfirmDelete(p.id)
                  }
                  disabled={busyId !== null}
                  aria-label="Delete"
                  className={`rounded-full py-2 text-xs font-bold active:scale-95 ${
                    confirmDelete === p.id
                      ? "bg-red-700 text-white"
                      : "border border-red-700/40 text-red-700"
                  }`}
                >
                  {confirmDelete === p.id ? "Sure?" : "🗑"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WallModeration;
