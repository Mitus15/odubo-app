import { executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { normEmail } from "@/lib/loop/album";

/**
 * The buyer's address, captured before checkout.
 *
 * Shopify Basic gives the app no Protected Customer Data, so a paid order
 * arrives with every contact field null. This is how the address reaches us
 * anyway: typed once on our own page, carried to Shopify as a cart attribute
 * (and used to prefill their checkout so it is never typed twice), then read
 * back off the order as a note_attribute, which needs no PII access.
 *
 * It is deliberately a promise and not a gate: no verification here, nothing
 * blocks the sale, and a buyer who skips it still gets a code. The worst case
 * is the admin attaching an address by hand, which is one tap because the
 * timestamp on the intent says which order it belongs to.
 */

export type PassIntent = { token: string; email: string; createdAt: string; orderId: string | null };

export async function createIntent(eventId: string, email: string): Promise<string> {
  const token = `pi_${crypto.randomUUID().replace(/-/g, "").slice(0, 22)}`;
  await executeQuery(
    `INSERT INTO loop_pass_intents (token, event_id, email, created_at) VALUES (?1, ?2, ?3, ?4)`,
    [token, eventId, normEmail(email), new Date().toISOString()],
  );
  return token;
}

/** Claim an intent for an order. Returns the address, or null if there is none. */
export async function claimIntent(token: string, orderId: string): Promise<string | null> {
  const row = await queryOne<{ email: string }>(
    `SELECT email FROM loop_pass_intents WHERE token = ?1`,
    [token],
  );
  if (!row) return null;
  await executeQuery(`UPDATE loop_pass_intents SET order_id = ?2 WHERE token = ?1`, [token, orderId]);
  return row.email;
}

/**
 * Addresses typed on the pass sheet that no order has claimed. The admin sees
 * these beside a pass with no address: the one typed seconds before the order
 * was placed is almost certainly the buyer.
 */
export async function openIntents(eventId: string, limit = 20): Promise<PassIntent[]> {
  const rows = await queryDatabase<{ token: string; email: string; created_at: string; order_id: string | null }>(
    `SELECT token, email, created_at, order_id FROM loop_pass_intents
      WHERE event_id = ?1 AND order_id IS NULL
      ORDER BY created_at DESC LIMIT ?2`,
    [eventId, limit],
  );
  return rows.map((r) => ({ token: r.token, email: r.email, createdAt: r.created_at, orderId: r.order_id }));
}

/**
 * The checkout link, carrying the address two ways: `checkout[email]` prefills
 * Shopify's own email field (verified against the live store), and
 * `attributes[loop_ref]` rides through to the order's note_attributes, which
 * the webhook can read without PII access.
 */
export function checkoutUrlWithIntent(base: string, email: string, token: string): string {
  const u = new URL(base);
  u.searchParams.set("checkout[email]", email);
  u.searchParams.set("attributes[loop_ref]", token);
  return u.toString();
}

/** The note_attribute the webhook looks for. */
export function refFromNoteAttributes(
  attrs: Array<{ name?: string | null; value?: string | null }> | null | undefined,
): string | null {
  for (const a of attrs ?? []) {
    if (a?.name === "loop_ref" && typeof a.value === "string" && a.value.trim()) return a.value.trim();
  }
  return null;
}
