"use client";

import PosterStudio from "../posters/PosterStudio";
import EventCodes from "../EventCodes";
import PassSettings from "../PassSettings";

/**
 * The Studio's client shell: posters, tickets and pricing on one page, and a
 * link to see what a guest sees. The dangerous switches (phase, doors) live
 * on /loop/admin on purpose.
 *
 * It carried a 463-line Playbook and a notes thread addressed to a promoter
 * who never existed; both went on 2026-09-16.
 */

type StudioSection = { id: string; title: string; blurb: string };

const SECTIONS: Record<"posters" | "tickets" | "pricing", StudioSection> = {
  posters: {
    id: "posters",
    title: "Marketing Studio",
    blurb:
      "Every piece for the volume — poster, flyer, ticket, pass card — from one workbench. The QR sends people to the front door.",
  },
  tickets: {
    id: "tickets",
    title: "Tickets — event codes",
    blurb:
      "Sold passes arrive here from the webhook, numbered. Comp codes are minted here; each opens the night once, for one guest.",
  },
  pricing: {
    id: "pricing",
    title: "Pass sales & pricing",
    blurb: "The checkout link and price behind the Get Pass button. What the poster prints reads from the same setting.",
  },
};

function SectionHeader({ section }: { section: StudioSection }) {
  return (
    <>
      <h2 className="text-sm font-bold uppercase tracking-widest opacity-70">{section.title}</h2>
      <p className="mt-1 text-sm opacity-70">{section.blurb}</p>
    </>
  );
}

export function StudioShell({
  stats,
  eventDetails,
  publicBaseUrl,
}: {
  stats: { sold: number; total: number | null; redeemed: number; codes: number };
  eventDetails: React.ComponentProps<typeof PosterStudio>["eventDetails"];
  /** `loop_settings.public_base_url` — the origin printed QRs are built from. */
  publicBaseUrl?: string | null;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-extrabold">Loop Soul · Studio</h1>
        <a href="/loop/admin" className="rounded-full border border-ink/25 px-4 py-2 text-sm font-bold">
          ← Admin
        </a>
      </div>
      <p className="mt-2 text-sm opacity-70">Everything on this page is the live site.</p>

      {/* The pulse: money · door. Server-rendered, no client fetch. */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-ink/15 bg-ink/5 px-3 py-1.5">
          <b className="tabular-nums">{stats.sold}</b>
          <span className="opacity-70">{stats.total === null ? " sold — no cap" : ` / ${stats.total} passes sold`}</span>
        </span>
        <span className="rounded-full border border-ink/15 bg-ink/5 px-3 py-1.5">
          <b className="tabular-nums">{stats.redeemed}</b>
          <span className="opacity-70"> / {stats.codes} codes entered</span>
        </span>
      </div>

      <a
        href="/loop"
        target="_blank"
        rel="noreferrer"
        className="mt-4 block rounded-2xl border border-ink/15 bg-ink/5 px-5 py-4"
      >
        <span className="block font-bold">See what a guest sees →</span>
        <span className="block text-sm opacity-70">Opens /loop in a new tab, as the public has it right now.</span>
      </a>

      <section className="mt-12" id="posters">
        <SectionHeader section={SECTIONS.posters} />
        <PosterStudio eventDetails={eventDetails} publicBaseUrl={publicBaseUrl} />
      </section>

      <section className="mt-12" id="tickets">
        <SectionHeader section={SECTIONS.tickets} />
        <EventCodes />
      </section>

      <section className="mt-12" id="pricing">
        <SectionHeader section={SECTIONS.pricing} />
        <PassSettings />
      </section>
    </main>
  );
}

export default StudioShell;
