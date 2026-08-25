/**
 * How the price reads on artwork and on the front door.
 *
 * Deliberately import-free: the front door is a client component and the print
 * kit is a Node script, and both must format the price identically. Anything
 * that touches D1 lives in loopSetting.ts, which a client bundle must never
 * pull in.
 *
 * An unset or zero price means the door is free — that is the switch. Because
 * both callers use this one function, "free" is one setting, and the poster on
 * the wall can never tell a visitor something the app contradicts.
 */
export function priceLabel(
  price: string | null | undefined,
  currency: string | null | undefined,
): string {
  const n = Number(price);
  if (!price || !Number.isFinite(n) || n <= 0) return "FREE ENTRY";
  const amount = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return currency && currency.toUpperCase() !== "CAD"
    ? `$${amount} ${currency.toUpperCase()}`
    : `$${amount}`;
}
