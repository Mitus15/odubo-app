import { chunkForParams, executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";

/**
 * Minimal event-code slice — the start of the event-code core (the same
 * primitive State 2 / Legacy will use), scoped here to the Soul Loop Anthem's
 * "who can suggest" gate.
 *
 * Suggesting a song is a perk of having a pass: admin bulk-generates unique
 * single-use codes, hands one to each buyer, and the buyer redeems it to become
 * a "holder" who can nominate. Upvoting and bracket voting stay open to everyone.
 *
 * Driven by a mode: `open` (anyone can suggest — the
 * promo default before tickets exist) or `ticket` (holders only). Scoped per
 * event, backed by D1. Reuses the existing `ls_voter` identity, so no new
 * cookie. Known limits (promo-acceptable): clearing cookies drops holder status;
 * a leaked code lets a non-buyer suggest.
 */

export type GateMode = "open" | "ticket";

function defaultGate(): GateMode {
  return process.env.ANTHEM_SUGGEST_GATE === "ticket" ? "ticket" : "open";
}

export async function gateMode(eventId: string): Promise<GateMode> {
  const row = await queryOne<{ mode: GateMode }>(
    `SELECT mode FROM event_gate WHERE event_id = ?1`,
    [eventId],
  );
  return row?.mode ?? defaultGate();
}

export async function setGate(eventId: string, mode: GateMode): Promise<void> {
  await executeQuery(
    `INSERT INTO event_gate (event_id, mode) VALUES (?1, ?2)
     ON CONFLICT (event_id) DO UPDATE SET mode = excluded.mode`,
    [eventId, mode],
  );
}

/** Wipe an event's codes, holders, and gate override (simulator "reset"). */
export async function reset(eventId: string): Promise<void> {
  await executeQuery(`DELETE FROM event_codes WHERE event_id = ?1`, [eventId]);
  await executeQuery(`DELETE FROM event_holders WHERE event_id = ?1`, [eventId]);
  await executeQuery(`DELETE FROM event_gate WHERE event_id = ?1`, [eventId]);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (no 0/O/1/I)

function randomCode(taken: Set<string>): string {
  // Deterministic-free: derive 4 chars from crypto so codes don't collide.
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
    const code = `LOOP-${body}`;
    if (!taken.has(code)) return code;
  }
  // Extremely unlikely fallback.
  return `LOOP-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

/** Every code already issued for an event — the set `randomCode` avoids. */
async function takenCodes(eventId: string): Promise<Set<string>> {
  const rows = await queryDatabase<{ code: string }>(
    `SELECT code FROM event_codes WHERE event_id = ?1`,
    [eventId],
  );
  return new Set(rows.map((r) => r.code));
}

/** Bulk-generate `count` fresh unique codes for an event; returns them to hand out. */
export async function generate(eventId: string, count: number, now: number): Promise<string[]> {
  if (count < 1) return [];

  const taken = await takenCodes(eventId);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomCode(taken);
    taken.add(code); // don't collide within this batch either
    out.push(code);
  }

  // Batched inserts rather than N round-trips. Chunked because the admin can ask
  // for up to 100 codes at once, and D1 binds at most 100 variables per
  // statement — the event id and timestamp take two of them.
  for (const chunk of chunkForParams(out, 1, 2)) {
    const values = chunk.map((_, i) => `(?1, ?${i + 3}, NULL, ?2)`).join(", ");
    await executeQuery(
      `INSERT INTO event_codes (event_id, code, redeemed_by, created_at) VALUES ${values}`,
      [eventId, now, ...chunk],
    );
  }
  return out;
}

/**
 * Mint exactly one unique code bound to a ticket order — idempotent per order,
 * so re-delivering the confirmation never issues a second code. This is the hook
 * real checkout calls: buy a pass on Shopify → one unique code for that order.
 * The same function backs the admin "simulate a purchase" tool, so the whole
 * flow is testable without taking money.
 *
 * Idempotency is enforced by the UNIQUE index on (event_id, order_id), not just
 * by the read below — so even two webhook deliveries racing each other can only
 * ever produce one code.
 */
export async function issueForOrder(
  eventId: string,
  orderId: string,
  email: string | null,
  now: number,
): Promise<{ code: string; isNew: boolean }> {
  const existing = await codeForOrder(eventId, orderId);
  if (existing) return { code: existing, isNew: false };

  const code = randomCode(await takenCodes(eventId));
  const meta = await executeQuery(
    `INSERT OR IGNORE INTO event_codes
       (event_id, code, redeemed_by, created_at, order_id, email)
     VALUES (?1, ?2, NULL, ?3, ?4, ?5)`,
    [eventId, code, now, orderId, email],
  );

  // changes === 0 means the unique index rejected us: another delivery of the
  // same order won the race. Hand back the code it created, not a second one.
  if (meta.changes === 0) {
    const winner = await codeForOrder(eventId, orderId);
    if (winner) return { code: winner, isNew: false };
  }

  return { code, isNew: true };
}

/**
 * Every code bought with this email address. The buyer's own recovery path
 * when the confirmation email doesn't arrive — which, with no verified sending
 * domain, is the normal case rather than the exception (see
 * docs/decisions/loop-soul-product-architecture.md). Matching is
 * case-insensitive and trimmed because people type their address by hand.
 */
export async function codesForEmail(
  eventId: string,
  email: string,
): Promise<{ code: string; redeemed: boolean }[]> {
  const rows = await queryDatabase<{ code: string; redeemed_by: string | null }>(
    `SELECT code, redeemed_by FROM event_codes
      WHERE event_id = ?1 AND LOWER(TRIM(email)) = ?2
      ORDER BY created_at ASC`,
    [eventId, email.trim().toLowerCase()],
  );
  return rows.map((r) => ({ code: r.code, redeemed: r.redeemed_by !== null }));
}

export async function codeForOrder(eventId: string, orderId: string): Promise<string | null> {
  const row = await queryOne<{ code: string }>(
    `SELECT code FROM event_codes WHERE event_id = ?1 AND order_id = ?2`,
    [eventId, orderId],
  );
  return row?.code ?? null;
}

export type RedeemResult = { ok: boolean; reason?: "unknown" | "used" };

/** Redeem a code for a voter → marks them a holder. Single-use, idempotent for the same voter. */
export async function redeem(
  eventId: string,
  code: string,
  voterId: string,
): Promise<RedeemResult> {
  const normalized = code.trim().toUpperCase();
  const record = await queryOne<{ redeemed_by: string | null }>(
    `SELECT redeemed_by FROM event_codes WHERE event_id = ?1 AND code = ?2`,
    [eventId, normalized],
  );

  if (!record) return { ok: false, reason: "unknown" };
  if (record.redeemed_by && record.redeemed_by !== voterId) return { ok: false, reason: "used" };

  // Re-check redeemed_by in the WHERE clause so two voters racing on the same
  // unredeemed code can't both come away holders.
  const meta = await executeQuery(
    `UPDATE event_codes SET redeemed_by = ?3
      WHERE event_id = ?1 AND code = ?2
        AND (redeemed_by IS NULL OR redeemed_by = ?3)`,
    [eventId, normalized, voterId],
  );
  if (meta.changes === 0) return { ok: false, reason: "used" };

  await executeQuery(
    `INSERT OR IGNORE INTO event_holders (event_id, voter_id) VALUES (?1, ?2)`,
    [eventId, voterId],
  );
  return { ok: true };
}

export async function isHolder(eventId: string, voterId: string): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM event_holders WHERE event_id = ?1 AND voter_id = ?2`,
    [eventId, voterId],
  );
  return (row?.n ?? 0) > 0;
}

/** Whether this voter may suggest: anyone in `open` mode, holders only in `ticket`. */
export async function canSuggest(eventId: string, voterId: string): Promise<boolean> {
  // Both facts in one round-trip — this is on the hot path for every page load
  // that renders the suggest box.
  const row = await queryOne<{ mode: GateMode | null; holder: number }>(
    `SELECT (SELECT mode FROM event_gate WHERE event_id = ?1) AS mode,
            (SELECT COUNT(*) FROM event_holders
              WHERE event_id = ?1 AND voter_id = ?2) AS holder`,
    [eventId, voterId],
  );
  const mode = row?.mode ?? defaultGate();
  return mode === "open" || (row?.holder ?? 0) > 0;
}

export async function countRedeemed(eventId: string): Promise<{ total: number; redeemed: number }> {
  const row = await queryOne<{ total: number; redeemed: number }>(
    `SELECT COUNT(*) AS total,
            COUNT(redeemed_by) AS redeemed
       FROM event_codes WHERE event_id = ?1`,
    [eventId],
  );
  return { total: row?.total ?? 0, redeemed: row?.redeemed ?? 0 };
}

export async function listCodes(eventId: string): Promise<{ code: string; redeemed: boolean }[]> {
  const rows = await queryDatabase<{ code: string; redeemed_by: string | null }>(
    `SELECT code, redeemed_by FROM event_codes WHERE event_id = ?1`,
    [eventId],
  );
  return rows.map((r) => ({ code: r.code, redeemed: r.redeemed_by !== null }));
}
