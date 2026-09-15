/**
 * What the public may know about how full the room is.
 *
 * The counter used to publish the exact figure — "248 / 250 passes left" on
 * the poster, and `{sold, remaining}` from an API anyone can curl. That is a
 * live sales report handed to every visitor, and early in a campaign it reads
 * as "nobody is coming", which is the opposite of what a scarcity line is for.
 *
 * So the room's SIZE is public and its SALES are not. A finite room is the
 * offer and should be said out loud; how many have bought is the owner's
 * business until the number left is genuinely low, at which point it stops
 * being a sales report and becomes a warning the buyer needs.
 *
 * `sold` never leaves the server. The admin has the real figures.
 */

export type CapacityState = "open" | "filling" | "last" | "full";

export type PublicCapacity =
  | { unlimited: true }
  | {
      unlimited: false;
      total: number;
      state: CapacityState;
      /** Only once it is low enough to matter. Null while the room is open. */
      remaining: number | null;
    };

export type RevealThresholds = { filling: number; last: number };

/** Defaults sized for a 250-room: quiet until a fifth is left, urgent at 20. */
export const REVEAL_DEFAULTS: RevealThresholds = { filling: 50, last: 20 };

/** Pure, so the rule is testable and the server is the only thing that knows `sold`. */
export function publicView(
  info: { unlimited: boolean; total: number | null; remaining: number | null },
  t: RevealThresholds = REVEAL_DEFAULTS,
): PublicCapacity {
  if (info.unlimited || info.total === null || info.remaining === null) return { unlimited: true };
  const { total, remaining } = info;
  if (remaining <= 0) return { unlimited: false, total, state: "full", remaining: 0 };
  if (remaining <= t.last) return { unlimited: false, total, state: "last", remaining };
  if (remaining <= t.filling) return { unlimited: false, total, state: "filling", remaining };
  // Open: the size of the room, and nothing about sales.
  return { unlimited: false, total, state: "open", remaining: null };
}

export function isSoldOut(c: PublicCapacity): boolean {
  return !c.unlimited && c.state === "full";
}

/**
 * The one line every surface shows, so the poster, the pass sheet and the
 * store can never disagree about how full the night is.
 */
export function capacityLine(c: PublicCapacity, opts: { free?: boolean } = {}): string | null {
  if (c.unlimited) return null;
  switch (c.state) {
    case "full":
      return "Room is full";
    case "last":
    case "filling":
      return `${c.remaining} ${opts.free ? "spots" : "passes"} left`;
    case "open":
      return `${c.total} in the room`;
  }
}

/** True when the line is a warning rather than a fact — surfaces colour it. */
export function isUrgent(c: PublicCapacity): boolean {
  return !c.unlimited && (c.state === "last" || c.state === "full");
}
