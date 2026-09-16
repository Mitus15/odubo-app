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
 * The number on the ticket: "Nº 042". Capital N and the masculine ordinal
 * (U+00BA), NOT the numero sign (U+2116) — Jost, the ticket face, has no glyph
 * for it and Satori would draw a blank. Three digits because the room holds
 * 250; a bigger room simply grows past 999.
 */
export function formatSerial(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 1) return null;
  return `Nº ${String(Math.floor(n)).padStart(3, "0")}`;
}
