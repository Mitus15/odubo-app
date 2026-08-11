"use client";

import { useEffect } from "react";

type Capacity = { total: number; sold: number; remaining: number };

/**
 * Get Pass modal. When Scott's Eventbrite event exists, the embed widget
 * (NEXT_PUBLIC_EVENTBRITE_CHECKOUT_WIDGET) mounts here for Apple/Google Pay
 * checkout. Until then it shows an honest "passes drop soon" state. Per the
 * spec, checkout is NEVER optimistic — nothing is faked here.
 *
 * Uses an X button to close (no drag-to-close), matching house UX rules.
 */
export function GetPassModal({
  capacity,
  onClose,
}: {
  capacity: Capacity;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Shopify pass checkout wins when configured; the Eventbrite widget URL
  // remains as the fallback path.
  const checkoutUrl =
    process.env.NEXT_PUBLIC_LOOP_PASS_CHECKOUT_URL ||
    process.env.NEXT_PUBLIC_EVENTBRITE_CHECKOUT_WIDGET;
  const soldOut = capacity.remaining <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="loop-glass w-full max-w-md rounded-3xl p-6 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-xl font-extrabold">
            {soldOut ? "The room is full" : "Get your pass"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-2 text-2xl leading-none hover:bg-ink/10"
          >
            ×
          </button>
        </div>

        <p className="mt-2 text-sm opacity-80">
          {soldOut
            ? "Join the waitlist and you'll be first in line if a pass opens up — and for Volume 2."
            : "75 passes. Your pass includes an event code — it unlocks the room on the night, and lets you suggest a song for the Soul Loop Anthem."}
        </p>

        {checkoutUrl && !soldOut ? (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 block w-full rounded-full bg-ink py-4 text-center text-base font-bold text-sand"
          >
            Continue to checkout
          </a>
        ) : (
          <div className="mt-5 rounded-2xl border border-ink/15 bg-ink/5 p-4 text-sm">
            <strong className="block">
              {soldOut ? "Waitlist opens here." : "Passes drop soon."}
            </strong>
            <span className="opacity-70">
              Secure checkout (Apple / Google Pay) opens right here the moment
              tickets go live. Check back, or follow @loopsoul.ca.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GetPassModal;
