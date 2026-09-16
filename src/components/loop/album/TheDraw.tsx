"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * The moment the record opens up to you.
 *
 * The two extra songs were always chosen the instant the page loaded, silently,
 * and then listed in a player like a receipt. The choosing is the interesting
 * part: this is the first thing a new pass-holder sees, seconds after paying,
 * and it is the only chance the album gets to introduce itself.
 *
 * So the draw is performed. It is NOT a slot machine — the house style is
 * typographic and the room is a listening room, so the titles rise and settle
 * rather than spin and clatter. Nothing here decides anything: the pair is
 * already fixed, seeded on the buyer's address (see album.ts). This shows a
 * decision that has already been made, which is what every good reveal is.
 *
 * Plays once per album per device. Skippable at every moment, because a person
 * coming back for the music should never have to sit through a ceremony again.
 */

type Props = {
  albumTitle: string;
  artist: string;
  total: number;
  freeTitle: string;
  dealtTitles: string[];
  /** Everything that COULD have been dealt — what the names flicker through. */
  poolTitles: string[];
  onDone: () => void;
};

type Act = "open" | "free" | "draw" | "yours";

const RULE = "border-t border-[color-mix(in_srgb,var(--foreground)_15%,transparent)]";

export default function TheDraw({
  albumTitle,
  artist,
  total,
  freeTitle,
  dealtTitles,
  poolTitles,
  onDone,
}: Props) {
  const reduced = useReducedMotion();
  const [act, setAct] = useState<Act>("open");
  // How many of the dealt titles have settled. -1 while the names are moving.
  const [settled, setSettled] = useState(0);
  const [flicker, setFlicker] = useState(poolTitles[0] ?? "");
  const timers = useRef<number[]>([]);

  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    // Copied out: by cleanup time the ref may point elsewhere, and a timer
    // that outlives this component fires setState on a corpse.
    const pending = timers.current;
    return () => pending.forEach(window.clearTimeout);
  }, []);

  // The score. Each act hands off to the next; reduced motion collapses the
  // timings rather than removing the steps, so the story still reads.
  useEffect(() => {
    const beat = reduced ? 380 : 1500;
    after(beat, () => setAct("free"));
    after(beat * 2.1, () => setAct("draw"));
  }, [reduced]);

  // The names moving. Decelerating, then landing on one, then the next.
  useEffect(() => {
    if (act !== "draw") return;
    if (reduced || poolTitles.length === 0) {
      setSettled(dealtTitles.length);
      after(500, () => setAct("yours"));
      return;
    }
    let i = 0;
    let delay = 55;
    let landed = 0;

    const step = () => {
      i = (i + 1) % poolTitles.length;
      setFlicker(poolTitles[i]);
      delay *= 1.14; // slowing down is what makes it feel like a decision
      if (delay < 300) {
        timers.current.push(window.setTimeout(step, delay));
        return;
      }
      landed += 1;
      setSettled(landed);
      if (landed < dealtTitles.length) {
        delay = 55;
        timers.current.push(window.setTimeout(step, 620));
      } else {
        after(900, () => setAct("yours"));
      }
    };
    timers.current.push(window.setTimeout(step, 260));
  }, [act, reduced, poolTitles, dealtTitles.length]);

  // Exit fast, enter slow. `mode="wait"` plays the exit to completion BEFORE
  // the next act enters, so a symmetric half-second each way left more than a
  // second of empty black between acts, which reads as a broken page rather
  // than a beat. The exit is now a blink and the entrance keeps its weight.
  const ease = [0.16, 1, 0.3, 1] as const;
  const fade = {
    initial: { opacity: 0, y: reduced ? 0 : 14 },
    animate: { opacity: 1, y: 0, transition: { duration: reduced ? 0.15 : 0.5, ease } },
    exit: { opacity: 0, y: reduced ? 0 : -8, transition: { duration: reduced ? 0.08 : 0.2, ease } },
  };

  return (
    <main className="loop-theme flex min-h-[100dvh] flex-col bg-[var(--background)] px-6 text-[var(--foreground)]" data-mode="vault">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          {act === "open" && (
            <motion.div key="open" {...fade}>
              <p className="text-[11px] uppercase tracking-[0.35em] opacity-60">{albumTitle}</p>
              <p className="mt-6 text-3xl font-extrabold leading-tight">
                {total} tracks.
                <br />
                {dealtTitles.length + 1} are yours tonight.
              </p>
              <p className="mt-4 text-sm opacity-60">The rest after the night.</p>
            </motion.div>
          )}

          {act === "free" && (
            <motion.div key="free" {...fade}>
              <p className="text-[11px] uppercase tracking-[0.35em] opacity-60">Everybody gets this one</p>
              <p className="mt-5 text-4xl font-extrabold leading-tight">{freeTitle}</p>
            </motion.div>
          )}

          {act === "draw" && (
            <motion.div key="draw" {...fade} className="w-full max-w-sm">
              <p className="text-[11px] uppercase tracking-[0.35em] opacity-60">
                {dealtTitles.length === 1 ? "And one drawn for you" : `And ${dealtTitles.length} drawn for you`}
              </p>
              <ul className="mt-6 grid gap-3">
                {dealtTitles.map((title, i) => {
                  const done = i < settled;
                  const active = i === settled;
                  return (
                    <li
                      key={title}
                      className={`${RULE} pt-3 text-2xl font-extrabold tabular-nums transition-opacity ${
                        done ? "opacity-100" : active ? "opacity-90" : "opacity-25"
                      }`}
                    >
                      {done ? (
                        <motion.span
                          initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className="block"
                        >
                          {title}
                        </motion.span>
                      ) : active ? (
                        <span className="block opacity-70">{flicker}</span>
                      ) : (
                        <span className="block opacity-30">·</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}

          {act === "yours" && (
            <motion.div key="yours" {...fade} className="w-full max-w-sm">
              <p className="text-[11px] uppercase tracking-[0.35em] opacity-60">Yours until the night</p>
              <ul className="mt-6 text-left">
                {[freeTitle, ...dealtTitles].map((title, i) => (
                  <motion.li
                    key={title}
                    initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduced ? 0 : 0.1 * i, duration: 0.45 }}
                    className={`${RULE} py-3 text-xl font-bold`}
                  >
                    {title}
                  </motion.li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-relaxed opacity-60">
                {artist}. Somebody else in the room was dealt a different two. Between you, most of the record
                is already out.
              </p>
              <button
                type="button"
                onClick={onDone}
                className="mt-8 min-h-[52px] w-full rounded-full bg-[var(--foreground)] text-base font-extrabold text-[var(--background)]"
              >
                Play
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Always escapable. Someone here for the music, not the ceremony. */}
      <button
        type="button"
        onClick={onDone}
        className="mx-auto mb-8 min-h-[44px] text-[11px] font-bold uppercase tracking-[0.3em] opacity-40"
      >
        {act === "yours" ? "Skip" : "Skip the draw"}
      </button>
    </main>
  );
}
