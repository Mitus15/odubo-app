"use client";

import { useCallback, useEffect, useState } from "react";
import { listItems, deleteItem, type GalleryItem } from "@/lib/loop/pose/gallery";
import { postToWall, savedWallName } from "@/lib/loop/wall/client";

/**
 * On-device gallery — the stills and clips saved from Photo/Video mode
 * (IndexedDB). View, share, or delete. In the gated Portal (`wallEnabled`)
 * each item can also be posted to the Wall — the room's shared gallery.
 */
export function PoseGallery({
  refreshKey,
  wallEnabled = false,
}: {
  refreshKey?: number;
  wallEnabled?: boolean;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [wallState, setWallState] = useState<Record<string, "posting" | "posted">>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listItems();
    setItems(list);
    setUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      const next: Record<string, string> = {};
      for (const it of list) next[it.id] = URL.createObjectURL(it.blob);
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    return () => setUrls((prev) => { Object.values(prev).forEach((u) => URL.revokeObjectURL(u)); return {}; });
    // reload when a new item is saved (refreshKey bumps)
  }, [load, refreshKey]);

  async function remove(id: string) {
    await deleteItem(id);
    await load();
  }

  async function post(it: GalleryItem) {
    if (wallState[it.id]) return;
    setWallState((s) => ({ ...s, [it.id]: "posting" }));
    setError(null);
    try {
      const ext = it.kind === "video" ? "webm" : "jpg";
      await postToWall(it.blob, {
        fileName: `loop-soul.${ext}`,
        userName: savedWallName() || null,
      });
      setWallState((s) => ({ ...s, [it.id]: "posted" }));
    } catch (e) {
      setError((e as Error).message);
      setWallState((s) => {
        const next = { ...s };
        delete next[it.id];
        return next;
      });
    }
  }

  async function share(it: GalleryItem) {
    const ext = it.kind === "video" ? "mp4" : "jpg";
    const file = new File([it.blob], `loop-soul.${ext}`, { type: it.mime });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Loop Soul" });
        return;
      } catch {
        /* cancelled → fall through to download */
      }
    }
    const a = document.createElement("a");
    a.href = urls[it.id];
    a.download = `loop-soul-${it.createdAt}.${ext}`;
    a.click();
  }

  if (loading) {
    return <p className="py-10 text-center text-sm opacity-60">Loading your gallery…</p>;
  }
  if (!items.length) {
    return (
      <p className="py-10 text-center text-sm opacity-60">
        Nothing saved yet. Make a poster or a clip and it lands here — on this device.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {error && (
        <p className="w-full rounded-2xl border border-sand/30 bg-ink-soft px-4 py-3 text-center text-sm text-sand">
          {error}
        </p>
      )}
      <div className="grid w-full grid-cols-2 gap-3">
      {items.map((it) => (
        <div key={it.id} className="relative overflow-hidden rounded-2xl border border-sand/20 bg-black">
          {it.kind === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={urls[it.id]} className="aspect-[3/4] w-full object-cover" muted loop playsInline autoPlay />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[it.id]} alt="Saved Loop Soul" className="aspect-[3/4] w-full object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-ink/80 to-transparent p-2">
            {wallEnabled && (
              <button
                type="button"
                onClick={() => post(it)}
                disabled={!!wallState[it.id]}
                className="rounded-full bg-sand-bright px-3 py-1 text-[11px] font-bold text-ink active:scale-95 disabled:opacity-70"
              >
                {wallState[it.id] === "posted"
                  ? "On the Wall ✦"
                  : wallState[it.id] === "posting"
                    ? "Posting…"
                    : "Wall"}
              </button>
            )}
            <button
              type="button"
              onClick={() => share(it)}
              className="rounded-full bg-sand px-3 py-1 text-[11px] font-bold text-ink active:scale-95"
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => remove(it.id)}
              aria-label="Delete"
              className="rounded-full border border-bone/30 px-3 py-1 text-[11px] font-bold text-bone/80 active:scale-95"
            >
              Delete
            </button>
          </div>
          {it.kind === "video" && (
            <span className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-sand">
              Clip
            </span>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}

export default PoseGallery;
