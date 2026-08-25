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

const MODULES: { key: ModuleKey; label: string; title: string }[] = [
  // Advertising a module that does nothing is worse than not showing it, so
  // the anthem drops out entirely while it is parked (see ANTHEM_ENABLED).
  ...(ANTHEM_ENABLED
    ? [{ key: "anthem" as const, label: "Soul Anthem", title: "Soul Loop Anthem" }]
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
 * STATE 1 — The Gathering, as a single non-scrolling POSTER:
 *   • real Loop Soul logo (top-right)
 *   • silhouette hero + arced tagline         • Scott's Inn (bottom)
 *   • compact pass counter + Get Pass CTA     • modules that open/close
 * Everything else (Anthem, The Night) opens in a ModuleSheet over the poster,
 * so the base page itself never scrolls.
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

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col px-5 pb-5 pt-5">
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
        {/* The slogan — straight, never arced: the arc asks, straight type
            states (docs/decisions/loop-soul-brand-language.md). Mixed case is
            deliberate — the one line on the piece that invites rather than
            announces. */}
        <div className="loop-display text-4xl font-bold tracking-tight text-ink">
          Come Dance
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
          {soldOut ? "Join the Waitlist" : isFree ? "Register · Free" : `Get Pass · ${priceLabel}`}
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

        {/* Module launchers */}
        <nav className="grid w-full grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
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
        <img src="/loop/branding/odubo.svg" alt="Odubo — presenter" className="h-10 w-auto" />
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
