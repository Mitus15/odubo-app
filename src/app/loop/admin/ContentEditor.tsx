"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RunOfShowItem } from "@/lib/loop/content";
import LoopLoader from "@/components/loop/brand/LoopLoader";

type Field = { key: string; label: string; placeholder?: string; wide?: boolean };

/**
 * Generic list editor (mirrors the AnthemControls pattern): edit rows inline,
 * add / remove / reorder, then Save posts the whole list as `{ items }` to
 * `endpoint` and refreshes. Edits stay local until Save so mid-typing isn't
 * persisted. Shared by the Run of Show and the Journal's Iconic Moments.
 */
export function ListEditor<T extends { id: string }>({
  title,
  hint,
  fields,
  initial,
  makeRow,
  addLabel,
  endpoint = "/api/loop/admin/content",
}: {
  title: string;
  hint: string;
  fields: Field[];
  initial: T[];
  makeRow: () => T;
  addLabel: string;
  endpoint?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<T[]>(initial);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function update(i: number, key: string, value: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
    setSaved(false);
  }
  function add() {
    setRows((rs) => [...rs, makeRow()]);
    setSaved(false);
  }
  function remove(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
    setSaved(false);
  }
  function move(i: number, dir: -1 | 1) {
    setRows((rs) => {
      const n = [...rs];
      const j = i + dir;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setSaved(false);
  }
  async function save() {
    setBusy(true);
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: rows }),
    });
    setBusy(false);
    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">{title}</h3>
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-sand disabled:opacity-50"
        >
          {busy ? <LoopLoader size={14} /> : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      <p className="mt-1 text-xs opacity-60">{hint}</p>

      <div className="mt-2 grid gap-2">
        {rows.map((row, i) => (
          <div key={row.id} className="rounded-2xl border border-ink/15 bg-ink/[0.03] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <label
                  key={f.key}
                  className={`block ${f.wide ? "sm:col-span-2" : ""}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                    {f.label}
                  </span>
                  <input
                    type="text"
                    value={(row as Record<string, string>)[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => update(i, f.key, e.target.value)}
                    className="mt-0.5 w-full rounded-xl border border-ink/15 bg-bone/40 px-3 py-2 text-sm outline-none focus:border-ink/40"
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-full bg-ink/10 px-3 py-1.5 text-xs font-bold disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                className="rounded-full bg-ink/10 px-3 py-1.5 text-xs font-bold disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-auto rounded-full bg-ink/5 px-3 py-1.5 text-xs font-bold text-ink/70"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 rounded-full border border-ink/20 px-4 py-2 text-xs font-bold hover:bg-ink/10"
      >
        + Add {addLabel}
      </button>
    </div>
  );
}

export function ContentEditor({ runOfShow }: { runOfShow: RunOfShowItem[] }) {
  return (
    <div className="mt-4">
      <ListEditor<RunOfShowItem>
        title="The Night — run of show"
        hint="One timeline = the program + the lineup. Times are free text (e.g. 9:30). Leave Performer/Role/Instagram blank for pure segments (e.g. Doors). Instagram is a handle (e.g. loopsoul.ca). Rows show in this order."
        fields={[
          { key: "time", label: "Time" },
          { key: "title", label: "Title" },
          { key: "performer", label: "Performer (optional)" },
          { key: "role", label: "Role (optional)" },
          { key: "instagram", label: "Instagram (optional)" },
          { key: "detail", label: "Detail", wide: true },
        ]}
        initial={runOfShow}
        addLabel="row"
        makeRow={() => ({
          id: crypto.randomUUID(),
          time: "",
          title: "",
          detail: "",
          performer: "",
          role: "",
          instagram: "",
        })}
      />
    </div>
  );
}

export default ContentEditor;
