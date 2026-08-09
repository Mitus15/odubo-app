"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

/**
 * A full-screen module overlay that slides up over the poster. The poster
 * itself never scrolls — modules open here, scroll internally, and close back
 * to the poster. Close via the X button (no drag-to-close, per house UX rules).
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="loop-glass fixed inset-0 z-50 flex flex-col"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
    >
      <header className="flex items-center justify-between px-5 py-4">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-2 text-2xl leading-none hover:bg-ink/10"
        >
          ×
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-10">{children}</div>
    </motion.div>
  );
}

export default ModuleSheet;
