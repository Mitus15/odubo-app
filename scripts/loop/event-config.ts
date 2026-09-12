import type { EventDetails } from "../../src/lib/loop/poster/layout";
import { EVENT_CREDITS } from "../../src/lib/loop/content";
import { MOCK_CURRENT_EVENT } from "../../src/lib/loop/hub";

/**
 * What every printed and rendered piece says about the night.
 *
 * Lived inside poster-kit.ts until the living poster needed it too. A script
 * that calls main() at import time cannot be imported, so the choice was to
 * copy the block or to move it — and a copy is exactly the failure this file
 * is here to prevent. The date has already moved twice; each time it was
 * retyped in more than one place, and a piece that disagrees with the front
 * door about which night it is cannot be corrected once it is out.
 */

/** "SATURDAY OCTOBER 10" — the venue's timezone, not the printer's. */
export function printedDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-CA", {
      timeZone: "America/Vancouver",
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase()
    .replace(",", "");
}

export type VolumeDetails = EventDetails & { venueShort: string };

export const VOLUMES: Record<string, VolumeDetails> = {
  1: {
    // Derived, never typed — see printedDate above.
    date: printedDate(MOCK_CURRENT_EVENT.date),
    // The one thing a reader has to act on is BE HERE BEFORE 8 — an end time
    // only tells them when to leave.
    doors: "DOORS 6:30 · ALBUM AT 8",
    venue: "SCOTT'S INN & SUITES · KAMLOOPS",
    venueShort: "SCOTT'S INN · KAMLOOPS",
    note: "DRESS CODE · 80s",
    record: EVENT_CREDITS.record.toUpperCase(),
    feature: EVENT_CREDITS.feature.toUpperCase(),
  },
  2: {
    date: "DATE TBD",
    doors: "DOORS 6:30 · ALBUM AT 8",
    venue: "SCOTT'S INN & SUITES · KAMLOOPS",
    venueShort: "SCOTT'S INN · KAMLOOPS",
    note: "DRESS CODE · TBD",
    record: "AN ALBUM BY MANI ODUBO",
  },
};
