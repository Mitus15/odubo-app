"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Open doors — let everyone into the room without a code. Two uses: building
 * and testing the in-room experience without burning codes, and nights that
 * are genuinely open. Sits next to the phase switch because it's the same kind
 * of decision, and it's loud about being on so it can't be forgotten.
 */
export function DoorsToggle() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/loop/admin/doors", { cache: "no-store" });
      if (res.ok) setOpen((await res.json()).open);
    } catch {
      /* leave unknown */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/loop/admin/doors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ open: !open }),
      });
      if (res.ok) setOpen((await res.json()).open);
    } finally {
      setBusy(false);
    }
  }

  if (open === null) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`w-full rounded-2xl px-5 py-4 text-left transition-transform active:scale-[0.99] disabled:opacity-50 ${
          open ? "bg-ink text-sand" : "border border-ink/20 bg-ink/5"
        }`}
      >
        <span className="block text-sm font-bold">
          {open ? "Doors are OPEN — no code needed" : "Doors closed — code required"}
        </span>
        <span className={`block text-xs ${open ? "opacity-80" : "opacity-70"}`}>
          {open
            ? "Anyone who opens the app is treated as a pass-holder. Tap to require codes again."
            : "Only redeemed codes get in. Tap to open the room to everyone (testing, or an open night)."}
        </span>
      </button>
    </div>
  );
}

export default DoorsToggle;
