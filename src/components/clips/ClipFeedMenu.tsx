"use client";

import { useEffect, useRef } from 'react';

export type SortMode = 'shuffle' | 'newest' | 'oldest' | 'popular';

interface ParentVideo {
  id: number;
  title: string;
}

interface ClipFeedMenuProps {
  open: boolean;
  onClose: () => void;
  parents: ParentVideo[];
  activeParentId: number | null;
  onFilterParent: (parentId: number | null) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'popular', label: 'Popular' },
];

/**
 * ClipFeedMenu — glass panel anchored bottom-left, expands from the clip title.
 * Filter by parent video and sort mode.
 */
export default function ClipFeedMenu({
  open,
  onClose,
  parents,
  activeParentId,
  onFilterParent,
  sortMode,
  onSortChange,
}: ClipFeedMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close from the tap that opened it
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', handler, true);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', handler, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-30 rounded-2xl px-5 py-5 animate-[menuSlideUp_0.25s_ease-out]"
      style={{
        bottom: 'calc(max(env(safe-area-inset-bottom, 16px), 16px) + 70px)',
        left: 16,
        right: 16,
        maxWidth: 340,
        background: 'rgba(20, 19, 18, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Filter by video */}
      {parents.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 mb-2.5">
            Filter
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onFilterParent(null)}
              className={`px-3 py-1.5 rounded-full text-xs transition-all active:scale-95 ${
                activeParentId === null
                  ? 'bg-white/12 text-white/80 border border-white/15'
                  : 'bg-white/[0.03] text-white/35 border border-white/[0.06] hover:text-white/55'
              }`}
            >
              All
            </button>
            {parents.map((p) => (
              <button
                key={p.id}
                onClick={() => onFilterParent(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all active:scale-95 truncate max-w-[140px] ${
                  activeParentId === p.id
                    ? 'bg-white/12 text-white/80 border border-white/15'
                    : 'bg-white/[0.03] text-white/35 border border-white/[0.06] hover:text-white/55'
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort */}
      <div>
        <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 mb-2.5">
          Sort
        </p>
        <div className="flex gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs transition-all active:scale-95 ${
                sortMode === opt.value
                  ? 'bg-white/12 text-white/80 border border-white/15'
                  : 'bg-white/[0.03] text-white/35 border border-white/[0.06] hover:text-white/55'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes menuSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
