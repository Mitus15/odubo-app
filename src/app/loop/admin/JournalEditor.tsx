"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { JournalIssue, JournalMoment } from "@/lib/loop/journal-store";
import LoopLoader from "@/components/loop/brand/LoopLoader";
import { ListEditor } from "./ContentEditor";

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

      <ListEditor<JournalMoment>
        title="Iconic Moments"
        hint="The issue's photography, in print order. Image URL is a full https:// link (R2 / Stream still). The first row prints as the full-width spotlight; the rest as the grid. Rows without an image are dropped on save."
        fields={[
          { key: "imageUrl", label: "Image URL", wide: true },
          { key: "caption", label: "Caption" },
          { key: "credit", label: "Credit (optional)" },
        ]}
        initial={initialMoments}
        addLabel="moment"
        endpoint="/api/loop/admin/journal"
        makeRow={() => ({
          id: crypto.randomUUID(),
          imageUrl: "",
          caption: "",
          credit: "",
        })}
      />
    </div>
  );
}

export default JournalEditor;
