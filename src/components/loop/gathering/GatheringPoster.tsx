"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import type { LoopEvent } from "@/lib/loop/hub";
import type { AnthemState } from "@/lib/loop/anthem-server";
import type { RunOfShowItem } from "@/lib/loop/content";
import Logo from "@/components/loop/brand/Logo";
import ArcedTagline from "@/components/loop/brand/ArcedTagline";
import ModuleSheet from "@/components/loop/shell/ModuleSheet";
import AnthemBracket from "@/components/loop/anthem/AnthemBracket";
import RunOfShow from "@/components/loop/gathering/RunOfShow";
import GetPassModal from "@/components/loop/gathering/GetPassModal";

type Capacity = { total: number; sold: number; remaining: number };
type ModuleKey = "anthem" | "night";

const MODULES: { key: ModuleKey; label: string; title: string }[] = [
  { key: "anthem", label: "Soul Anthem", title: "Soul Loop Anthem" },
  { key: "night", label: "The Night", title: "The Night" },
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
  journalPublished = false,
}: {
  event: LoopEvent;
  capacity: Capacity;
  anthem: AnthemState;
  runOfShow: RunOfShowItem[];
  /** A published Loop Journal issue makes last volume the pre-phase hype reel. */
  journalPublished?: boolean;
}) {
  const [active, setActive] = useState<ModuleKey | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [capacity, setCapacity] = useState<Capacity>(initialCapacity);

  // Keep the scarcity number fresh (mock Eventbrite now, live later).
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
        <ArcedTagline
          text="What are you dancing to?"
          className="text-ink"
          width={300}
        />
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

      {/* Scarcity + primary CTA */}
      <div className="flex flex-col items-center gap-3">
        <div className="text-sm font-bold uppercase tracking-widest opacity-75">
          {soldOut ? "Room is full" : (
            <>
              <span className="tabular-nums">{capacity.remaining}</span> / {capacity.total} passes left
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPassOpen(true)}
          className="w-full rounded-full bg-ink py-4 text-base font-bold text-sand transition-transform active:scale-95"
        >
          {soldOut ? "Join the Waitlist" : "Get Pass"}
        </button>

        {/* Module launchers */}
        <nav className="grid w-full grid-cols-2 gap-2">
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

      {/* Footer: Scott's Inn (poster placement) + subtle Legacy access */}
      <footer className="mt-5 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loop/branding/scotts-bw.svg" alt="Scott's Inn & Suites" className="h-8 w-auto" />
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
          </ModuleSheet>
        )}
      </AnimatePresence>

      {passOpen && <GetPassModal capacity={capacity} onClose={() => setPassOpen(false)} />}
    </div>
  );
}

export default GatheringPoster;
