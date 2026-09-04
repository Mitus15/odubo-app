"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import type { LoopEvent } from "@/lib/loop/hub";
import type { AnthemState } from "@/lib/loop/anthem-server";
import { priceLabel as formatPrice } from "@/lib/loop/priceLabel";
import { ANTHEM_ENABLED } from "@/lib/loop/content";
import CoverContest from "./CoverContest";
import type { RunOfShowItem } from "@/lib/loop/content";
import Logo from "@/components/loop/brand/Logo";
import ModuleSheet from "@/components/loop/shell/ModuleSheet";
import AnthemBracket from "@/components/loop/anthem/AnthemBracket";
import RunOfShow from "@/components/loop/gathering/RunOfShow";
import GetPassModal from "@/components/loop/gathering/GetPassModal";

/** Mirrors CapacityInfo — unlimited carries null counts on purpose, so a
 *  scarcity line can't render "0 left" for a room with no cap. */
type Capacity =
  | { unlimited: true; sold: number; total: null; remaining: null }
  | { unlimited: false; sold: number; total: number; remaining: number };
type ModuleKey = "anthem" | "night" | "cover";

const MODULES: { key: ModuleKey; label: string; title: string; blurb: string }[] = [
  // Advertising a module that does nothing is worse than not showing it, so
  // the anthem drops out entirely while it is parked (see ANTHEM_ENABLED).
  ...(ANTHEM_ENABLED
    ? [
        {
          key: "anthem" as const,
          label: "Soul Anthem",
          title: "Soul Loop Anthem",
          blurb: "The tournament.",
        },
      ]
    : []),
  // Label vs title on purpose: someone scanning the poster is looking for "the
  // programme", so the button says that; the sheet keeps the brand's own name
  // for the night. The Night has always rendered RUN_OF_SHOW — it was the
  // programme all along, just not findable by that word.
  { key: "night", label: "The Programme", title: "The Night", blurb: "The night, hour by hour." },
  {
    key: "cover",
    label: "Cover Contest",
    title: "The Cover Contest",
    blurb: "Shoot the album cover. $50 if it wins.",
  },
  // Danceyokey is NOT part of Volume 1 (owner, 2026-08-25). The floor moment
  // this volume has is the Loop Soul Line, which lives in the programme rather
  // than needing a module of its own — there is nothing to sign up for.
  // The host console at /loop/admin/danceyokey is untouched for later volumes.
];

/**
 * STATE 1 — The Gathering. This is the page behind the printed poster's QR
 * ("SCAN FOR MORE"), so it opens as that poster — the wordmark, the slogan,
 * the album credit and the figure filling the first viewport — and then it
 * scrolls: everything the poster only had room to hint at, in full, plus every
 * door a guest might need (the pass, the programme, the contest, the store,
 * the lead single, their code). The poster is the cover; the page is the
 * record sleeve's back.
 */
export function GatheringPoster({
  event,
  capacity: initialCapacity,
  anthem,
  runOfShow,
  checkoutUrl = null,
  price = null,
  currency = null,
  dateLabel,
  fullDateLabel,
  timeLabel,
  journalPublished = false,
}: {
  event: LoopEvent;
  capacity: Capacity;
  anthem: AnthemState;
  runOfShow: RunOfShowItem[];
  /** Admin-configured pass checkout link (loop_settings). */
  checkoutUrl?: string | null;
  /** Pass price, shown up front (loop_settings). */
  price?: string | null;
  currency?: string | null;
  /** Server-formatted so the venue's timezone is authoritative. */
  dateLabel: string;
  /** The long form ("Saturday, September 26") for the info section. */
  fullDateLabel: string;
  timeLabel: string;
  /** A published Loop Journal issue makes last volume the pre-phase hype reel. */
  journalPublished?: boolean;
}) {
  const [active, setActive] = useState<ModuleKey | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [capacity, setCapacity] = useState<Capacity>(initialCapacity);

  // Keep the scarcity number fresh — it reads the real issued-code ledger.
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/loop/capacity", { cache: "no-store" });
        if (res.ok) setCapacity((await res.json()) as Capacity);
      } catch {
        /* keep last known */
      }
    };
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  // An unlimited room can never be full — the check has to run through the
  // discriminant, not through a number that would read 0 when uncapped.
  const soldOut = !capacity.unlimited && capacity.remaining <= 0;
  const activeModule = MODULES.find((m) => m.key === active) ?? null;
  // The exact formatter the print kit uses (loopSetting.priceLabel), so the
  // poster on the wall and the front door always say the same thing. An unset
  // or zero price reads "FREE ENTRY" — that is how the door opens.
  const priceLabel = formatPrice(price, currency);
  const isFree = priceLabel === "FREE ENTRY";
  // "Scott's Inn, Kamloops" → "Scott's Inn" on the tight poster line.
  const venueShort = event.venue.split(",")[0];

  const passCta = soldOut
    ? "Join the Waitlist"
    : isFree
      ? "Register · Free"
      : `Get Pass · ${priceLabel}`;

  return (
    <div className="relative mx-auto max-w-md px-5">
      {/* ── The poster: one full viewport, exactly as before ─────────────── */}
      <section className="flex h-[100dvh] flex-col pb-4 pt-5">
        {/* Header: the wordmark alone. The volume/theme block was removed on
            2026-08-25 — the album is the identity, and leading with an edition
            number made the night look like an instalment of something you'd
            missed the start of. The theme survives where it does work: the dress
            code, and the programme. */}
        <header className="flex items-start justify-end">
          <Logo width={116} />
        </header>

        {/* Tagline + credit + silhouette hero. Figure top-anchored so it sits
            right under the credit (no floating gap); the slack collects below. */}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
          {/* The slogan — straight, never arced: the arc asks, straight type
              states (docs/decisions/loop-soul-brand-language.md). Mixed case is
              deliberate — the one line on the piece that invites rather than
              announces. */}
          <div className="loop-display text-4xl font-bold tracking-tight text-ink">
            Come Dance
          </div>
          {/* The printed poster's big line, word for word (see
              docs/decisions/loop-soul-is-the-album.md) — the page a QR scan
              lands on must say what the wall said. */}
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-ink">
            An Album by Mani Odubo
          </div>
          <div className="relative min-h-0 w-full flex-1">
            <Image
              src="/loop/figures/dance.png"
              alt="Loop Soul dancers in silhouette"
              fill
              priority
              unoptimized
              className="object-contain object-top"
            />
          </div>
        </div>

        {/* When and where, in the open — before anyone has to tap anything. The
            PRICE is deliberately not here: it is on the button directly below,
            and printing it twice in the same eyeful just read as a stutter. The
            scarcity count only appears when there is a cap to count against. */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-center">
            {(soldOut || !capacity.unlimited) && (
              <div className="text-sm font-bold uppercase tracking-widest">
                {soldOut ? (
                  "Room is full"
                ) : (
                  <>
                    <span className="tabular-nums">{capacity.remaining}</span> / {capacity.total}{" "}
                    {isFree ? "spots left" : "passes left"}
                  </>
                )}
              </div>
            )}
            <div className="loop-muted mt-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
              {dateLabel} · Doors {timeLabel} · {venueShort}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPassOpen(true)}
            className="w-full rounded-full bg-ink py-4 text-base font-bold text-sand transition-transform active:scale-95"
          >
            {passCta}
          </button>
          {!soldOut && (
            <button
              type="button"
              onClick={() => setPassOpen(true)}
              className="loop-muted -mt-1 text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
            >
              What&apos;s included
            </button>
          )}

          {/* The invitation to scroll — the poster used to be the whole page,
              so the page has to say there is more of it now. An anchor, not
              JS: smooth scrolling comes from CSS and works without hydration. */}
          <a
            href="#the-night"
            onClick={(e) => {
              // The document doesn't scroll — <main> does (root layout), so
              // smooth-scroll the target into view rather than relying on
              // html's scroll-behavior. The href stays as the no-JS fallback.
              e.preventDefault();
              document.getElementById("the-night")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="loop-muted pt-1 text-[10px] font-bold uppercase tracking-[0.3em]"
          >
            The full night ↓
          </a>
        </div>
      </section>

      {/* ── The night, in full — the poster's fine print, given room ──────── */}
      <section id="the-night" className="flex scroll-mt-6 flex-col gap-4 pb-2 pt-6">
        <h2 className="loop-display text-3xl font-bold tracking-tight text-ink">The Night</h2>
        <p className="text-sm leading-relaxed text-ink/85">
          Loop Soul is an album. This night is the first time it&apos;s played anywhere —{" "}
          <span className="font-semibold">Mani Odubo performs the record front to back with the
          band, outdoors in the courtyard</span>, and the whole set is recorded for the release.
          The people in the room are the album&apos;s first audience.
        </p>

        <dl className="flex flex-col divide-y divide-ink/15 rounded-2xl border border-ink/20">
          {(
            [
              ["When", `${fullDateLabel} · Doors ${timeLabel} · The album at 8`],
              ["Where", `${event.venue} — the courtyard, under the open sky`],
              // The theme lives here now — as an instruction, where it works,
              // not as an edition number on the masthead.
              ["Dress code", `${event.theme}. Come dressed for the year.`],
              ["Entry", `${isFree ? "Free" : priceLabel} · 19+ · one pass admits one`],
              ["The table", "Barbecue through the night."],
              [
                "Your code",
                "Registering emails you an event code — your ticket at the door, and your key to the room's app on the night.",
              ],
            ] as [string, string][]
          ).map(([term, detail]) => (
            <div key={term} className="flex gap-4 px-4 py-3">
              <dt className="w-24 shrink-0 text-[10px] font-bold uppercase leading-5 tracking-[0.2em] text-ink/60">
                {term}
              </dt>
              <dd className="text-sm leading-5 text-ink/90">{detail}</dd>
            </div>
          ))}
        </dl>

        {/* Registration closing on the night is the campaign's real urgency —
            truer than any scarcity counter (docs/decisions/loop-soul-is-the-album.md). */}
        <p className="text-xs leading-relaxed text-ink/70">
          One more thing: registration closes on the night and never reopens. Everyone inside
          keeps the record, the gallery, the cover contest and the vote on the tracklist — the
          circle is whoever was there.
        </p>
      </section>

      {/* ── Every door a guest might need ─────────────────────────────────── */}
      <section className="flex flex-col gap-2 pb-6 pt-6">
        <h2 className="loop-display pb-2 text-3xl font-bold tracking-tight text-ink">
          Step Inside
        </h2>

        {/* The lead single first — 1984 is the theme and the dress code, and
            hearing it is the best argument for the night. /music resolves to
            the newest album so this link never learns an id; the album player
            there also carries the stem field — the record you can mix. */}
        <Link
          href="/music"
          className="flex flex-col gap-1 rounded-2xl bg-ink px-5 py-4 text-sand transition-transform active:scale-[0.98]"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-70">
            The Lead Single
          </span>
          <span className="loop-display text-2xl font-bold tracking-tight">1984</span>
          <span className="text-xs leading-relaxed opacity-80">
            Hear it on the album player — where the record also opens as a stem field you mix
            yourself. Listen ↗
          </span>
        </Link>

        {/* Module launchers — same sheets as always, now with a line of why. */}
        {MODULES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setActive(m.key)}
            className="flex flex-col gap-0.5 rounded-2xl border border-ink/20 px-5 py-4 text-left transition-colors hover:bg-ink/10"
          >
            <span className="text-sm font-bold uppercase tracking-wide text-ink">{m.label}</span>
            <span className="text-xs text-ink/70">{m.blurb}</span>
          </button>
        ))}

        <Link
          href="/loop/store"
          className="flex flex-col gap-0.5 rounded-2xl border border-ink/20 px-5 py-4 transition-colors hover:bg-ink/10"
        >
          <span className="text-sm font-bold uppercase tracking-wide text-ink">The Store</span>
          <span className="text-xs text-ink/70">Passes and pieces — wear the year. ↗</span>
        </Link>

        <Link
          href="/loop/code"
          className="flex flex-col gap-0.5 rounded-2xl border border-ink/20 px-5 py-4 transition-colors hover:bg-ink/10"
        >
          <span className="text-sm font-bold uppercase tracking-wide text-ink">
            Find Your Code
          </span>
          <span className="text-xs text-ink/70">
            Already registered? Look up your event code by email. ↗
          </span>
        </Link>

        {journalPublished && (
          <Link
            href="/loop/journal"
            className="flex flex-col gap-0.5 rounded-2xl border border-ink/20 px-5 py-4 transition-colors hover:bg-ink/10"
          >
            <span className="text-sm font-bold uppercase tracking-wide text-ink">The Journal</span>
            <span className="text-xs text-ink/70">The magazine of the last volume. ↗</span>
          </Link>
        )}

        <Link
          href="/loop/legacy"
          className="flex flex-col gap-0.5 rounded-2xl border border-ink/20 px-5 py-4 transition-colors hover:bg-ink/10"
        >
          <span className="text-sm font-bold uppercase tracking-wide text-ink">
            Loop Soul Legacy
          </span>
          <span className="text-xs text-ink/70">Where every volume lives afterwards. ↗</span>
        </Link>

        {/* The ask, restated where the reading ends — nobody should have to
            scroll back up to say yes. */}
        <button
          type="button"
          onClick={() => setPassOpen(true)}
          className="mt-3 w-full rounded-full bg-ink py-4 text-base font-bold text-sand transition-transform active:scale-95"
        >
          {passCta}
        </button>
      </section>

      {/* Footer: Odubo presents · Scott's is the venue partner */}
      <footer className="flex flex-col items-center gap-1.5 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loop/branding/odubo.svg" alt="Odubo — presenter" className="h-10 w-auto" />
        <div className="text-[9px] font-semibold uppercase tracking-[0.3em] opacity-50">
          Venue partner · Scott&apos;s Inn &amp; Suites
        </div>
      </footer>

      {/* Module overlay */}
      <AnimatePresence>
        {activeModule && (
          <ModuleSheet title={activeModule.title} onClose={() => setActive(null)}>
            {ANTHEM_ENABLED && active === "anthem" && <AnthemBracket initial={anthem} />}
            {active === "night" && <RunOfShow items={runOfShow} showHeader={false} />}
            {active === "cover" && <CoverContest />}
          </ModuleSheet>
        )}
      </AnimatePresence>

      {passOpen && (
        <GetPassModal
          capacity={capacity}
          checkoutUrl={checkoutUrl}
          price={price}
          currency={currency}
          theme={event.theme}
          venue={event.venue}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          onClose={() => setPassOpen(false)}
        />
      )}
    </div>
  );
}

export default GatheringPoster;
