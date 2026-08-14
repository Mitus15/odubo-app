"use client";

import { useState } from "react";
import type { LoopNote } from "@/lib/loop/notes";
import PosterStudio from "../posters/PosterStudio";
import EventCodes from "../EventCodes";
import PassSettings from "../PassSettings";
import NotesBoard from "../NotesBoard";
import NoteHere from "../NoteHere";
import PlaybookModal, { type PlaybookFacts, type PlaybookTab } from "./PlaybookModal";

/**
 * The Promoter Studio's client shell — one page holding everything the
 * promoter does. The working tools are the page; the documentation is the
 * tabbed Playbook modal, one tap away and deep-linked per section ("More →").
 * The only navigation away from here is to /loop itself, to see what a guest
 * sees. The dangerous switches (phase, doors) deliberately do not exist on
 * this page.
 */

type StudioSection = {
  id: string;
  title: string;
  blurb: string;
  playbookTab: PlaybookTab;
};

const SECTIONS: Record<"posters" | "tickets" | "pricing", StudioSection> = {
  posters: {
    id: "posters",
    title: "Posters & assets",
    blurb:
      "Build and export finished artwork — print, feed, story, and a print-shop file with bleed + crop marks. The QR on every poster points people at the app.",
    playbookTab: "push",
  },
  tickets: {
    id: "tickets",
    title: "Tickets — event codes",
    blurb:
      "Each code is one real ticket: it opens the door and the in-app room once. Generate only what you'll physically hand out — comps never count as sales.",
    playbookTab: "money",
  },
  pricing: {
    id: "pricing",
    title: "Pass sales & pricing",
    blurb:
      "The checkout link and price behind the Get Pass button. $20 CAD is a working price, explicitly TBD — this is where your opinion is most wanted.",
    playbookTab: "money",
  },
};

function SectionHeader({
  section,
  onMore,
}: {
  section: StudioSection;
  onMore: (tab: PlaybookTab) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
          {section.title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onMore(section.playbookTab)}
            className="rounded-full bg-ink/10 px-3 py-1 text-[11px] font-bold"
          >
            More →
          </button>
          <NoteHere topic={section.title} />
        </div>
      </div>
      <p className="mt-1 text-sm opacity-70">{section.blurb}</p>
    </>
  );
}

export function StudioShell({
  facts,
  stats,
  notes,
  eventDetails,
}: {
  facts: PlaybookFacts;
  stats: { sold: number; total: number; redeemed: number; codes: number; anthemEntries: number };
  notes: LoopNote[];
  eventDetails: { title: string; theme: string; venue: string; dateLabel: string; passes?: string };
}) {
  const [playbookTab, setPlaybookTab] = useState<PlaybookTab | null>(null);

  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString("en-CA", {
          timeZone: "America/Vancouver",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-extrabold">Loop Soul · Promoter Studio</h1>
      </div>
      <p className="mt-2 text-sm opacity-70">
        Your workspace — everything you&rsquo;ll touch lives on this one page, and all
        of it is the live production site. Sign what you post.
      </p>

      {/* The pulse: money · door · engagement. Server-rendered, no client fetch. */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-ink/15 bg-ink/5 px-3 py-1.5">
          <b className="tabular-nums">{stats.sold}</b>
          <span className="opacity-70"> / {stats.total} passes sold</span>
        </span>
        <span className="rounded-full border border-ink/15 bg-ink/5 px-3 py-1.5">
          <b className="tabular-nums">{stats.redeemed}</b>
          <span className="opacity-70"> / {stats.codes} codes redeemed</span>
        </span>
        <span className="rounded-full border border-ink/15 bg-ink/5 px-3 py-1.5">
          <b className="tabular-nums">{stats.anthemEntries}</b>
          <span className="opacity-70"> anthem entries</span>
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPlaybookTab("start")}
          className="rounded-2xl border border-ink bg-ink px-5 py-4 text-left text-sand"
        >
          <span className="block font-bold">Open the Playbook</span>
          <span className="block text-sm opacity-80">
            The whole picture, tabbed — start here, end on the 15-minute tour.
          </span>
        </button>
        <a
          href="/loop"
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-ink/15 bg-ink/5 px-5 py-4"
        >
          <span className="block font-bold">See what a guest sees →</span>
          <span className="block text-sm opacity-70">
            Opens /loop in a new tab — the site as the public has it right now.
          </span>
        </a>
      </div>

      <section className="mt-12" id="posters">
        <SectionHeader section={SECTIONS.posters} onMore={setPlaybookTab} />
        <PosterStudio eventDetails={eventDetails} />
      </section>

      <section className="mt-12" id="tickets">
        <SectionHeader section={SECTIONS.tickets} onMore={setPlaybookTab} />
        <EventCodes />
      </section>

      <section className="mt-12" id="pricing">
        <SectionHeader section={SECTIONS.pricing} onMore={setPlaybookTab} />
        <PassSettings />
      </section>

      <section className="mt-12" id="notes">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">
            The thread
          </h2>
          <NoteHere topic="General" />
        </div>
        <p className="mt-1 text-sm opacity-70">
          Our running conversation — ideas, pushback, questions, anything. Tap
          &ldquo;Note this ✎&rdquo; on any section (or Playbook tab) to attach a note
          to it.
        </p>

        <NotesBoard />

        {notes.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ink/30 bg-ink/[0.03] p-4 text-center text-sm opacity-70">
            Nothing here yet — the first note starts the thread.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-2xl border border-ink/15 bg-ink/5 px-5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <b>{n.author}</b>
                  {n.topic && (
                    <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                      {n.topic}
                    </span>
                  )}
                  <span className="ml-auto text-xs opacity-55">{fmtWhen(n.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PlaybookModal
        tab={playbookTab}
        onSelectTab={setPlaybookTab}
        onClose={() => setPlaybookTab(null)}
        facts={facts}
      />
    </main>
  );
}

export default StudioShell;
