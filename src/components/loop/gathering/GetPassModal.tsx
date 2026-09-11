"use client";

import { useEffect } from "react";
import { priceLabel as formatPrice } from "@/lib/loop/priceLabel";
import { RECORDING_NOTICE } from "@/lib/loop/content";

/** Mirrors CapacityInfo — unlimited carries null counts on purpose, so a
 *  scarcity line can't render "0 left" for a room with no cap. */
type Capacity =
  | { unlimited: true; sold: number; total: null; remaining: null }
  | { unlimited: false; sold: number; total: number; remaining: number };

/**
 * The pass, in full, BEFORE checkout — price, what it includes, when, where,
 * how the event code reaches you, and what's left. Nobody should have to hit
 * a checkout page to learn what they're buying.
 *
 * Reading surface, not a tint: `.loop-glass` is near-opaque so this copy stays
 * legible over the poster artwork on a phone. Scrolls internally; X to close
 * (no drag-to-close, per house UX rules).
 */
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
  capacity: Capacity;
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

  // Admin-set Shopify checkout link first, then the env fallback.
  const checkoutUrl =
    checkoutUrlProp || process.env.NEXT_PUBLIC_LOOP_PASS_CHECKOUT_URL;
  const soldOut = !capacity.unlimited && capacity.remaining <= 0;
  // Same formatter as the front door and the print kit — see priceLabel.ts.
  const priceLabel = formatPrice(price, currency);
  const isFree = priceLabel === "FREE ENTRY";

  // Every line here has to be true at the door, in the app and on the night.
  // The previous version promised the code "arrives by email", which it does
  // not: there is no verified sending domain, so codes reach the owner and
  // nobody else. The lookup at /loop/code was built precisely so entry never
  // depends on delivery — so that is what this says now.
  const includes: [string, string][] = [
    [
      "Entry for one",
      `One pass, one guest. Lounge from ${timeLabel}, the album live at 8, 80s floor at 9. Dress code: ${theme}.`,
    ],
    [
      "Your code",
      "Issued the moment you pay, and always findable with your checkout email. It's your ticket at the door and your key to the room in the app.",
    ],
    // The record is the reason the night exists — see
    // docs/decisions/loop-soul-is-the-album.md.
    [
      "The record, first",
      "Loop Soul is an album. The 26th is its first exhibition: all 14, front to back, one of them recorded live in the room with you on it.",
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
      `${RECORDING_NOTICE.body} ${RECORDING_NOTICE.optOut}`,
    ],
    [
      "The Vault, after",
      "Your code keeps working: every shot from the night stays open to you in Legacy.",
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
              All {capacity.total} passes are gone. Join the waitlist and
              you&apos;ll be first in line if one opens up — and for Volume 2.
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
                        className={capacity.remaining <= 10 ? "text-wine" : ""}
                      >
                        {capacity.remaining} left
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
                  "Check out securely: card, Apple Pay, or Google Pay.",
                  // Was "lands in your email within a minute" — the same
                  // promise the includes list just stopped making. There is no
                  // verified sending domain, so the lookup IS the delivery.
                  "Look your code up here with the email you checked out with.",
                  "Show it at the door, then enter it in the app to unlock the room.",
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
                One code per pass, single use. Buying more than one? You&apos;ll
                get a code for each — share one with every guest. Your codes
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
                {RECORDING_NOTICE.short} {RECORDING_NOTICE.optOut}
              </p>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-full bg-ink py-4 text-center text-base font-bold text-sand transition-transform active:scale-95"
              >
                {isFree
                  ? "Register · Free"
                  : `Continue to checkout · ${priceLabel}`}
              </a>
              <p className="loop-muted mt-2 text-center text-[11px]">
                Secure checkout on our store. You&apos;ll come back here with
                your code.
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
