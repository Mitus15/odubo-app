"use client";

import { useEffect, useState } from "react";
import { priceLabel as formatPrice } from "@/lib/loop/priceLabel";
import { RECORDING_NOTICE } from "@/lib/loop/content";

import { capacityLine, isSoldOut, isUrgent, type PublicCapacity } from "@/lib/loop/capacity";

/**
 * The pass, in full, BEFORE checkout — price, what it includes, when, where,
 * how the event code reaches you, and what's left. Nobody should have to hit
 * a checkout page to learn what they're buying.
 *
 * Reading surface, not a tint: `.loop-glass` is near-opaque so this copy stays
 * legible over the poster artwork on a phone. Scrolls internally; X to close
 * (no drag-to-close, per house UX rules).
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GetPassModal({
  capacity,
  checkoutUrl: checkoutUrlProp,
  price,
  currency,
  theme,
  venue,
  dateLabel,
  timeLabel,
  onClose,
}: {
  capacity: PublicCapacity;
  /** Admin-configured checkout link (loop_settings) — wins over env fallbacks. */
  checkoutUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  theme: string;
  venue: string;
  dateLabel: string;
  timeLabel: string;
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

  // Admin-set Shopify checkout link first, then the env fallback.
  const checkoutUrl =
    checkoutUrlProp || process.env.NEXT_PUBLIC_LOOP_PASS_CHECKOUT_URL;
  const soldOut = isSoldOut(capacity);
  // Same formatter as the front door and the print kit — see priceLabel.ts.
  const priceLabel = formatPrice(price, currency);
  const isFree = priceLabel === "FREE ENTRY";

  // Every line here has to be true at the door, in the app and on the night.
  // The previous version promised the code "arrives by email", which it does
  // not: there is no verified sending domain, so codes reach the owner and
  // nobody else. The lookup at /loop/code was built precisely so entry never
  // depends on delivery — so that is what this says now.
  /**
   * Record the address, then go to checkout with it prefilled.
   *
   * A failure here must never cost a sale: if the record cannot be written we
   * open the plain checkout anyway and the buyer is recoverable from the admin.
   */
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const addr = email.trim();
    if (!EMAIL.test(addr)) {
      setErr("We need an address to send your pass to.");
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

  const includes: [string, string][] = [
    [
      "Entry for one",
      `One pass, one guest. Lounge from ${timeLabel}, the album live at 8, 80s floor at 9. Dress code: ${theme}.`,
    ],
    [
      "Your pass",
      "A short code, sent the moment you pay and always findable with your checkout email. Show it at the door, and enter it in the app to open the room.",
    ],
    // The record is the reason the night exists — see
    // docs/decisions/loop-soul-is-the-album.md.
    //
    // The date is `dateLabel`, never a spelled-out one. This line read "the
    // 26th" for three days after the night moved to Oct 10, contradicting the
    // header of the very sheet it sits in. A buyer reads this immediately
    // before paying, so it takes its date from the same source as everything
    // else and cannot drift again.
    [
      "The record, first",
      `Loop Soul is an album. ${dateLabel} is its first exhibition: all 14, front to back, one of them recorded live in the room with you on it. A few tracks play now with your pass; the rest land after the night.`,
    ],
    // The cover is fluid (owner, 2026-09-08): his version is one version.
    [
      "The cover is fluid",
      "The cover you've seen is Mani's. Shoot through the filter, put it on the Wall, and yours can be the one you hold. The room votes the official one.",
    ],
    // Registration closes at the event and never reopens: the people in the
    // room are the album's audience. This is the whole offer.
    [
      "In the circle, for good",
      "Registration closes on the night and doesn't reopen. Everyone in the room keeps the gallery, votes the tracklist and the cover, and is credited by name on every shot they took.",
    ],
    // Before money changes hands, not after. See RECORDING_NOTICE.
    [
      RECORDING_NOTICE.headline,
      `${RECORDING_NOTICE.body} ${RECORDING_NOTICE.condition}`,
    ],
    [
      "The Vault, after",
      "Your pass keeps working: every shot from the night stays open to you in Legacy.",
    ],
  ];

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
        aria-label="Pass details"
      >
        {/* Header stays put; the details scroll under it. */}
        <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
          <div>
            <h3 className="text-2xl font-extrabold leading-tight">
              {soldOut ? "The room is full" : "The Pass"}
            </h3>
            {!soldOut && (
              <p className="mt-1 text-lg font-bold tabular-nums">
                {priceLabel}
              </p>
            )}
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
              Every pass is gone. Join the waitlist and you&apos;ll be first in
              line if one opens up — and for Volume 2.
            </p>
          ) : (
            <>
              {/* When / where / how many — the facts people ask first. */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-y border-ink/15 py-4 text-sm">
                <dt className="loop-muted font-semibold uppercase tracking-widest text-[11px] leading-5">
                  When
                </dt>
                <dd className="font-semibold">
                  {dateLabel}
                  <span className="loop-muted font-normal">
                    {" "}
                    · doors {timeLabel}
                  </span>
                </dd>
                <dt className="loop-muted font-semibold uppercase tracking-widest text-[11px] leading-5">
                  Where
                </dt>
                <dd className="font-semibold">{venue}</dd>
                <dt className="loop-muted font-semibold uppercase tracking-widest text-[11px] leading-5">
                  Room
                </dt>
                <dd className="font-semibold tabular-nums">
                  {capacity.unlimited ? (
                    "Open, no cap"
                  ) : (
                    <>
                      {capacity.total} passes ·{" "}
                      <span
                        className={isUrgent(capacity) ? "text-wine" : ""}
                      >
                        {capacityLine(capacity)}
                      </span>
                    </>
                  )}
                </dd>
              </dl>

              <h4 className="mt-5 text-[11px] font-bold uppercase tracking-widest loop-muted">
                What your pass includes
              </h4>
              <ul className="mt-3 grid gap-3">
                {includes.map(([label, detail]) => (
                  <li key={label} className="flex gap-3">
                    <span aria-hidden className="mt-0.5 shrink-0 font-bold">
                      ✦
                    </span>
                    <span className="text-sm leading-relaxed">
                      <b>{label}.</b>{" "}
                      <span className="loop-muted">{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <h4 className="mt-6 text-[11px] font-bold uppercase tracking-widest loop-muted">
                How it works
              </h4>
              <ol className="mt-3 grid gap-2 text-sm leading-relaxed">
                {[
                  // Shopify's online checkout in Canada takes Visa, Mastercard,
                  // Amex and Discover, in a wallet or typed in. It does not take
                  // Interac, online, for any store. A Visa Debit or Debit
                  // Mastercard works; a plain bank client card is refused, and
                  // the owner found this out with his own card. So the line
                  // says what works, and the door is named as the way in for
                  // anyone whose card is not.
                  "Check out securely: credit card, Visa Debit or Debit Mastercard, Apple Pay, Google Pay, Shop Pay or PayPal. Interac-only cards can't pay online; if yours is refused, PayPal works, or pay $5 at the door.",
                  // Was "lands in your email within a minute" — the same
                  // promise the includes list just stopped making. There is no
                  // verified sending domain, so the lookup IS the delivery.
                  "Find your pass here any time with the email you checked out with.",
                  "Show your pass at the door, then enter it in the app to open the room.",
                ].map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-sand"
                    >
                      {i + 1}
                    </span>
                    <span className="loop-muted">{step}</span>
                  </li>
                ))}
              </ol>

              <p className="loop-muted mt-5 text-xs leading-relaxed">
                One pass admits one guest, once. Buying more than one? You&apos;ll
                get a pass for each; share one with every guest. Your passes
                live at{" "}
                <a
                  href="/loop/code"
                  className="font-bold underline underline-offset-2"
                >
                  odubostudio.com/loop/code
                </a>{" "}
                — look them up any time with your checkout email.
              </p>
            </>
          )}
        </div>

        {/* Action rail — always visible, never scrolled away. */}
        <div className="border-t border-ink/15 px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4">
          {checkoutUrl && !soldOut ? (
            <>
              <p className="loop-muted mb-3 text-center text-[11px] leading-relaxed">
                {RECORDING_NOTICE.short}
              </p>
              {/* The address is asked for HERE, not taken from the order.
                  Shopify Basic does not let this app read a buyer's email, so
                  a pass bought without this step is a pass we cannot send.
                  It is typed once: the checkout arrives with it prefilled. */}
              <form onSubmit={go} className="grid gap-2">
                <label htmlFor="loop-pass-email" className="sr-only">
                  Where should we send your pass?
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
                  placeholder="Where should we send your pass?"
                  className="min-h-[52px] w-full rounded-full border border-ink/25 bg-transparent px-5 text-base outline-none placeholder:opacity-50 focus:border-ink"
                />
                {/* Off by default, on purpose: consent to marketing has to be
                    given, not assumed. The pass and the album never need it. */}
                <label className="flex items-start gap-2.5 px-2 py-1 text-[12px] leading-snug">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--foreground)]"
                  />
                  <span className="loop-muted">
                    Keep me posted about Loop Soul. Optional, and you can stop it any time.
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="block w-full rounded-full bg-ink py-4 text-center text-base font-bold text-sand transition-transform active:scale-95 disabled:opacity-60"
                >
                  {busy
                    ? "Opening checkout…"
                    : isFree
                      ? "Register · Free"
                      : `Continue to checkout · ${priceLabel}`}
                </button>
              </form>
              {err && <p className="mt-2 text-center text-[11px] font-semibold text-red-700">{err}</p>}
              <p className="loop-muted mt-2 text-center text-[11px]">
                Secure checkout on our store. Your pass and your QR ticket go to
                that address, and you can find them here any time.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-ink/20 bg-ink/5 p-4 text-sm">
              <strong className="block">
                {soldOut ? "Waitlist opens here." : "Passes drop soon."}
              </strong>
              <span className="loop-muted">
                Secure checkout (Apple / Google Pay) opens right here the moment
                passes go live. Check back, or follow @loopsoul.ca.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GetPassModal;
