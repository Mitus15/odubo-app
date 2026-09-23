"use client";

import { useState } from "react";

/** Copies one caption. The words are on the page too, for long-press. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* long-press the text instead */
        }
      }}
      className="min-h-[44px] shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
    >
      {done ? "Copied" : label}
    </button>
  );
}

export default CopyButton;
