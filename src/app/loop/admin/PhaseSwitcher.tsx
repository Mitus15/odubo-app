"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { EventPhase } from "@/lib/loop/hub";
import LoopLoader from "@/components/loop/brand/LoopLoader";

const PHASES: { value: EventPhase; label: string; hint: string }[] = [
  { value: "pre", label: "The Gathering", hint: "Pre-event · sell passes, vote, hype" },
  { value: "live", label: "The Portal", hint: "Live · in-room, code-gated" },
  { value: "archived", label: "Legacy", hint: "After · folded into the vault" },
];

export function PhaseSwitcher({ current }: { current: EventPhase }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState<EventPhase | null>(null);

  async function setPhase(phase: EventPhase) {
    setSaving(phase);
    await fetch("/api/loop/admin/phase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase }),
    });
    setSaving(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 grid gap-3">
      {PHASES.map((p) => {
        const active = p.value === current;
        return (
          <button
            key={p.value}
            type="button"
            disabled={pending || saving !== null}
            onClick={() => setPhase(p.value)}
            className={[
              "flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-colors",
              active
                ? "border-ink bg-ink text-sand"
                : "border-ink/15 bg-ink/5 hover:bg-ink/10",
            ].join(" ")}
          >
            <span>
              <span className="font-bold">{p.label}</span>
              <span className="block text-sm opacity-70">{p.hint}</span>
            </span>
            {saving === p.value ? (
              <LoopLoader size={28} />
            ) : active ? (
              <span className="text-xs font-bold uppercase tracking-widest">Live</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default PhaseSwitcher;
