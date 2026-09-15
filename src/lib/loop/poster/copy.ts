import type { PosterSize } from "./layout";

/**
 * Small, source-agnostic helpers the poster layouts use.
 *
 * These were the two genuinely reusable functions inside poster/tournament.ts,
 * which mapped the anthem tournament onto the layout engine. The anthem is
 * gone; the geometry (layoutTournament and its family) is not, because it is
 * pure and has no idea what it is drawing. These come with it.
 */

/** The crowd holds the grid when there is nothing to quote yet. */
export const TOURNAMENT_EMPTY_FIGURE = "/loop/figures/crowd.png";

/**
 * Single indirection for artwork URLs. Stored artwork is 600px (2in at
 * 300dpi) — print upsizes through Apple's size-in-path scheme. If mzstatic
 * ever needs a proxy, this is the one line that changes.
 */
export function artUrl(url: string | null | undefined, size: PosterSize): string {
  if (!url) return "";
  return size === "print" ? url.replace(/\/\d+x\d+bb\./, "/1500x1500bb.") : url;
}

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

/**
 * "CLOSES …" for a cutoff. Absolute for print (a printed relative date is
 * stale the moment it leaves the printer); relative for story/feed, which
 * live for hours.
 */
export function closesLine(closesAt: number, size: PosterSize, now: number): string {
  const d = new Date(closesAt);
  if (size === "print") return `CLOSES ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const ms = closesAt - now;
  if (ms <= 0) return "CLOSED";
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 1) return "CLOSES WITHIN THE HOUR";
  if (hours < 24) return `CLOSES IN ${hours} HOURS`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? "CLOSES TOMORROW" : `CLOSES IN ${days} DAYS`;
}
