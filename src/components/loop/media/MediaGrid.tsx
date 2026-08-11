"use client";

import type { MediaItem } from "@/lib/loop/media/types";

/**
 * The Loop Soul media grid — one component behind the Wall, your own shots,
 * Iconic Moments and the Legacy Vault. Tiles are poster-shaped (3:4), video
 * tiles carry a Clip badge, featured shots carry the ✦, and the author's name
 * rides the bottom edge on a gradient so it reads over any image.
 */
export function MediaGrid({
  items,
  onOpen,
  columns = 2,
  loading = false,
  empty,
}: {
  items: MediaItem[];
  onOpen: (index: number) => void;
  columns?: 2 | 3;
  loading?: boolean;
  empty?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {Array.from({ length: columns === 3 ? 6 : 4 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[3/4] animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="loop-panel loop-muted rounded-2xl px-5 py-8 text-center text-sm">
        {empty ?? "Nothing here yet."}
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(i)}
          className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)] bg-black text-left"
        >
          {item.kind === "video" ? (
            <>
              <video
                src={item.src}
                preload="metadata"
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-sand">
                Clip
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.src}
              alt={item.caption ?? "Loop Soul shot"}
              loading={i < 8 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          )}

          {item.featured && (
            <span
              className="absolute right-2 top-2 text-lg text-sand-bright drop-shadow"
              aria-label="Iconic Moment"
            >
              ✦
            </span>
          )}
          {item.moderated === 2 && (
            <span className="absolute inset-x-2 top-2 rounded-full bg-red-700/90 px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-widest text-white">
              Hidden
            </span>
          )}
          {item.author && (
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent px-3 pb-2 pt-6 text-xs font-semibold text-bone">
              {item.author}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default MediaGrid;
