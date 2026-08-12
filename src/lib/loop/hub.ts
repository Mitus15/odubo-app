import { getEventOverrides } from "@/lib/loop/event-store";
import { getStoredPhase } from "@/lib/loop/phase-store";

/**
 * The Loop Soul hub is a recurring series. Each event moves through phases;
 * State 3 (Legacy) is always reachable regardless of the current phase.
 *
 *   pre      → The Gathering  (discover, vote, get a pass + code)
 *   live     → The Portal     (in-room, event-code gated)
 *   archived → folded into Legacy; home points at the next event's `pre`
 *
 * The "current event" is still mocked, but the phase is now a GLOBAL, D1-backed
 * setting (`phase-store.ts`): an admin flip from /admin opens the Portal for
 * every visitor. It used to be a per-browser cookie — a launch-night footgun,
 * because the flip only took effect in the admin's own browser.
 */

export type EventPhase = "pre" | "live" | "archived";

export type LoopEvent = {
  id: string;
  /** Display name, e.g. "Volume 1 — 1984" */
  title: string;
  /** Theme used by the Lookbook + styling, e.g. "1984" */
  theme: string;
  /** Venue copy */
  venue: string;
  /** ISO date string for the event night */
  date: string;
  capacity: number;
  phase: EventPhase;
};

/** Mock "current event" until the D1 `events` table exists. */
export const MOCK_CURRENT_EVENT: LoopEvent = {
  id: "vol-1",
  title: "Volume 1",
  theme: "1984",
  venue: "Scott's Inn, Kamloops",
  // Anchored to 9pm Vancouver (PDT, −07:00) — not bare "2026-09-12", which JS
  // parses as UTC midnight and shows as Sep 11 in Pacific time, skewing every
  // derived anthem cutoff half a day early (see anthem-rounds.ts `derive`).
  date: "2026-09-12T21:00:00-07:00",
  capacity: 75,
  phase: "pre",
};

const VALID_PHASES: EventPhase[] = ["pre", "live", "archived"];

const asPhase = (v: string | undefined): EventPhase | null =>
  VALID_PHASES.includes(v as EventPhase) ? (v as EventPhase) : null;

/**
 * Resolve the active phase for the current event.
 *
 * Order of precedence:
 *   1. `LOOP_FORCE_PHASE` — **local development only**, see below.
 *   2. The D1-stored phase — an explicit admin choice, global to all visitors.
 *   3. `NEXT_PUBLIC_DEFAULT_PHASE` — a per-deploy/local default (handy for
 *      previewing a phase before any admin has set one).
 *   4. The seed default (`pre`).
 *
 * D1 wins over `NEXT_PUBLIC_DEFAULT_PHASE` on purpose: once an admin sets a
 * phase it must be authoritative, otherwise a pinned env default would make
 * the /admin switch a no-op in production.
 *
 * That correct rule had a sharp edge, though. Local development runs against
 * the PRODUCTION database, so once a phase is stored there — which it is — the
 * only way to see another phase locally was to flip the real one, which
 * changes what every visitor to /loop sees. That has already caught us out
 * once. `LOOP_FORCE_PHASE` is the escape hatch: it outranks everything, and it
 * is ignored outright in a production build, so it cannot be used to override
 * an admin on the live site even if someone sets it on the deploy.
 */
export async function getCurrentPhase(): Promise<EventPhase> {
  if (process.env.NODE_ENV !== "production") {
    const forced = asPhase(process.env.LOOP_FORCE_PHASE);
    if (forced) return forced;
  }

  const stored = await getStoredPhase(MOCK_CURRENT_EVENT.id);
  if (stored) return stored;

  return asPhase(process.env.NEXT_PUBLIC_DEFAULT_PHASE) ?? MOCK_CURRENT_EVENT.phase;
}

export async function getCurrentEvent(): Promise<LoopEvent> {
  const phase = await getCurrentPhase();
  // Admin-editable details (theme/title/venue) layer over the seed; id, date,
  // capacity, and phase stay controlled here.
  const overrides = await getEventOverrides(MOCK_CURRENT_EVENT.id);
  return { ...MOCK_CURRENT_EVENT, ...overrides, phase };
}
