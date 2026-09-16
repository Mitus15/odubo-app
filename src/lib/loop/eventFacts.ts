import type { RunOfShowItem } from "@/lib/loop/content";

/**
 * The facts of the night, formatted once.
 *
 * The pass email carried "Saturday 10 October", "8", "9", "10", "19+" and
 * "80s" as string literals, and the pass sheet carried its own copies. One
 * fact in two places is how a sheet sold "the 26th" under an Oct 10 header for
 * three days. Every guest-facing sentence about when and where now reads from
 * here, and here reads from the event record and the run of show.
 *
 * Import-free apart from a type, so it is testable without a database.
 */

const TZ = "America/Vancouver";

export type NightFacts = { date: string; venue: string; theme: string };

/** "Saturday 10 October" */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
}

/** "Sat Oct 10" */
export function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-CA", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" })
    .replace(",", "");
}

/** "6:30 p.m." */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** "6:30" — the meridiem is obvious for a night out. */
export function bareTime(iso: string): string {
  return clockTime(iso).replace(/\s*[ap]\.?\s?m\.?$/i, "").trim();
}

/** "Scott's Inn, Kamloops" → "Scott's Inn" */
export function venueShort(venue: string): string {
  return venue.split(",")[0].trim();
}

/** The one line: "Saturday 10 October · Scott's Inn, Kamloops · from 6:30" */
export function factsLine(e: NightFacts): string {
  return `${longDate(e.date)} · ${e.venue} · from ${bareTime(e.date)}`;
}

/** "8:00" → "8", "9:30" stays "9:30". */
function tidy(time: string): string {
  return time.trim().replace(/:00$/, "");
}

/** When the record plays and when the floor opens, from the programme. */
export function programmeTimes(items: RunOfShowItem[]): { album: string; floor: string } | null {
  const album = items.find((i) => i.id === "album")?.time;
  const floor = items.find((i) => i.id === "floor")?.time;
  if (!album || !floor) return null;
  return { album: tidy(album), floor: tidy(floor) };
}

/** "The album live at 8. 80s floor at 9. 19+. Dress code 80s." */
export function nightLine(theme: string, items: RunOfShowItem[]): string {
  const t = programmeTimes(items);
  return t
    ? `The album live at ${t.album}. ${theme} floor at ${t.floor}. 19+. Dress code ${theme}.`
    : `The album, live. Then the ${theme} floor. 19+. Dress code ${theme}.`;
}
