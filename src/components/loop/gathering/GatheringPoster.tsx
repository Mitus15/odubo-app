"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import type { LoopEvent } from "@/lib/loop/hub";
import type { AnthemState } from "@/lib/loop/anthem-server";
import type { RunOfShowItem } from "@/lib/loop/content";
import Logo from "@/components/loop/brand/Logo";
import ModuleSheet from "@/components/loop/shell/ModuleSheet";
import AnthemBracket from "@/components/loop/anthem/AnthemBracket";
import RunOfShow from "@/components/loop/gathering/RunOfShow";
import GetPassModal from "@/components/loop/gathering/GetPassModal";
import DanceyokeyPanel from "@/components/loop/danceyokey/DanceyokeyPanel";

type Capacity = { total: number; sold: number; remaining: number };
type ModuleKey = "anthem" | "night" | "danceyokey";

const MODULES: { key: ModuleKey; label: string; title: string }[] = [
  { key: "anthem", label: "Soul Anthem", title: "Soul Loop Anthem" },
  { key: "night", label: "The Night", title: "The Night" },
  { key: "danceyokey", label: "Danceyokey", title: "Danceyokey" },
];

/**
 * STATE 1 — The Gathering, as a single non-scrolling POSTER:
 *   • real Loop Soul logo (top-right)         • Volume + Theme (top-left)
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

  const soldOut = capacity.remaining <= 0;
  const activeModule = MODULES.find((m) => m.key === active) ?? null;
  const priceLabel = price ? `$${Number(price).toFixed(0)}` : null;
  // "Scott's Inn, Kamloops" → "Scott's Inn" on the tight poster line.
  const venueShort = event.venue.split(",")[0];

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col px-5 pb-5 pt-5">
      {/* Header: volume + theme (left), real logo (right) */}
      <header className="flex items-start justify-between">
        <div className="leading-none">
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-70">
            {event.title}
          </div>
          <div className="mt-1 text-3xl font-black tracking-tight">{event.theme}</div>
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-60">Theme</div>
        </div>
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

      {/* The offer, in the open: price, scarcity, when and where — before
          anyone has to tap anything. */}
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <div className="text-sm font-bold uppercase tracking-widest">
            {soldOut ? (
              "Room is full"
            ) : (
              <>
                {priceLabel ? <>{priceLabel} · </> : null}
                <span className="tabular-nums">{capacity.remaining}</span> / {capacity.total}{" "}
                passes left
              </>
            )}
          </div>
          <div className="loop-muted mt-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
            {dateLabel} · Doors {timeLabel} · {venueShort}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPassOpen(true)}
          className="w-full rounded-full bg-ink py-4 text-base font-bold text-sand transition-transform active:scale-95"
        >
          {soldOut ? "Join the Waitlist" : `Get Pass${priceLabel ? ` · ${priceLabel}` : ""}`}
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
            {active === "anthem" && <AnthemBracket initial={anthem} />}
            {active === "night" && <RunOfShow items={runOfShow} showHeader={false} />}
            {active === "danceyokey" && <DanceyokeyPanel />}
          </ModuleSheet>
        )}
      </AnimatePresence>

      {passOpen && (
        <GetPassModal
          capacity={capacity}
          checkoutUrl={checkoutUrl}
          price={price}
          currency={currency}
          eventTitle={event.title}
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
