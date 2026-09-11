"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePWA } from "@/components/PWAProvider";
import SinglePlayer from "@/components/loop/gathering/SinglePlayer";
import ClaimRow from "@/components/loop/identity/ClaimRow";
import type { FeaturedSingle } from "@/lib/loop/single";

/**
 * THE SINGLE — what the flyer's QR promises.
 *
 * The gift is UNCONDITIONAL. Nothing is gated behind an install, a share, an
 * email or a name: a stranger who scans a piece of paper at a barbecue gets the
 * song on the first tap. Every gate we could put in front of it would be paid
 * for in the only currency that matters at this stage, which is people who
 * bothered.
 *
 * One tap, not zero — browsers refuse to start audible playback without a
 * gesture (CLAUDE.md, "Browser Autoplay Policies"), and a silently autoplaying
 * muted song is worse than a button.
 *
 * Laid out as full-height snap sections rather than one long scroll. A page
 * that stops where it is told reads as composed; a page that halts halfway
 * through a heading reads as a document someone forgot to finish. The
 * three-screen order is also an argument: the song, then what you keep, then
 * what it costs to hear the rest.
 */

const SEEN_KEY = "loop.single.seen";
const CODE_KEY = "loop.gift.code";
const NAME_KEY = "loop.gift.name";
const VISITOR_KEY = "loop.visitor";

function visitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    // Private mode, or storage blocked. A visitor we cannot remember still
    // gets the song; they just cannot be counted, which is the right thing to
    // lose of the two.
    return "";
  }
}

const SECTION =
  "snap-start mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-10";

export function TheSingle({
  single,
  coverUrl,
  coverCaption,
  dateLabel,
  onClose,
  onGetPass,
  onCoverContest,
}: {
  single: FeaturedSingle;
  /** Resolved per visitor: theirs, the room's, or the owner's. */
  coverUrl: string | null;
  coverCaption: string;
  /** Server-formatted in the venue's timezone. Never typed here: this text was
   *  hardcoded through two date changes and had to be hunted down both times. */
  dateLabel: string;
  onClose: () => void;
  onGetPass: () => void;
  onCoverContest: () => void;
}) {
  const [heard, setHeard] = useState(false);
  const [sender, setSender] = useState<string | null>(null);

  const { isStandalone, isInstallable, promptInstall } = usePWA();
  const [iosHelp, setIosHelp] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [reached, setReached] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [minting, setMinting] = useState(false);

  /* ── who sent them here ─────────────────────────────────────────────── */
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
      setCode(localStorage.getItem(CODE_KEY));
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* storage blocked — the song still plays */
    }

    const from = new URLSearchParams(window.location.search).get("from");
    if (!from) return;
    const v = visitorId();
    if (!v) return;
    fetch("/api/loop/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "visit", code: from, visitor: v }),
    })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ name: string | null }>) : null,
      )
      .then((d) => d?.name && setSender(d.name))
      .catch(() => {
        /* attribution is a nicety; never let it break the page */
      });
  }, []);

  /* ── how many people this listener has reached ──────────────────────── */
  useEffect(() => {
    if (!code) return;
    fetch(`/api/loop/gift?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ count: number }>) : null))
      .then((d) => typeof d?.count === "number" && setReached(d.count))
      .catch(() => {});
  }, [code]);

  /* ── the overlay owns the page while it is open ─────────────────────── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const share = useCallback(async () => {
    let c = code;
    if (!c) {
      const n = name.trim();
      if (!n) return;
      setMinting(true);
      try {
        const res = await fetch("/api/loop/gift", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mint", name: n }),
        });
        if (!res.ok) return;
        c = ((await res.json()) as { code: string }).code;
        setCode(c);
        try {
          localStorage.setItem(CODE_KEY, c);
          localStorage.setItem(NAME_KEY, n);
        } catch {}
      } finally {
        setMinting(false);
      }
    }
    if (!c) return;

    // Origin, never a hardcoded domain — the printed URL has moved once
    // already and the share link must follow it without a deploy.
    const url = `${window.location.origin}/loop?from=${c}`;
    const text = `Listen to "${single.title}" — ${single.artistName}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: single.title, text, url });
        return;
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {}
  }, [code, name, single.title, single.artistName]);

  const keepIt = useCallback(async () => {
    if (isInstallable) {
      await promptInstall();
      return;
    }
    // iOS gives no install API at all — the Share-sheet route is the only one,
    // so say it in words rather than firing a prompt that will never come.
    setIosHelp((v) => !v);
  }, [isInstallable, promptInstall]);

  const onHeard = useCallback(() => setHeard(true), []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 snap-y snap-mandatory overflow-y-scroll overscroll-contain bg-sand text-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Outside the scroller so it survives every section. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed right-2 top-2 z-10 flex h-11 w-11 items-center justify-center text-2xl leading-none opacity-50 transition-opacity hover:opacity-100"
      >
        ×
      </button>

      {/* ── 1 · the song ─────────────────────────────────────────────── */}
      <section className={SECTION}>
        {sender && (
          <div className="loop-muted mb-4 text-center text-[11px] font-bold uppercase tracking-[0.2em]">
            {sender} sent you this
          </div>
        )}
        <SinglePlayer
          single={single}
          coverUrl={coverUrl}
          onHeard={onHeard}
          onCoverContest={onCoverContest}
          coverCaption={coverCaption}
        />
        <div
          aria-hidden="true"
          className="loop-muted mt-8 text-center text-lg leading-none"
        >
          ↓
        </div>
      </section>

      {/* ── 2 · what you keep ────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="loop-display text-3xl font-bold tracking-tight">
          {heard ? "Yours to keep." : "It's yours."}
        </h2>
        <p className="loop-muted mt-2 text-sm leading-relaxed">
          No email, no account. Two things you can do with it.
        </p>

        <div className="mt-8">
          {!isStandalone && (
            <div className="border-t border-ink/15">
              <button
                type="button"
                onClick={keepIt}
                className="flex min-h-[44px] w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span>
                  <span className="block text-base font-bold">
                    Get Loop Soul
                  </span>
                  <span className="loop-muted block text-[13px]">
                    On your home screen
                  </span>
                </span>
                <span className="loop-muted shrink-0">↓</span>
              </button>
              {iosHelp && (
                <p className="loop-muted -mt-2 pb-5 text-[13px] leading-relaxed">
                  Tap the <strong>Share</strong> button in your browser bar,
                  scroll down, then choose <strong>Add to Home Screen</strong>.
                </p>
              )}
            </div>
          )}

          <div className="border-t border-ink/15 py-5">
            <div className="text-base font-bold">Loop someone in</div>
            <div className="loop-muted mt-1 text-[13px] leading-relaxed">
              {code
                ? reached === null
                  ? "Your link is ready."
                  : reached === 0
                    ? "Nobody's opened your link yet."
                    : `${reached} ${reached === 1 ? "person has" : "people have"} heard it through you.`
                : "Send it on with your name on it, not just a link."}
            </div>
            <div className="mt-4 flex gap-2">
              {!code && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your first name"
                  maxLength={24}
                  className="min-w-0 flex-1 rounded-full border border-ink/25 bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-40 focus:border-ink/60"
                />
              )}
              <button
                type="button"
                onClick={share}
                disabled={minting || (!code && !name.trim())}
                className="shrink-0 rounded-full bg-ink px-6 py-3 text-sm font-bold text-sand transition-transform active:scale-95 disabled:opacity-35"
              >
                {copied
                  ? "Copied"
                  : minting
                    ? "…"
                    : code
                      ? "Share"
                      : "Loop them in"}
              </button>
            </div>
          </div>
          <div className="border-t border-ink/15" />
        </div>
      </section>

      {/* ── 3 · the rest of it ───────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="loop-display text-3xl font-bold tracking-tight">
          There are thirteen more.
        </h2>
        <p className="loop-muted mt-2 text-sm leading-relaxed">
          Played front to back, once, in a courtyard.
        </p>

        <button
          type="button"
          onClick={onGetPass}
          className="mt-8 flex w-full items-center justify-between rounded-2xl bg-ink px-6 py-5 text-left text-sand transition-transform active:scale-95"
        >
          <span>
            <span className="block text-base font-bold">
              Hear the rest of it live
            </span>
            <span className="block text-[13px] opacity-70">
              All 14, front to back · {dateLabel}
            </span>
          </span>
          <span className="opacity-60">→</span>
        </button>

        <p className="loop-muted mt-10 text-sm leading-relaxed">
          This album isn&apos;t streaming anywhere. {dateLabel} is its first
          exhibition.
        </p>
      </section>

      {/* ── 4 · you ──────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <ClaimRow />
      </section>
    </motion.div>
  );
}

export default memo(TheSingle);
