"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";
import GetPassModal from "@/components/loop/gathering/GetPassModal";
import { priceLabel as formatPrice } from "@/lib/loop/priceLabel";
import type { PassOffer } from "@/lib/loop/pass/offer";

export type { PassOffer };

/**
 * The pass gate. A ticket-holder types their pass and this phone becomes
 * theirs: the server re-renders with `isHolder` true for this `ls_voter`
 * (POST /api/loop/pass/enter binds the code to the device). `tone="vault"`
 * restyles for the dark Legacy field. Type and one drawn shape, no bubble.
 *
 * Someone without a pass is sent to the pass SHEET, never to a bare checkout
 * link: the sheet is the only place that takes the address the ticket goes
 * to, and sale #1 came through a bare link with no email at all.
 */
export function PortalGate({
  title = "Enter your pass",
  copy = "Your pass opens the Wall, the votes, and the night.",
  cta = "Enter",
  tone = "poster",
  offer = null,
}: {
  title?: string;
  copy?: string;
  cta?: string;
  tone?: "poster" | "vault";
  /** How to buy one, when one can still be bought. */
  offer?: PassOffer | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passOpen, setPassOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/loop/pass/enter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    if (res.ok) {
      router.refresh(); // server re-renders → this is their page now
      return;
    }
    setBusy(false);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "Something went wrong. Try again.");
  }

  const vault = tone === "vault";
  const price = offer ? formatPrice(offer.price, offer.currency) : null;
  const canBuy = Boolean(offer?.checkoutUrl);

  return (
    <div className={`mt-12 w-full max-w-md border-t pt-6 text-left ${vault ? "border-sand/25" : "border-ink/15"}`}>
      <div className="font-bold">{title}</div>
      <div className="mt-1 text-sm opacity-70">{copy}</div>

      <form onSubmit={submit} className="mt-5 grid gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. LOOP-XXXX"
          className={`rounded-2xl border px-4 py-3 font-mono uppercase tracking-widest outline-none ${
            vault
              ? "border-sand/30 bg-ink-soft text-bone focus:border-sand"
              : "border-ink/15 bg-bone focus:border-ink"
          }`}
        />
        {error ? (
          <p className={`text-sm font-semibold ${vault ? "text-sand-bright" : "text-red-600"}`}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || code.trim().length === 0}
          className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-bold transition-opacity disabled:opacity-50 ${
            vault ? "border-sand bg-sand text-ink" : "border-ink bg-ink text-sand"
          }`}
        >
          {busy ? <LoopLoader size={24} label="Opening" /> : cta}
        </button>
      </form>

      {/* Tappable lines under the one drawn shape: a way to buy while there is
          one, and the way back for anyone who already did. */}
      <div className={`mt-5 flex items-center justify-center gap-3 border-t pt-4 ${vault ? "border-sand/20" : "border-ink/15"}`}>
        {canBuy && (
          <>
            <button
              type="button"
              onClick={() => setPassOpen(true)}
              className="loop-muted min-h-[44px] text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
            >
              Get a pass{price && price !== "FREE ENTRY" ? ` · ${price}` : ""}
            </button>
            <span className="loop-muted text-[11px]">·</span>
          </>
        )}
        <Link
          href="/loop/code"
          className="loop-muted min-h-[44px] text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
        >
          Lost your ticket?
        </Link>
      </div>

      {passOpen && offer && (
        <GetPassModal
          capacity={offer.capacity}
          checkoutUrl={offer.checkoutUrl}
          price={offer.price}
          currency={offer.currency}
          theme={offer.theme}
          venue={offer.venue}
          dateLabel={offer.dateLabel}
          timeLabel={offer.timeLabel}
          runOfShow={offer.runOfShow}
          earlyCount={offer.earlyCount}
          onClose={() => setPassOpen(false)}
        />
      )}
    </div>
  );
}

export default PortalGate;
