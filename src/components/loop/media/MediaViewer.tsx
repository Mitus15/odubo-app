"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/loop/media/types";

export type ViewerAction = {
  label: string;
  onClick: (item: MediaItem) => void | Promise<void>;
  /** Renders as the filled primary button. */
  primary?: boolean;
  /** Renders in the destructive tone with a confirm tap. */
  danger?: boolean;
};

/**
 * Full-screen media viewer — one component for the Wall, your own shots, and
 * the Legacy Vault. Swipe or arrow between items, X to close (never
 * drag-to-close, per house rules), and a caller-supplied action rail so the
 * same viewer serves guests (share, save) and admins (feature, hide, delete).
 */
export function MediaViewer({
  items,
  index,
  onIndexChange,
  onClose,
  actions = [],
}: {
  items: MediaItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  actions?: ViewerAction[];
}) {
  const item = items[index];
  const touchStart = useRef<number | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Lock the page behind the viewer.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < items.length - 1) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndexChange]);

  // Reset a pending confirm when the item changes.
  useEffect(() => setConfirming(null), [index]);

  if (!item) return null;

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (start === null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) < 50) return;
    if (dx > 0 && index > 0) onIndexChange(index - 1);
    if (dx < 0 && index < items.length - 1) onIndexChange(index + 1);
  }

  async function run(action: ViewerAction) {
    if (action.danger && confirming !== action.label) {
      setConfirming(action.label);
      return;
    }
    setBusy(true);
    try {
      await action.onClick(item);
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-ink/95 backdrop-blur-md"
      onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-bone">
            {item.author ?? (item.local ? "On your device" : "")}
          </div>
          <div className="text-[11px] text-bone/60 tabular-nums">
            {index + 1} / {items.length}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bone/10 text-xl font-bold text-bone"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        {item.kind === "video" ? (
          <video
            src={item.src}
            controls
            autoPlay
            loop
            playsInline
            className="max-h-full max-w-full rounded-2xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt={item.caption ?? "Loop Soul shot"}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        )}
      </div>

      {item.caption && (
        <p className="px-6 pt-2 text-center text-sm text-bone/80">{item.caption}</p>
      )}

      <div className="flex items-center gap-2 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3">
        <button
          type="button"
          onClick={() => index > 0 && onIndexChange(index - 1)}
          disabled={index === 0}
          aria-label="Previous"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-bone/25 text-lg text-bone disabled:opacity-25"
        >
          ‹
        </button>

        <div className="flex flex-1 gap-2">
          {actions.map((action) => {
            const isConfirming = confirming === action.label;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => run(action)}
                disabled={busy}
                className={`h-12 flex-1 rounded-full text-sm font-bold transition-transform active:scale-95 disabled:opacity-50 ${
                  action.primary
                    ? "bg-sand text-ink"
                    : action.danger
                      ? isConfirming
                        ? "bg-red-700 text-white"
                        : "border border-red-400/50 text-red-300"
                      : "border border-bone/25 text-bone"
                }`}
              >
                {isConfirming ? "Sure?" : action.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => index < items.length - 1 && onIndexChange(index + 1)}
          disabled={index >= items.length - 1}
          aria-label="Next"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-bone/25 text-lg text-bone disabled:opacity-25"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default MediaViewer;
