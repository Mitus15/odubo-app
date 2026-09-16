"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import type { LoopEvent } from "@/lib/loop/hub";
import { priceLabel as formatPrice } from "@/lib/loop/priceLabel";
import { EVENT_CREDITS } from "@/lib/loop/content";
import CoverContest from "./CoverContest";
import WallGallery from "@/components/loop/wall/WallGallery";
import type { RunOfShowItem } from "@/lib/loop/content";
import Logo from "@/components/loop/brand/Logo";
import ModuleSheet from "@/components/loop/shell/ModuleSheet";
import RunOfShow from "@/components/loop/gathering/RunOfShow";
import GetPassModal from "@/components/loop/gathering/GetPassModal";
import TheSingle from "@/components/loop/gathering/TheSingle";
import type { FeaturedSingle } from "@/lib/loop/single";
import type { ProductSummary } from "@/lib/store/types";
import PiecesRail from "@/components/loop/store/PiecesRail";

import { capacityLine, isSoldOut, isUrgent, type PublicCapacity } from "@/lib/loop/capacity";
type ModuleKey = "night" | "cover" | "wall";

const MODULES: { key: ModuleKey; label: string; title: string }[] = [
  // Label vs title on purpose: someone scanning the poster is looking for "the
  // programme", so the button says that; the sheet keeps the brand's own name
  // for the night. The Night has always rendered RUN_OF_SHOW — it was the
  // programme all along, just not findable by that word.
  { key: "night", label: "The Programme", title: "The Night" },
  { key: "cover", label: "Cover Contest", title: "The Cover Contest" },
  // "The Wall" is added per visitor below: only a pass-holder can see it.
  // The floor moment this volume has is the Loop Soul Line, which lives in the
  // programme rather than needing a module of its own — nothing to sign up for.
];

/**
 * STATE 1 — The Gathering, as a single POSTER:
 *   • real Loop Soul logo (top-right)
 *   • silhouette hero + arced tagline         • Scott's Inn (bottom)
 *   • compact pass counter + Get Pass CTA     • the Pieces rail (the shelf)
 *   • modules that open/close
 * Everything else (The Night, the Cover Contest) opens in a ModuleSheet over
 * the poster.
 * The poster fills one viewport on any phone tall enough to hold it; on short
 * ones it grows just past the fold rather than crush the figure.
 */
export function GatheringPoster({
  event,
  capacity: initialCapacity,
  runOfShow,
  checkoutUrl = null,
  price = null,
  currency = null,
  dateLabel,
  timeLabel,
  single = null,
  coverUrl = null,
  coverCaption = "",
  journalPublished = false,
  pieces = [],
  roomAccess = false,
}: {
  event: LoopEvent;
  capacity: PublicCapacity;
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
  /** Resolved per visitor — see lib/loop/cover. */
  coverUrl?: string | null;
  coverCaption?: string;
  /** A published Loop Journal issue makes last volume the pre-phase hype reel. */
  journalPublished?: boolean;
  /** Merch from the loop-soul collection, pass excluded. Empty hides the rail. */
  pieces?: ProductSummary[];
  /** This device redeemed a pass (or the doors are open): it can post to the
   *  Wall and see it, before the night as well as during it. */
  roomAccess?: boolean;
}) {
  const [active, setActive] = useState<ModuleKey | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [singleOpen, setSingleOpen] = useState(false);

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
      // A gifted link (?from=) opens the song: that visitor was sent for
      // exactly one reason. Everyone else lands on the POSTER — the night
      // first, the pass above the fold, the single one tap away as a module.
      // That is the order the owner set (2026-09-15): know there is a
      // listening event, get a ticket, then hear 1984. It matters because the
      // Facebook event links here bare, with no campaign tag, and used to
      // open a four-screen song in front of the date.
      if (new URLSearchParams(window.location.search).has("from")) setSingleOpen(true);
    } catch {
      /* stay on the poster */
    }
  }, [single]);

  const [capacity, setCapacity] = useState<PublicCapacity>(initialCapacity);

  // Keep the scarcity number fresh — it reads the real issued-code ledger.
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/loop/capacity", { cache: "no-store" });
        if (res.ok) setCapacity((await res.json()) as PublicCapacity);
      } catch {
        /* keep last known */
      }
    };
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  // An unlimited room can never be full — the check has to run through the
  // discriminant, not through a number that would read 0 when uncapped.
  const soldOut = isSoldOut(capacity);
  const modules = roomAccess
    ? [...MODULES, { key: "wall" as const, label: "The Wall", title: "The Wall" }]
    : MODULES;
  const activeModule = modules.find((m) => m.key === active) ?? null;
  // The exact formatter the print kit uses (loopSetting.priceLabel), so the
  // poster on the wall and the front door always say the same thing. An unset
  // or zero price reads "FREE ENTRY" — that is how the door opens.
  const priceLabel = formatPrice(price, currency);
  const isFree = priceLabel === "FREE ENTRY";
  // "Scott's Inn, Kamloops" → "Scott's Inn" on the tight poster line.
  const venueShort = event.venue.split(",")[0];

  // Telling somebody is the main way a $5 local night fills, and until now the
  // only share in the guest experience minted a gift code, needed a name first
  // and talked about the song. None of that is "come to this".
  const [told, setTold] = useState(false);
  const tellSomeone = useCallback(async () => {
    const url = `${window.location.origin}/loop?p=share`;
    const text =
      `${event.title ? `Loop Soul — ${event.title}. ` : "Loop Soul. "}` +
      `${dateLabel}, ${venueShort}. Doors ${timeLabel}.` +
      (isFree ? " Free." : ` ${priceLabel}.`);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Loop Soul", text, url });
        return;
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setTold(true);
      setTimeout(() => setTold(false), 2400);
    } catch {}
  }, [dateLabel, timeLabel, venueShort, isFree, priceLabel, event.title]);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-5 pt-5">
      {/* The masthead is ONE centred lockup: the mark, then the credit hung
          directly beneath it.

          It used to be two objects on two axes — the wordmark pinned hard
          right, the credit centred under it — so the eye went right, then
          jumped back to the middle, and the two never read as one thing. Worse,
          the corner mark was the smaller element, which inverted the hierarchy:
          the byline looked like the headline and the record's own name looked
          like a logo someone had parked in the corner.

          Loop Soul IS the album's name, so the mark is the title and the credit
          is its byline — a sleeve, not a letterhead. The credit keeps the
          treatment the printed piece gives it (Jost 500, one wide-tracked run,
          the feature at about two thirds beneath), so the page and the flyer
          still state the record identically, and the name is stated rather than
          shouted. The volume/theme block was removed on 2026-08-25 and stays
          removed — leading with an edition number made the night look like an
          instalment you had missed the start of. */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
        <div className="flex w-full flex-col items-center">
          {/* Sized as a share of the column so it holds its proportion from a
              320px phone to the 448px cap, and trimmed until the dancers below
              still read as a crowd rather than a strip — the mark leads, it
              does not evict the picture. */}
          <Logo className="w-[47%] max-w-[196px] min-w-[136px]" />
          {/* Sizes are clamped rather than fixed because the run cannot wrap:
              20.78em of tracked capitals needs 312px at 15px and still fits a
              320px phone at 12.8px. `pl-[…em]` cancels CSS's trailing
              letter-space, which would otherwise push the centred line half a
              track left of where the engine centres it. */}
          <div className="loop-display mt-3 whitespace-nowrap pl-[0.34em] text-center text-[clamp(12px,4vw,15px)] font-medium uppercase tracking-[0.34em] text-ink/85">
            {EVENT_CREDITS.record}
          </div>
          <div className="loop-display mt-1.5 whitespace-nowrap pl-[0.3em] text-center text-[clamp(8px,2.7vw,10px)] font-medium uppercase tracking-[0.3em] text-ink/60">
            {EVENT_CREDITS.feature}
          </div>
        </div>
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
              {/* The size of the room always; how many are left only once
                  that is a warning rather than a sales report. */}
              <span className={isUrgent(capacity) ? "text-wine" : undefined}>
                {capacityLine(capacity, { free: isFree })}
              </span>
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
        {/* Two tappable lines, no second drawn shape: the pass button above
            stays the only one on the poster. */}
        <div className="-mt-1 flex items-center gap-3">
          {!soldOut && (
            <button
              type="button"
              onClick={() => setPassOpen(true)}
              className="loop-muted text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
            >
              What&apos;s included
            </button>
          )}
          {!soldOut && <span className="loop-muted text-[11px]">·</span>}
          <button
            type="button"
            onClick={tellSomeone}
            className="loop-muted text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
          >
            {told ? "Copied" : "Tell someone"}
          </button>
        </div>

        {/* The way back in, for anyone who already bought: their pass, and the
            record it pre-ordered. Text and a middot, same as the row above —
            the pass button stays the only drawn shape. Before this row the
            poster gave a returning buyer no path to either. */}
        <div className="-mt-1 flex items-center gap-3">
          <Link
            href="/loop/code"
            className="loop-muted text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
          >
            {roomAccess ? "Your pass" : "Have a pass?"}
          </Link>
          <span className="loop-muted text-[11px]">·</span>
          <Link
            href="/loop/album"
            className="loop-muted text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
          >
            The record
          </Link>
        </div>

        {/* The shelf, right after the pass: the sell comes before the
            navigation. Type and a hairline only — the pass button above stays
            the one drawn shape on the poster. */}
        <PiecesRail pieces={pieces} />

        {/* Module launchers */}
        <nav className="grid w-full grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
          {/* First in the grid: it is the one thing the flyer actually
              promised, so it outranks the programme and the contest.

              It says "The Single" because that is the phrase the flyer's QR
              caption used before it sold passes, and the phrase the sheet
              behind it opens with. It read "Play 1984" before, which asked a
              stranger to recognise a title they have never heard: the flyer
              sent them for the single, and the page answered with a number.
              The track is still named, after the middot, so the title is the
              thing they leave knowing. Noun phrase, like The Programme and
              Cover Contest beside it — the verb was the odd one out. */}
          {single && (
            <button
              type="button"
              onClick={() => setSingleOpen(true)}
              className="rounded-2xl border border-ink/20 px-2 py-3 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-ink/10"
            >
              The Single · {single.title}
            </button>
          )}
          {modules.map((m) => (
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
          src="/loop/branding/odubo-2026.svg"
          alt="Odubo, presenter"
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
            {active === "night" && (
              <RunOfShow items={runOfShow} showHeader={false} />
            )}
            {active === "cover" && <CoverContest canPost={roomAccess} />}
            {active === "wall" && <WallGallery canPost />}
          </ModuleSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {single && singleOpen && (
          <TheSingle
            single={single}
            dateLabel={dateLabel}
            coverUrl={coverUrl}
            coverCaption={coverCaption}
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
