"use client";

import { useEffect, useState } from "react";
import { priceLabel as formatPrice } from "@/lib/loop/priceLabel";
import { RECORDING_NOTICE, type RunOfShowItem } from "@/lib/loop/content";
import { nightLine, venueShort } from "@/lib/loop/eventFacts";
import { capacityLine, isSoldOut, isUrgent, type PublicCapacity } from "@/lib/loop/capacity";

/**
 * The pass, BEFORE checkout. Sixty words.
 *
 * It used to be four hundred and fifty: seven bullets on what a pass includes,
 * three numbered steps on how it works, a footnote on multi-pass orders and
 * the recording notice twice. A buyer holding a phone at a bus stop reads
 * none of that; the poster behind this sheet already shows the night, and
 * the ticket email says what to do next. So this says what a pass is (the
 * night, in two lines), what you get (the ticket, the record), the one term
 * you accept, and takes an address.
 *
 * The times come from the run of show, never a literal: a literal is how this
 * sheet once sold "the 26th" under an Oct 10 header. Reading surface, not a
 * tint: `.loop-glass` is near-opaque. X to close (no drag-to-close, per house
 * UX rules).
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six"];

function recordLine(earlyCount: number | null | undefined): string {
  if (!earlyCount || earlyCount < 1) return "Your ticket by email. The whole record after the night.";
  const n = earlyCount < WORDS.length ? WORDS[earlyCount] : String(earlyCount);
  return `Your ticket by email. ${n} ${earlyCount === 1 ? "track" : "tracks"} now, the whole record after the night.`;
}

export function GetPassModal({
  capacity,
  checkoutUrl: checkoutUrlProp,
  price,
  currency,
  theme,
  venue,
  dateLabel,
  timeLabel,
  runOfShow = [],
  earlyCount = null,
  onClose,
}: {
  capacity: PublicCapacity;
  /** Admin-configured checkout link (loop_settings): wins over env fallbacks. */
  checkoutUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  theme: string;
  venue: string;
  dateLabel: string;
  timeLabel: string;
  /** The programme, for the album and floor times. */
  runOfShow?: RunOfShowItem[];
  /** Tracks a pass hears before release (the single plus the dealt ones). */
  earlyCount?: number | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock the page behind the sheet while it's open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listed, setListed] = useState(false);

  // Admin-set Shopify checkout link first, then the env fallback.
  const checkoutUrl = checkoutUrlProp || process.env.NEXT_PUBLIC_LOOP_PASS_CHECKOUT_URL;
  const soldOut = isSoldOut(capacity);
  // Same formatter as the front door and the print kit (priceLabel.ts).
  const priceLabel = formatPrice(price, currency);
  const isFree = priceLabel === "FREE ENTRY";
  const line = capacityLine(capacity, { free: isFree });

  /**
   * Record the address, then go to checkout with it prefilled. Shopify Basic
   * never hands this app a buyer's email, so the address is taken here, once,
   * and the checkout arrives with it filled in. A failure here must never
   * cost a sale: the plain checkout opens anyway and the buyer is recoverable
   * from the admin.
   */
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const addr = email.trim();
    if (!EMAIL.test(addr)) {
      setErr("We need an address to send your ticket to.");
      return;
    }
    setBusy(true);
    setErr(null);
    let target = checkoutUrl as string;
    try {
      const res = await fetch("/api/loop/pass/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: addr, consent }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (res.ok && data.checkoutUrl) target = data.checkoutUrl;
      else console.error("[loop:pass] intent not recorded:", data.error ?? res.status);
    } catch (e2) {
      console.error("[loop:pass] intent not recorded:", e2);
    }
    window.location.href = target;
  }

  /** Sold out: the same field joins the waitlist instead. */
  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const addr = email.trim();
    if (!EMAIL.test(addr)) {
      setErr("We need an address to reach you at.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/loop/pass/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't add you. Try again.");
      setListed(true);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="loop-glass flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl text-ink sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="The pass"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
          <div>
            <h3 className="text-2xl font-extrabold leading-tight">{soldOut ? "Sold out" : "The Pass"}</h3>
            {!soldOut && <p className="mt-1 text-lg font-bold tabular-nums">{priceLabel}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none hover:bg-ink/10"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {soldOut ? (
            <p className="text-sm leading-relaxed">
              {listed ? "You're on the list." : "Every pass is gone. Leave your email and you're first if one opens up."}
            </p>
          ) : (
            <>
              {/* The night, in two lines. Times from the programme, not typed. */}
              <div className="border-y border-ink/15 py-4 text-sm leading-relaxed">
                <p className="font-semibold">
                  {dateLabel} · {venueShort(venue)} · from {timeLabel}
                </p>
                <p className="loop-muted mt-0.5">{nightLine(theme, runOfShow)}</p>
                {line && (
                  <p className={`mt-2 text-[11px] font-bold uppercase tracking-[0.2em] ${isUrgent(capacity) ? "text-wine" : "loop-muted"}`}>
                    {line}
                  </p>
                )}
              </div>
              <p className="mt-4 text-sm leading-relaxed">{recordLine(earlyCount)}</p>
            </>
          )}
        </div>

        {/* Action rail: always visible, never scrolled away. */}
        <div className="border-t border-ink/15 px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4">
          {checkoutUrl && !soldOut ? (
            <>
              {/* The one term, before money changes hands. See RECORDING_NOTICE. */}
              <p className="loop-muted mb-3 text-center text-[11px] leading-relaxed">{RECORDING_NOTICE.short}</p>
              <form onSubmit={go} className="grid gap-2">
                <label htmlFor="loop-pass-email" className="sr-only">
                  Where should we send your ticket?
                </label>
                <input
                  id="loop-pass-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErr(null);
                  }}
                  placeholder="Where should we send your ticket?"
                  className="min-h-[52px] w-full rounded-full border border-ink/25 bg-transparent px-5 text-base outline-none placeholder:opacity-50 focus:border-ink"
                />
                {/* Off by default, on purpose: consent to marketing is given, not assumed. */}
                <label className="flex items-start gap-2.5 px-2 py-1 text-[12px] leading-snug">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--foreground)]"
                  />
                  <span className="loop-muted">Keep me posted about Loop Soul.</span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="block w-full rounded-full bg-ink py-4 text-center text-base font-bold text-sand transition-transform active:scale-95 disabled:opacity-60"
                >
                  {busy ? "Opening checkout…" : isFree ? "Register · Free" : `Continue to checkout · ${priceLabel}`}
                </button>
              </form>
              {err && <p className="mt-2 text-center text-[11px] font-semibold text-red-700">{err}</p>}
              {/* Shopify's online checkout in Canada never takes Interac; the
                  owner found out with his own card. Said once, small. */}
              <p className="loop-muted mt-2 text-center text-[11px]">
                Visa, Mastercard, Apple Pay, Google Pay, PayPal. Interac cards don&apos;t work online.
              </p>
            </>
          ) : soldOut && !listed ? (
            <form onSubmit={join} className="grid gap-2">
              <label htmlFor="loop-waitlist-email" className="sr-only">
                Your email
              </label>
              <input
                id="loop-waitlist-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErr(null);
                }}
                placeholder="Your email"
                className="min-h-[52px] w-full rounded-full border border-ink/25 bg-transparent px-5 text-base outline-none placeholder:opacity-50 focus:border-ink"
              />
              <button
                type="submit"
                disabled={busy}
                className="block w-full rounded-full bg-ink py-4 text-center text-base font-bold text-sand transition-transform active:scale-95 disabled:opacity-60"
              >
                {busy ? "One moment…" : "Put me first"}
              </button>
              {err && <p className="mt-1 text-center text-[11px] font-semibold text-red-700">{err}</p>}
            </form>
          ) : soldOut ? (
            <p className="text-center text-sm font-semibold">If one opens up, it&apos;s yours first.</p>
          ) : (
            <div className="border-t border-ink/15 pt-4 text-sm">
              <strong className="block">Passes drop soon.</strong>
              <span className="loop-muted">Check back, or follow @loopsoul.ca.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GetPassModal;
