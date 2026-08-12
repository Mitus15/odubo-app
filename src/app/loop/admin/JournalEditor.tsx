"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { JournalIssue, JournalMoment } from "@/lib/loop/journal-store";
import LoopLoader from "@/components/loop/brand/LoopLoader";

/**
 * The Loop Journal panel — the editorial frame (headline, standfirst, the
 * publish switch) plus the Iconic Moments curation list. Follows the house
 * admin pattern: edits stay local until Save, then POST + router.refresh().
 * The anthem result and night recap sections print themselves from data the
 * event already recorded, so there is nothing to edit for them here.
 */
export function JournalEditor({
  initialIssue,
  initialMoments,
}: {
  initialIssue: JournalIssue | null;
  initialMoments: JournalMoment[];
}) {
  const router = useRouter();
  const [headline, setHeadline] = useState(initialIssue?.headline ?? "");
  const [standfirst, setStandfirst] = useState(initialIssue?.standfirst ?? "");
  const [published, setPublished] = useState(initialIssue?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  async function saveIssue() {
    setBusy(true);
    await fetch("/api/loop/admin/journal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issue: { headline, standfirst, published } }),
    });
    setBusy(false);
    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 grid gap-8">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
            The issue
          </h3>
          <button
            type="button"
            disabled={busy}
            onClick={saveIssue}
            className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-sand disabled:opacity-50"
          >
            {busy ? <LoopLoader size={14} /> : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
        <p className="mt-1 text-xs opacity-60">
          Headline defaults to “The [theme] Issue” when left blank. Publishing
          makes the issue public at /loop/journal and surfaces it on the poster
          + Legacy; drafts are previewable there while you're logged in.
        </p>

        <div className="mt-2 grid gap-2">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
              Headline
            </span>
            <input
              type="text"
              value={headline}
              placeholder="The 1984 Issue"
              onChange={(e) => {
                setHeadline(e.target.value);
                setSaved(false);
              }}
              className="mt-0.5 w-full rounded-xl border border-ink/15 bg-bone/40 px-3 py-2 text-sm outline-none focus:border-ink/40"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
              Standfirst (the line under the headline)
            </span>
            <input
              type="text"
              value={standfirst}
              placeholder="Seventy-five people, one line, one anthem."
              onChange={(e) => {
                setStandfirst(e.target.value);
                setSaved(false);
              }}
              className="mt-0.5 w-full rounded-xl border border-ink/15 bg-bone/40 px-3 py-2 text-sm outline-none focus:border-ink/40"
            />
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => {
                setPublished(e.target.checked);
                setSaved(false);
              }}
              className="h-4 w-4 accent-current"
            />
            Published — live for every visitor
          </label>
        </div>
      </div>

      <MomentsCurator initial={initialMoments} />
    </div>
  );
}

/**
 * Iconic Moments — order and caption the shots already featured on the Wall.
 *
 * There is no "add" and no URL field on purpose. Featuring a shot with the ✦ in
 * Wall moderation is what puts it in the issue; this panel decides how it runs.
 * The magazine used to keep its own pasted-URL list, which meant starring a
 * photo on the Wall did nothing here and the same photo could be curated twice
 * with two different credits.
 */
function MomentsCurator({ initial }: { initial: JournalMoment[] }) {
  const router = useRouter();
  const [items, setItems] = useState<JournalMoment[]>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setItems(next);
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    await fetch("/api/loop/admin/journal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: items.map((m) => ({ id: m.id, photoUid: m.photoUid, caption: m.caption })),
      }),
    });
    setBusy(false);
    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Iconic Moments
        </h3>
        <button
          type="button"
          disabled={busy || items.length === 0}
          onClick={save}
          className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-sand disabled:opacity-50"
        >
          {busy ? <LoopLoader size={14} /> : saved ? "Saved ✓" : "Save order"}
        </button>
      </div>
      <p className="mt-1 text-xs opacity-60">
        Everything starred ✦ on the Wall, in print order. The first runs as the
        full-width spotlight; the rest as the grid. To add or remove one, star or
        un-star it in Wall moderation — credit comes from whoever shot it.
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-ink/20 px-4 py-6 text-center text-sm opacity-60">
          Nothing starred yet. Feature shots with ✦ in Wall moderation and
          they&apos;ll appear here.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {items.map((m, i) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-2xl border border-ink/15 bg-ink/[0.03] p-2"
            >
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-ink/10">
                {m.kind === "video" ? (
                  <video src={m.imageUrl} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
                {i === 0 && (
                  <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-0.5 text-center text-[8px] font-bold uppercase tracking-widest text-sand">
                    Spotlight
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={m.caption}
                  placeholder="Caption (optional)"
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...next[i], caption: e.target.value };
                    setItems(next);
                    setSaved(false);
                  }}
                  className="w-full rounded-xl border border-ink/15 bg-bone/40 px-3 py-2 text-sm outline-none focus:border-ink/40"
                />
                <p className="mt-1 truncate text-[11px] opacity-55">
                  {m.credit ? `Shot by ${m.credit}` : "Uncredited"}
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="rounded-lg border border-ink/15 px-2 py-0.5 text-xs disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="rounded-lg border border-ink/15 px-2 py-0.5 text-xs disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default JournalEditor;
