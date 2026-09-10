"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import type { LoopEvent } from "@/lib/loop/hub";
import type { AnthemState } from "@/lib/loop/anthem-server";
import { priceLabel as formatPrice } from "@/lib/loop/priceLabel";
import { ANTHEM_ENABLED, EVENT_CREDITS } from "@/lib/loop/content";
import CoverContest from "./CoverContest";
import type { RunOfShowItem } from "@/lib/loop/content";
import Logo from "@/components/loop/brand/Logo";
import ModuleSheet from "@/components/loop/shell/ModuleSheet";
import AnthemBracket from "@/components/loop/anthem/AnthemBracket";
import RunOfShow from "@/components/loop/gathering/RunOfShow";
import GetPassModal from "@/components/loop/gathering/GetPassModal";
import TheSingle from "@/components/loop/gathering/TheSingle";
import type { FeaturedSingle } from "@/lib/loop/single";
import type { ProductSummary } from "@/lib/store/types";
import PiecesRail from "@/components/loop/store/PiecesRail";

/** Mirrors CapacityInfo — unlimited carries null counts on purpose, so a
 *  scarcity line can't render "0 left" for a room with no cap. */
type Capacity =
  | { unlimited: true; sold: number; total: null; remaining: null }
  | { unlimited: false; sold: number; total: number; remaining: number };
type ModuleKey = "anthem" | "night" | "cover";

const MODULES: { key: ModuleKey; label: string; title: string }[] = [
  // Advertising a module that does nothing is worse than not showing it, so
  // the anthem drops out entirely while it is parked (see ANTHEM_ENABLED).
  ...(ANTHEM_ENABLED
    ? [
        {
          key: "anthem" as const,
          label: "Soul Anthem",
          title: "Soul Loop Anthem",
        },
      ]
    : []),
  // Label vs title on purpose: someone scanning the poster is looking for "the
  // programme", so the button says that; the sheet keeps the brand's own name
  // for the night. The Night has always rendered RUN_OF_SHOW — it was the
  // programme all along, just not findable by that word.
  { key: "night", label: "The Programme", title: "The Night" },
  { key: "cover", label: "Cover Contest", title: "The Cover Contest" },
  // Danceyokey is NOT part of Volume 1 (owner, 2026-08-25). The floor moment
  // this volume has is the Loop Soul Line, which lives in the programme rather
  // than needing a module of its own — there is nothing to sign up for.
  // The host console at /loop/admin/danceyokey is untouched for later volumes.
];

/**
 * STATE 1 — The Gathering, as a single POSTER:
 *   • real Loop Soul logo (top-right)
 *   • silhouette hero + arced tagline         • Scott's Inn (bottom)
 *   • compact pass counter + Get Pass CTA     • the Pieces rail (the shelf)
 *   • modules that open/close
 * Everything else (Anthem, The Night) opens in a ModuleSheet over the poster.
 * The poster fills one viewport on any phone tall enough to hold it; on short
 * ones it grows just past the fold rather than crush the figure.
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
  timeLabel,
  single = null,
  journalPublished = false,
  pieces = [],
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
  timeLabel: string;
  /** The track behind the flyer's QR. Null when none is playable. */
  single?: FeaturedSingle | null;
  /** A published Loop Journal issue makes last volume the pre-phase hype reel. */
  journalPublished?: boolean;
  /** Merch from the loop-soul collection, pass excluded. Empty hides the rail. */
  pieces?: ProductSummary[];
}) {
  const [active, setActive] = useState<ModuleKey | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [singleOpen, setSingleOpen] = useState(false);

  // The QR promises a song, so a first-time arrival gets the song — not a
  // poster with the song filed behind a button. Anyone who has already been
  // handed it lands on the poster instead, and a gifted link (?from=) always
  // opens it, because that visitor was sent for exactly one reason.
  // Stable identities, so memo(TheSingle) actually holds: without these the
  // 15-second capacity poll below would hand the overlay three new functions
  // every tick and re-render the whole thing for nothing.
  const closeSingle = useCallback(() => setSingleOpen(false), []);
  const openCoverContest = useCallback(() => {
    setSingleOpen(false);
    setActive("cover");
  }, []);
  const openPassFromSingle = useCallback(() => {
    setSingleOpen(false);
    setPassOpen(true);
  }, []);

  useEffect(() => {
    if (!single) return;
    try {
      const gifted = new URLSearchParams(window.location.search).has("from");
      if (gifted || !localStorage.getItem("loop.single.seen"))
        setSingleOpen(true);
    } catch {
      setSingleOpen(true);
    }
  }, [single]);
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

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-5 pt-5">
      {/* Header: the wordmark alone. The volume/theme block was removed on
          2026-08-25 — the album is the identity, and leading with an edition
          number made the night look like an instalment of something you'd
          missed the start of. The theme survives where it does work: the dress
          code, and the programme. */}
      <header className="flex items-start justify-end">
        <Logo width={116} />
      </header>

      {/* Tagline + silhouette hero. Figure top-anchored so it sits right under
          the tagline (no floating gap); the slack collects below the figure. */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
        {/* The credit block, set exactly as the printed piece sets it — same
            strings (EVENT_CREDITS), same face (Jost 500), same tracking, same
            opacities, one line each. The earlier two-line lockup put the name
            in bold display at 4xl, which is the opposite treatment: the poster
            deliberately does NOT shout the name, it states the record in a
            single wide-tracked run and hangs the feature credit beneath it at
            about two thirds. A stranger holding the flyer while looking at the
            page has to see one design, not two.

            Sizes are clamped rather than fixed because the run cannot wrap:
            20.78em of tracked capitals needs 312px at 15px and still fits a
            320px phone at 12.8px. `pl-[…em]` cancels CSS's trailing
            letter-space, which would otherwise push the centred line half a
            track to the left of where the engine centres it. */}
        <div className="flex w-full flex-col items-center">
          <div className="loop-display whitespace-nowrap pl-[0.34em] text-center text-[clamp(12px,4vw,15px)] font-medium uppercase tracking-[0.34em] text-ink/85">
            {EVENT_CREDITS.record}
          </div>
          <div className="loop-display mt-1.5 whitespace-nowrap pl-[0.3em] text-center text-[clamp(8px,2.7vw,10px)] font-medium uppercase tracking-[0.3em] text-ink/60">
            {EVENT_CREDITS.feature}
          </div>
        </div>
        {/* The figure takes the slack, but never less than a figure's worth:
            with the Pieces rail on the page a 667px phone would otherwise
            leave it a 35px sliver. Below that floor the poster grows past the
            viewport and the root <main> scrolls the last few lines. */}
        <div className="relative min-h-[140px] w-full flex-1">
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
                  <span className="tabular-nums">{capacity.remaining}</span> /{" "}
                  {capacity.total} {isFree ? "spots left" : "passes left"}
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
          {soldOut
            ? "Join the Waitlist"
            : isFree
              ? "Register · Free"
              : `Get Pass · ${priceLabel}`}
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

        {/* The shelf, right after the pass: the sell comes before the
            navigation. Type and a hairline only — the pass button above stays
            the one drawn shape on the poster. */}
        <PiecesRail pieces={pieces} />

        {/* Module launchers */}
        <nav className="grid w-full grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
          {/* First in the grid: it is the one thing the flyer actually
              promised, so it outranks the programme and the contest. */}
          {single && (
            <button
              type="button"
              onClick={() => setSingleOpen(true)}
              className="rounded-2xl border border-ink/20 py-3 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-ink/10"
            >
              Play {single.title}
            </button>
          )}
          {MODULES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActive(m.key)}
              className="rounded-2xl border border-ink/20 py-3 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-ink/10"
            >
              {m.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Footer: Odubo presents · Scott's is the venue partner + Legacy access */}
      <footer className="mt-5 flex flex-col items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loop/branding/odubo.svg"
          alt="Odubo — presenter"
          className="h-10 w-auto"
        />
        <div className="text-[9px] font-semibold uppercase tracking-[0.3em] opacity-50">
          Venue partner · Scott&apos;s Inn &amp; Suites
        </div>
        <div className="flex items-center gap-5">
          {journalPublished && (
            <Link
              href="/loop/journal"
              className="text-[10px] font-semibold uppercase tracking-[0.3em] opacity-50 hover:opacity-90"
            >
              The Journal ↗
            </Link>
          )}
          <Link
            href="/loop/legacy"
            className="text-[10px] font-semibold uppercase tracking-[0.3em] opacity-50 hover:opacity-90"
          >
            Loop Soul Legacy ↗
          </Link>
        </div>
      </footer>

      {/* Module overlay */}
      <AnimatePresence>
        {activeModule && (
          <ModuleSheet
            title={activeModule.title}
            onClose={() => setActive(null)}
          >
            {ANTHEM_ENABLED && active === "anthem" && (
              <AnthemBracket initial={anthem} />
            )}
            {active === "night" && (
              <RunOfShow items={runOfShow} showHeader={false} />
            )}
            {active === "cover" && <CoverContest />}
          </ModuleSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {single && singleOpen && (
          <TheSingle
            single={single}
            onClose={closeSingle}
            onCoverContest={openCoverContest}
            onGetPass={openPassFromSingle}
          />
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
