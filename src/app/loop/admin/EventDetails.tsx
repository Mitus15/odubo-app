"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";

type Details = { title: string; theme: string; venue: string };

const FIELDS: { key: keyof Details; label: string; hint: string }[] = [
  { key: "title", label: "Volume / Title", hint: "e.g. Volume 1" },
  { key: "theme", label: "Theme", hint: "e.g. 1984 — shown big on the poster" },
  { key: "venue", label: "Venue", hint: "e.g. Scott's Inn, Kamloops" },
];

/**
 * Edit the event's display details (theme, volume, venue). Mirrors the save
 * pattern of the other admin panels: edits stay local until Save, which posts
 * the whole set to /api/admin/event and refreshes so the page reflects it.
 */
export function EventDetails({ initial }: { initial: Details }) {
  const router = useRouter();
  const [values, setValues] = useState<Details>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  function update(key: keyof Details, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    await fetch("/api/loop/admin/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
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
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-bold text-sand disabled:opacity-50"
      >
        {busy ? <LoopLoader size={14} /> : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}

export default EventDetails;
