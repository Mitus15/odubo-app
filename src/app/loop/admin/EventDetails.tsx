"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";

type Details = { title: string; theme: string; venue: string; capacity: string };

const FIELDS: { key: "title" | "theme" | "venue"; label: string; hint: string }[] = [
  { key: "title", label: "Volume / Title", hint: "e.g. Volume 1" },
  { key: "theme", label: "Theme", hint: "e.g. 1984 — shown big on the poster" },
  { key: "venue", label: "Venue", hint: "e.g. Scott's Inn, Kamloops" },
];

const MIN_CAPACITY = 1;
const MAX_CAPACITY = 2000;

/**
 * Edit the event's display details (volume, theme, venue, capacity). Mirrors the
 * save pattern of the other admin panels: edits stay local until Save, which
 * posts the whole set to /api/loop/admin/event and refreshes.
 *
 * Capacity is here rather than in code because the venue owns that number — it
 * is what the poster prints and what the door counts, and a venue revising it
 * days before an announcement must not require a deploy.
 */
export function EventDetails({ initial }: { initial: Details }) {
  const router = useRouter();
  const [values, setValues] = useState<Details>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const capacityNum = Number(values.capacity);
  const capacityValid =
    Number.isInteger(capacityNum) && capacityNum >= MIN_CAPACITY && capacityNum <= MAX_CAPACITY;

  function update(key: keyof Details, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function save() {
    // Guard here as well as on the server: a silently-ignored capacity would
    // look saved while the poster kept printing the old number.
    if (!capacityValid) return;
    setBusy(true);
    await fetch("/api/loop/admin/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, capacity: capacityNum }),
    });
    setBusy(false);
    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4">
      <div className="grid gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
              {f.label}
            </span>
            <input
              type="text"
              value={values[f.key]}
              placeholder={f.hint}
              onChange={(e) => update(f.key, e.target.value)}
              className="mt-0.5 w-full rounded-xl border border-ink/15 bg-bone/40 px-3 py-2 text-sm outline-none focus:border-ink/40"
            />
            <span className="mt-0.5 block text-[11px] opacity-50">{f.hint}</span>
          </label>
        ))}

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
            Capacity
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_CAPACITY}
            max={MAX_CAPACITY}
            value={values.capacity}
            onChange={(e) => update("capacity", e.target.value)}
            aria-invalid={!capacityValid}
            className={`mt-0.5 w-full rounded-xl border bg-bone/40 px-3 py-2 text-sm outline-none ${
              capacityValid ? "border-ink/15 focus:border-ink/40" : "border-red-500/60"
            }`}
          />
          <span className="mt-0.5 block text-[11px] opacity-50">
            {capacityValid
              ? "Passes available. Drives the “X left” counter and the door — confirm it with the venue before announcing."
              : `Enter a whole number between ${MIN_CAPACITY} and ${MAX_CAPACITY}.`}
          </span>
        </label>
      </div>
      <button
        type="button"
        disabled={busy || !capacityValid}
        onClick={save}
        className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-bold text-sand disabled:opacity-50"
      >
        {busy ? <LoopLoader size={14} /> : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}

export default EventDetails;
