import type { EventDetails } from "@/lib/loop/poster/layout";
import { EVENT_CREDITS } from "@/lib/loop/content";
import { MOCK_CURRENT_EVENT } from "@/lib/loop/hub";

/**
 * What every printed and rendered piece says about the night.
 *
 * One block, read by the print kit, the living poster AND the studio in the
 * admin. It lived under scripts/ and the studio typed its own copy (DOORS
 * 9PM, no 19+, no feature credit), which is exactly the failure this file is
 * here to prevent: the date has already moved twice, and a piece that
 * disagrees with the front door about the night cannot be corrected once it
 * is out.
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
    // Shares the row with the price: prints "19+ · DRESS CODE 80s · $5". The
    // age is a licensing condition of the night and was on no printed piece.
    note: "19+ · DRESS CODE 80s",
    record: EVENT_CREDITS.record.toUpperCase(),
    feature: EVENT_CREDITS.feature.toUpperCase(),
  },
  2: {
    date: "DATE TBD",
    doors: "DOORS 6:30 · ALBUM AT 8",
    venue: "SCOTT'S INN & SUITES · KAMLOOPS",
    venueShort: "SCOTT'S INN · KAMLOOPS",
    note: "19+ · DRESS CODE TBD",
    record: EVENT_CREDITS.record.toUpperCase(),
  },
};
