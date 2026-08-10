import Link from "next/link";
import ArcedTagline from "@/components/loop/brand/ArcedTagline";
import Lookbook from "@/components/loop/gathering/Lookbook";
import { getCurrentEvent } from "@/lib/loop/hub";
import { isJournalPublished } from "@/lib/loop/journal-server";

/**
 * STATE 3 — Legacy (persistent content hub). The multi-event vault and gated
 * downloads still land in the State 3 build task, but the Lookbook (the theme
 * mood board) and The Loop Journal (the per-volume magazine) live here now.
 * Rendered in "vault mode" (oxblood field, sand ink).
 */
export async function LegacyHome() {
  const event = await getCurrentEvent();
  const published = await isJournalPublished(event.id);

  return (
    <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
      <p className="text-xs uppercase tracking-[0.3em] opacity-70">
        Loop Soul Legacy · The soul of Kamloops, kept
      </p>

      <div className="mt-10">
        <ArcedTagline text="What do you remember?" className="text-sand" />
      </div>

      <section className="mt-12 grid w-full max-w-md grid-cols-1 gap-3 text-left">
        <Link
          href="/loop/journal"
          className="rounded-2xl border border-sand/40 bg-sand/10 px-5 py-4 transition-colors hover:bg-sand/15"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-bold">The Loop Journal</span>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">
              {published ? `Read ${event.title} ↗` : "In print ↗"}
            </span>
          </div>
          <div className="text-sm opacity-70">
            One issue per volume — the anthem, the iconic moments, the night that was.
          </div>
        </Link>

        {[
          ["The Vault", "Explore galleries & jams from every past event."],
          ["Your Downloads", "Saved media — unlocked by your event code."],
        ].map(([title, desc]) => (
          <div
            key={title}
            className="rounded-2xl border border-sand/25 bg-sand/5 px-5 py-4"
          >
            <div className="font-bold">{title}</div>
            <div className="text-sm opacity-70">{desc}</div>
          </div>
        ))}
      </section>

      <section className="mt-14 w-full max-w-2xl text-left">
        <Lookbook />
      </section>
    </main>
  );
}

export default LegacyHome;
