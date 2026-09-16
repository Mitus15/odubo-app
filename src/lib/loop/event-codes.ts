import { chunkForParams, executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";

/**
 * Event codes — the door, and the one thing that makes the vote countable.
 *
 * A code is minted per pass sold (or bulk-generated for the door), handed to
 * one buyer, and redeemed once to make that `ls_voter` a HOLDER. Scoped per
 * event, backed by D1, reusing the existing cookie so there is no new identity.
 *
 * What holding is still for, now that `doors_open` exists:
 *
 * Every room surface (the Wall, the camera, Pose, the Vault) asks
 * `hasRoomAccess`, which a promoter can satisfy for everyone at once by opening
 * the doors. The BALLOTS do not: they ask `isHolder` directly, deliberately.
 * They decide the vinyl's cover and running order, the cover pays $50 and a
 * royalty, and a single-use code is the only thing here that makes a fake vote
 * cost a real pass. `ls_voter` is unforgeable but freely clearable, so anything
 * keyed on the cookie alone is stuffable from an incognito window.
 *
 * Known limit: clearing cookies drops holder status. /loop/code is the way back
 * (prove the checkout email, take the pass onto this device).
 *
 * This file also used to own the anthem's "who may suggest a song" gate
 * (gateMode/setGate/canSuggest, over the `event_gate` table). The anthem is
 * deleted; that gate went with it, and the table is left in place unused.
 */

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

  // Real sales get a running number; the admin's simulated ones never do.
  if (!orderId.startsWith("sim:")) await assignSerial(eventId, code);

  return { code, isNew: true };
}

/**
 * The pass number: the next integer for this event, in one statement so two
 * webhooks racing cannot both read the same MAX. The unique index on
 * (event_id, serial) is the backstop; a collision there is retried.
 */
export async function assignSerial(eventId: string, code: string): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await executeQuery(
        `UPDATE event_codes
            SET serial = (SELECT COALESCE(MAX(serial), 0) + 1 FROM event_codes WHERE event_id = ?1)
          WHERE event_id = ?1 AND code = ?2 AND serial IS NULL`,
        [eventId, code],
      );
      const row = await queryOne<{ serial: number | null }>(
        `SELECT serial FROM event_codes WHERE event_id = ?1 AND code = ?2`,
        [eventId, code],
      );
      return row?.serial ?? null;
    } catch (e) {
      if (attempt === 2) console.error(`[loop:codes] could not number ${code}:`, e);
    }
  }
  return null;
}

/** How many pass units one Shopify order minted (`shopify:<id>#1`, `#2`, …). */
export async function orderUnitCount(eventId: string, shopifyOrderId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM event_codes WHERE event_id = ?1 AND order_id LIKE ?2`,
    [eventId, `shopify:${shopifyOrderId}#%`],
  );
  return row?.n ?? 0;
}

/**
 * TAKE a code onto this device, whoever held it before.
 *
 * The claim link in the pass email is proof of the inbox, the same proof the
 * six digits give, so it may move a pass the way the six digits do. `redeem`
 * refuses a code another device holds; that is right for a code typed at a
 * gate and wrong for a link, because mail scanners open links before the
 * buyer does, and a buyer who opens Guest 2's link before forwarding it would
 * otherwise lock their friend out. The previous holder loses holder status
 * only if it holds nothing else for this event.
 */
export async function takeCode(eventId: string, code: string, voterId: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  const record = await queryOne<{ redeemed_by: string | null }>(
    `SELECT redeemed_by FROM event_codes WHERE event_id = ?1 AND code = ?2`,
    [eventId, normalized],
  );
  if (!record) return false;
  const previous = record.redeemed_by;
  if (previous !== voterId) {
    await executeQuery(
      `UPDATE event_codes SET redeemed_by = ?3 WHERE event_id = ?1 AND code = ?2`,
      [eventId, normalized, voterId],
    );
  }
  await executeQuery(
    `INSERT OR IGNORE INTO event_holders (event_id, voter_id) VALUES (?1, ?2)`,
    [eventId, voterId],
  );
  if (previous && previous !== voterId) {
    const still = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM event_codes WHERE event_id = ?1 AND redeemed_by = ?2`,
      [eventId, previous],
    );
    if ((still?.n ?? 0) === 0) {
      await executeQuery(`DELETE FROM event_holders WHERE event_id = ?1 AND voter_id = ?2`, [eventId, previous]);
    }
  }
  return true;
}

/** The passes this device holds, for "Your ticket" without a lookup. */
export async function codesHeldBy(
  eventId: string,
  voterId: string,
): Promise<{ code: string; serial: number | null; redeemed: boolean }[]> {
  if (!voterId || voterId === "anonymous") return [];
  const rows = await queryDatabase<{ code: string; serial: number | null }>(
    `SELECT code, serial FROM event_codes WHERE event_id = ?1 AND redeemed_by = ?2 ORDER BY created_at ASC`,
    [eventId, voterId],
  );
  return rows.map((r) => ({ code: r.code, serial: r.serial ?? null, redeemed: true }));
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
): Promise<{ code: string; serial: number | null; redeemed: boolean }[]> {
  const rows = await queryDatabase<{ code: string; serial: number | null; redeemed_by: string | null }>(
    `SELECT code, serial, redeemed_by FROM event_codes
      WHERE event_id = ?1 AND LOWER(TRIM(email)) = ?2
      ORDER BY created_at ASC`,
    [eventId, email.trim().toLowerCase()],
  );
  return rows.map((r) => ({ code: r.code, serial: r.serial ?? null, redeemed: r.redeemed_by !== null }));
}

/**
 * Put an address on a pass that was minted without one. Overwrites on purpose:
 * the only reason to call it is that the address on file is missing or wrong,
 * and the admin is looking at the order in Shopify while typing it.
 */
export async function attachEmail(eventId: string, code: string, email: string): Promise<boolean> {
  const meta = await executeQuery(
    `UPDATE event_codes SET email = ?3 WHERE event_id = ?1 AND code = ?2`,
    [eventId, code.trim().toUpperCase(), email.trim().toLowerCase()],
  );
  return meta.changes > 0;
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

/* ── the door ─────────────────────────────────────────────────────────────── */

export type DoorLookup = {
  code: string;
  /** The pass number on the ticket. Null for door comps and simulated sales. */
  serial: number | null;
  email: string | null;
  orderId: string | null;
  /** Opened the app with it (a device binding). Not the same as being let in. */
  redeemed: boolean;
  /** Let in at the door, ISO time. Null until scanned. */
  admittedAt: string | null;
  /** A simulated purchase from the admin, never a real ticket. */
  sim: boolean;
};

export async function lookupCode(eventId: string, code: string): Promise<DoorLookup | null> {
  const row = await queryOne<{
    code: string;
    serial: number | null;
    email: string | null;
    order_id: string | null;
    redeemed_by: string | null;
    admitted_at: string | null;
  }>(
    `SELECT code, serial, email, order_id, redeemed_by, admitted_at
       FROM event_codes WHERE event_id = ?1 AND code = ?2`,
    [eventId, code.trim().toUpperCase()],
  );
  if (!row) return null;
  return {
    code: row.code,
    serial: row.serial ?? null,
    email: row.email,
    orderId: row.order_id,
    redeemed: row.redeemed_by !== null,
    admittedAt: row.admitted_at,
    sim: (row.order_id ?? "").startsWith("sim:"),
  };
}

/**
 * Let a pass in. First scan wins: a second scan of the same pass (a forwarded
 * screenshot, a friend with the same email) reports `already` with the time,
 * and the host decides. The write is guarded so two doors cannot both admit.
 */
export async function admitCode(
  eventId: string,
  code: string,
): Promise<{ ok: true; already: boolean; admittedAt: string } | { ok: false; reason: "unknown" }> {
  const now = new Date().toISOString();
  const meta = await executeQuery(
    `UPDATE event_codes SET admitted_at = ?3
      WHERE event_id = ?1 AND code = ?2 AND admitted_at IS NULL`,
    [eventId, code.trim().toUpperCase(), now],
  );
  if (meta.changes > 0) return { ok: true, already: false, admittedAt: now };
  const found = await lookupCode(eventId, code);
  if (!found) return { ok: false, reason: "unknown" };
  return { ok: true, already: true, admittedAt: found.admittedAt ?? now };
}

/** Heads through the door, against real passes sold. */
export async function countAdmitted(eventId: string): Promise<{ admitted: number; sold: number }> {
  const row = await queryOne<{ admitted: number; sold: number }>(
    `SELECT COUNT(admitted_at) AS admitted,
            SUM(CASE WHEN order_id IS NOT NULL AND order_id NOT LIKE 'sim:%' THEN 1 ELSE 0 END) AS sold
       FROM event_codes WHERE event_id = ?1`,
    [eventId],
  );
  return { admitted: row?.admitted ?? 0, sold: row?.sold ?? 0 };
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

/**
 * Every code for a volume, with the address it was issued to.
 *
 * The email is here for the door. A buyer who mistyped their address at
 * checkout, or used one they cannot read on the night, gets no email and cannot
 * self-serve at /loop/code either, because that lookup keys on the same address
 * they got wrong. They have paid and they are standing in front of somebody.
 * The host needs to find their code by what they DO know, which is usually a
 * near-miss of the address they typed.
 */
export async function listCodes(
  eventId: string,
): Promise<{ code: string; serial: number | null; redeemed: boolean; email: string | null; orderId: string | null }[]> {
  const rows = await queryDatabase<{
    code: string;
    serial: number | null;
    redeemed_by: string | null;
    email: string | null;
    order_id: string | null;
  }>(
    `SELECT code, serial, redeemed_by, email, order_id FROM event_codes WHERE event_id = ?1
      ORDER BY rowid DESC`,
    [eventId],
  );
  return rows.map((r) => ({
    code: r.code,
    serial: r.serial ?? null,
    redeemed: r.redeemed_by !== null,
    email: r.email,
    orderId: r.order_id,
  }));
}
