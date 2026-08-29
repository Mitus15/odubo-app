"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef } from "react";

/**
 * A full-screen module overlay that slides up over the poster. The poster
 * itself never scrolls — modules open here, scroll internally, and close back
 * to the poster. Close via the X button (no drag-to-close, per house UX rules).
 *
 * Announced as a real dialog and traps focus. It already handled Escape, but a
 * keyboard user could tab straight through it into the poster behind — which
 * is exactly the surface this sheet exists to cover.
 */
export function ModuleSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="loop-glass fixed inset-0 z-50 flex flex-col outline-none"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
    >
      <header className="flex items-center justify-between border-b border-ink/15 px-5 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <h2 id={titleId} className="text-xl font-extrabold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none hover:bg-ink/10"
        >
          ×
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)] pt-4">
        {children}
      </div>
    </motion.div>
  );
}

export default ModuleSheet;
