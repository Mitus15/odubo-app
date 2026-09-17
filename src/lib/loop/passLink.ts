/**
 * The claim link, the pure part.
 *
 * A pass email carries one link per ticket. Opening it binds the phone that
 * opened it, with no six digits to type: the email is the proof of the inbox,
 * which is the same proof the six digits give. The token is long, random and
 * stored only as a peppered hash, so a database read leaks nothing usable and
 * the plaintext exists in exactly one place, the email.
 *
 * Import-free on purpose (no DB, no next/*) so the rule is under test without
 * a database and the Node scripts can use it.
 */

export const PASS_LINK_PREFIX = "pl_";

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 random bytes, URL-safe. */
export function newPassLinkToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return PASS_LINK_PREFIX + base64url(bytes);
}

/** The shape a real token has; anything else is refused before the database is asked. */
export function isPassLinkToken(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^pl_[A-Za-z0-9_-]{40,48}$/.test(raw);
}

/** SHA-256 of `token|pepper`, hex. The pepper keeps a leaked table useless. */
export async function hashPassLinkToken(token: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`${token.trim()}|${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type PassLinkDestination = "record" | "room";

/** Where the email sends somebody. `base` is `public_base_url`, never typed. */
export function passLinkUrl(token: string, base: string, to: PassLinkDestination = "record"): string {
  const origin = base.replace(/\/+$/, "");
  return `${origin}/loop/p/${token}${to === "room" ? "?to=room" : ""}`;
}

/**
 * A pass unit's order id is `shopify:<order>#<n>`. The first unit is the
 * buyer's own ticket; the others were bought for somebody else.
 */
export function parseUnitOrderId(orderId: string | null | undefined): { order: string; unit: number } | null {
  const m = (orderId ?? "").match(/^shopify:(.+)#(\d+)$/);
  if (!m) return null;
  return { order: m[1], unit: Number(m[2]) };
}

/**
 * The number on the ticket, and the only reference a guest ever sees.
 *
 * `serial` is the true count of passes sold, which is exactly why it must not
 * be shown: "Nº 002" tells the second buyer they are the second buyer, and a
 * room that looks empty is a room nobody wants to walk into. Shopify has the
 * same problem and cannot fix it — no plan below Plus lets you move the order
 * counter off 1001, only prefix it — so the public number is ours instead.
 *
 * This maps the serial onto a six-digit number that looks like a real order
 * reference and reveals nothing about order. It is a modular multiplication:
 * 900000 factors as 2^5 · 3^2 · 5^5, and the multiplier shares none of those
 * factors, so it is a BIJECTION over the whole six-digit range. Every pass
 * gets its own number, the same one every time, and consecutive sales land
 * nowhere near each other:
 *
 *   1 -> OS-473837    2 -> OS-847674    3 -> OS-321511
 *
 * Deterministic, so it needs no column and no backfill: the ledger keeps the
 * honest count for the owner, and the guest gets a number that says nothing.
 */
const NUMBER_BASE = 100000;
const NUMBER_SPAN = 900000;
/** Coprime to 900000: odd, and divisible by neither 3 nor 5. */
const NUMBER_STRIDE = 373837;

export const PASS_NUMBER_PREFIX = "OS-";

/** The six digits alone, e.g. "473837". Null when there is no number. */
export function passNumberDigits(serial: number | null | undefined): string | null {
  if (serial === null || serial === undefined || !Number.isFinite(serial) || serial < 1) return null;
  const n = Math.floor(serial);
  return String(NUMBER_BASE + ((n * NUMBER_STRIDE) % NUMBER_SPAN));
}

/** The public reference, e.g. "OS-473837". Null for door comps and simulated sales. */
export function publicPassNumber(serial: number | null | undefined): string | null {
  const digits = passNumberDigits(serial);
  return digits === null ? null : PASS_NUMBER_PREFIX + digits;
}
