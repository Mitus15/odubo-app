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

/** Sheet config only — the launchers are typeset rows in the index below. */
const MODULES: { key: ModuleKey; title: string }[] = [
  // Advertising a module that does nothing is worse than not showing it, so
  // the anthem drops out entirely while it is parked (see ANTHEM_ENABLED).
  ...(ANTHEM_ENABLED ? [{ key: "anthem" as const, title: "Soul Loop Anthem" }] : []),
  { key: "night", title: "The Night" },
  { key: "cover", title: "The Cover Contest" },
  // Danceyokey is NOT part of Volume 1 (owner, 2026-08-25). The floor moment
  // this volume has is the Loop Soul Line, which lives in the programme rather
  // than needing a module of its own — there is nothing to sign up for.
  // The host console at /loop/admin/danceyokey is untouched for later volumes.
];

/** Section label — the playbill's only heading device. The content lines get
 *  the size; the label just says which part of the bill you're reading. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-ink/50">{children}</div>
  );
}

/**
 * STATE 1 — The Gathering, set as a PLAYBILL. This is the page behind the
 * printed poster's QR, so it opens as the poster (wordmark, crowd, slogan,
 * the album credit as the centrepiece) and then reads the way a bill does:
 * who's on, the night in order, the record, the circle, the doors. Lines and
 * rules, not cards — everything is type you can tap, and the only drawn shape
 * on the page is the pass button.
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
  album = null,
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
  /** The real record, read from the warehouse — null hides the count line. */
  album?: { trackCount: number } | null;
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

  // "Lounge 6:30 · Album 8 · Dancefloor 9" — the opening three movements of
  // the REAL run-of-show, so the hero can never disagree with the programme.
  // ":00" drops the way the artwork line reads; "The " drops from titles.
  const programmeStrip =
    runOfShow
      .slice(0, 3)
      .map((i) => `${i.title.replace(/^The\s+/i, "")} ${i.time.replace(/:00$/, "")}`)
      .join(" · ") || `Lounge ${timeLabel}`;

  /** Typeset index row — a tappable line of the bill, not a card. */
  const rowClass =
    "flex w-full items-baseline justify-between gap-4 border-t border-ink/15 py-3.5 text-left transition-colors hover:bg-ink/5";
  const rowLabel = "text-sm font-bold uppercase tracking-wide text-ink";
  const rowNote = "loop-muted shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em]";

  return (
    <div className="relative mx-auto max-w-md px-5">
      {/* ── The poster: one full viewport ─────────────────────────────────── */}
      <section className="flex h-[100dvh] flex-col pb-4 pt-5">
        <header className="flex items-start justify-end">
          <Logo width={116} />
        </header>

        {/* The album credit EXACTLY as the poster engine sets it (layout.ts §5,
            "the big line under the header"): Jost 500, caps, 0.34em tracking,
            centered, 85% ink. Under the wordmark it does the naming — Loop
            Soul is the album. The -mr cancels the trailing letter-space so the
            line centres true, the way the engine's glyph layout does. */}
        <div className="loop-display pt-5 text-center text-[15px] font-medium uppercase tracking-[0.34em] text-ink/85">
          <span className="-mr-[0.34em]">An Album by Mani Odubo</span>
        </div>

        {/* The crowd gets the room's upper air; the words happen under it. */}
        <div className="relative mt-2 min-h-0 w-full flex-1">
          <Image
            src="/loop/figures/crowd.png"
            alt="Loop Soul dancers in silhouette"
            fill
            priority
            unoptimized
            className="object-contain object-center"
          />
        </div>

        <div className="flex flex-col items-center gap-3 pt-3">
          {/* The slogan sits UNDER the dancers — it's what they're saying, not
              a headline (it is not the album's name; the masthead carries
              that). Straight, never arced; mixed case on purpose — the one
              line that invites. */}
          <div className="loop-display text-4xl font-bold tracking-tight text-ink">
            Come Dance
          </div>

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
              {dateLabel} · {venueShort}
            </div>
            {/* The shape of the night, in the open — the strip is DERIVED from
                the same run-of-show the rail and the sheet render, never a
                second copy of a time (the stale-9PM studio bug came from a
                time fact living in two places). */}
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-ink">
              {programmeStrip}
            </div>
            <div className="loop-muted mt-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
              Dress code · {event.theme}
            </div>
          </div>

          {/* The one drawn shape on the page — the ask. */}
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

          <a
            href="#the-bill"
            onClick={(e) => {
              // The document doesn't scroll — <main> does (root layout), so
              // smooth-scroll the target into view rather than relying on
              // html's scroll-behavior. The href stays as the no-JS fallback.
              e.preventDefault();
              document.getElementById("the-bill")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="loop-muted pt-1 text-[10px] font-bold uppercase tracking-[0.3em]"
          >
            On the bill ↓
          </a>
        </div>
      </section>

      {/* ── THE BILL — why this ticket, in billing order ──────────────────── */}
      <section id="the-bill" className="flex scroll-mt-6 flex-col gap-3 pt-8">
        <Eyebrow>On the Bill</Eyebrow>
        <div className="flex flex-col divide-y divide-ink/15 text-center">
          {/* Top billing: the record itself, and the fact that being in the
              room puts you on it — the strongest line the night has. */}
          <div className="py-5">
            <div className="loop-display text-3xl font-bold uppercase leading-tight tracking-tight text-ink">
              The Album,
              <br />
              Live in Full
            </div>
            <div className="loop-muted mt-2 text-[10px] font-semibold uppercase tracking-[0.25em]">
              Recorded in the room — the crowd is on the record
            </div>
          </div>

          <div className="py-5">
            <div className="loop-display text-3xl font-bold uppercase leading-tight tracking-tight text-ink">
              Amen
            </div>
            <div className="loop-muted mt-2 text-[10px] font-semibold uppercase tracking-[0.25em]">
              On the decks, door to lights
            </div>
          </div>

          <div className="py-5">
            <div className="loop-display text-2xl font-bold uppercase leading-tight tracking-tight text-ink">
              The Floor,
              <br />
              Livestreamed
            </div>
            <div className="loop-muted mt-2 text-[10px] font-semibold uppercase tracking-[0.25em]">
              All night, live to everywhere
            </div>
          </div>

          <div className="py-5">
            {/* Broken by hand — "The Loop Soul Line" must never split mid-name. */}
            <div className="loop-display text-lg font-bold uppercase leading-snug tracking-wide text-ink">
              Games · Barbecue
              <br />
              The Loop Soul Line
            </div>
          </div>
        </div>

        {/* The essentials strip — the poster's fine print in one line. */}
        <div className="border-y-2 border-ink py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-ink">
          Dress Code {event.theme} · {isFree ? "Free" : priceLabel} · 19+ · Outdoors
        </div>
      </section>

      {/* ── THE NIGHT — the real programme, as a rail ─────────────────────── */}
      <section className="flex flex-col gap-4 pt-10">
        <Eyebrow>The Night</Eyebrow>
        <div className="flex flex-col">
          {runOfShow.map((item, i) => (
            <div key={item.id} className="grid grid-cols-[3.25rem_1fr] gap-x-4">
              <div className="pt-0.5 text-right text-sm font-bold tabular-nums text-ink">
                {item.time}
              </div>
              <div
                className={`relative border-l-2 border-ink pl-4 ${
                  i === runOfShow.length - 1 ? "pb-1" : "pb-6"
                }`}
              >
                {/* Square markers, like a printed programme's pips. */}
                <span aria-hidden className="absolute -left-[5px] top-[7px] h-2 w-2 bg-ink" />
                <div className="loop-display text-lg font-bold uppercase leading-tight tracking-wide text-ink">
                  {item.title}
                </div>
                {item.performer && (
                  <div className="loop-muted mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
                    {item.performer}
                    {item.role ? ` — ${item.role}` : ""}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setActive("night")}
          className="self-start text-xs font-bold uppercase tracking-[0.2em] text-ink underline underline-offset-4"
        >
          The full programme →
        </button>
      </section>

      {/* ── THE RECORD — shown, not described ─────────────────────────────── */}
      <section className="flex flex-col gap-3 pt-10">
        <Eyebrow>The Record</Eyebrow>
        <div>
          <div className="loop-display text-3xl font-bold uppercase leading-none tracking-tight text-ink">
            Loop Soul
          </div>
          <div className="loop-muted mt-1.5 text-[10px] font-semibold uppercase tracking-[0.25em]">
            {album ? `${album.trackCount} tracks · ` : ""}Mani Odubo · first played this night
          </div>
        </div>
        {/* Two ways in, as lines you tap — hear it, or put your shot on it.
            /music resolves the newest album so this never learns an id; the
            player there also opens the record as a stem field you mix. */}
        <div className="flex flex-col">
          <Link href="/music" className={rowClass}>
            <span className={rowLabel}>Hear 1984, the lead single</span>
            <span className={rowNote}>Listen ↗</span>
          </Link>
          <button type="button" onClick={() => setActive("cover")} className={`${rowClass} border-b`}>
            <span className={rowLabel}>Shoot the album cover</span>
            <span className={rowNote}>Win $50 →</span>
          </button>
        </div>
      </section>

      {/* ── THE CIRCLE — the offer as a flow, not a paragraph ─────────────── */}
      <section className="flex flex-col gap-4 pt-10">
        <Eyebrow>The Circle</Eyebrow>
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-2">
          <div className="text-center">
            <div className="loop-display text-sm font-bold uppercase tracking-wide text-ink">
              Register
            </div>
            <div className="loop-muted mt-1 text-[9px] font-semibold uppercase leading-relaxed tracking-[0.15em]">
              {isFree ? "free · admits one" : `${priceLabel} · admits one`}
            </div>
          </div>
          <div aria-hidden className="pt-0.5 text-sm font-bold text-ink/40">
            →
          </div>
          <div className="text-center">
            <div className="loop-display text-sm font-bold uppercase tracking-wide text-ink">
              Be There
            </div>
            <div className="loop-muted mt-1 text-[9px] font-semibold uppercase leading-relaxed tracking-[0.15em]">
              {dateLabel}
            </div>
          </div>
          <div aria-hidden className="pt-0.5 text-sm font-bold text-ink/40">
            →
          </div>
          <div className="text-center">
            <div className="loop-display text-sm font-bold uppercase tracking-wide text-ink">
              Keep It All
            </div>
            <div className="loop-muted mt-1 text-[9px] font-semibold uppercase leading-relaxed tracking-[0.15em]">
              the record · the gallery · the vote
            </div>
          </div>
        </div>
        {/* Registration closing on the night is the campaign's real urgency —
            truer than any scarcity counter (docs/decisions/loop-soul-is-the-album.md). */}
        <div className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-ink">
          The door closes on the night — for good
        </div>
      </section>

      {/* ── DOORS — the index. Typeset rows, whole line tappable ──────────── */}
      <section className="flex flex-col gap-3 pb-8 pt-10">
        <Eyebrow>Doors</Eyebrow>
        <div className="flex flex-col">
          <button type="button" onClick={() => setActive("night")} className={rowClass}>
            <span className={rowLabel}>The Programme</span>
            <span className={rowNote}>→</span>
          </button>
          {ANTHEM_ENABLED && (
            <button type="button" onClick={() => setActive("anthem")} className={rowClass}>
              <span className={rowLabel}>Soul Anthem</span>
              <span className={rowNote}>→</span>
            </button>
          )}
          <Link href="/loop/store" className={rowClass}>
            <span className={rowLabel}>The Store</span>
            <span className={rowNote}>Passes &amp; pieces ↗</span>
          </Link>
          <Link href="/loop/code" className={rowClass}>
            <span className={rowLabel}>Find Your Code</span>
            <span className={rowNote}>↗</span>
          </Link>
          {journalPublished && (
            <Link href="/loop/journal" className={rowClass}>
              <span className={rowLabel}>The Journal</span>
              <span className={rowNote}>↗</span>
            </Link>
          )}
          <Link href="/loop/legacy" className={`${rowClass} border-b`}>
            <span className={rowLabel}>Legacy</span>
            <span className={rowNote}>↗</span>
          </Link>
        </div>

        {/* The ask, restated where the reading ends. */}
        <button
          type="button"
          onClick={() => setPassOpen(true)}
          className="mt-2 w-full rounded-full bg-ink py-4 text-base font-bold text-sand transition-transform active:scale-95"
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
