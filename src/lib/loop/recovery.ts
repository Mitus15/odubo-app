import { executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { attendeeByEmail, attendeeForVoter, bindDevice, ensureAttendee, recordAttendance } from "@/lib/loop/identity";

/**
 * Recovery: a ticket follows its owner to a new phone.
 *
 * The checkout email is the only identity a buyer has, so proving the inbox
 * is proving the person. A six-digit code goes to that address; typing it back
 * on this device does three things at once:
 *
 *   1. binds this device to the attendee who owns the email (their credited
 *      shots, cover choice and attendance come with them),
 *   2. makes this device a holder of every pass bought with that email, and
 *   3. takes any of those passes back from a device that is not theirs.
 *
 * The third is what "nobody can take it away from you" means in practice. A
 * pass redeemed by someone who merely knew the email loses it the moment the
 * real owner proves the inbox. A pass on the owner's OTHER phone is left alone,
 * because that phone is bound to the same attendee.
 *
 * The pure decision (`planReclaim`) is separated from the writes so the rule
 * is under test without a database.
 */

// ── the one-time code ────────────────────────────────────────────────────────

export const OTP_TTL_MS = 15 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Six digits, from crypto, never starting with a zero-padding problem. */
export function newOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/** The secret every inbox-proof hash is salted with: the six digits and the claim link alike. */
export function otpPepper(): string {
  return process.env.LOOP_OTP_PEPPER || process.env.JWT_SECRET || "dev-insecure-pepper";
}

export async function hashOtp(email: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${normEmail(email)}|${code.trim()}|${otpPepper()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Whether any pass for this event was bought with the address. */
export async function hasPassesForEmail(eventId: string, email: string): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM event_codes WHERE event_id = ?1 AND LOWER(TRIM(email)) = ?2`,
    [eventId, normEmail(email)],
  );
  return (row?.n ?? 0) > 0;
}

/** Issue a code for the address. Returns the plain code for sending; only the hash is stored. */
export async function createVerification(email: string, voterId: string, now = Date.now()): Promise<string> {
  const code = newOtp();
  const id = `ver_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await executeQuery(
    `INSERT INTO loop_email_verifications (id, email, code_hash, voter_id, attempts, expires_at, consumed_at, created_at)
     VALUES (?1, ?2, ?3, ?4, 0, ?5, NULL, ?6)`,
    [id, normEmail(email), await hashOtp(email, code), voterId, now + OTP_TTL_MS, now],
  );
  return code;
}

export type VerifyOutcome = "ok" | "wrong" | "expired" | "burned" | "none";

/**
 * Check a typed code against the newest live verification for the address.
 * A wrong guess counts; the fifth burns the row and the buyer asks for a new one.
 */
export async function checkVerification(email: string, code: string, now = Date.now()): Promise<VerifyOutcome> {
  const row = await queryOne<{ id: string; code_hash: string; attempts: number; expires_at: number; consumed_at: number | null }>(
    `SELECT id, code_hash, attempts, expires_at, consumed_at FROM loop_email_verifications
      WHERE email = ?1 ORDER BY created_at DESC LIMIT 1`,
    [normEmail(email)],
  );
  if (!row) return "none";
  if (row.consumed_at !== null) return row.attempts >= OTP_MAX_ATTEMPTS ? "burned" : "expired";
  if (now > row.expires_at) return "expired";

  const matches = timingSafeEqual(row.code_hash, await hashOtp(email, code));
  if (matches) {
    await executeQuery(`UPDATE loop_email_verifications SET consumed_at = ?2 WHERE id = ?1`, [row.id, now]);
    return "ok";
  }
  const attempts = row.attempts + 1;
  await executeQuery(
    `UPDATE loop_email_verifications SET attempts = ?2, consumed_at = CASE WHEN ?2 >= ?3 THEN ?4 ELSE NULL END WHERE id = ?1`,
    [row.id, attempts, OTP_MAX_ATTEMPTS, now],
  );
  return attempts >= OTP_MAX_ATTEMPTS ? "burned" : "wrong";
}

// ── the reclaim rule (pure) ──────────────────────────────────────────────────

export type CodeRow = { code: string; redeemedBy: string | null };

export type ReclaimPlan = {
  /** Codes whose redeemed_by becomes this device. */
  take: string[];
  /** Devices that lose these codes: not this device, not bound to the owner. */
  evict: { voterId: string; codes: string[] }[];
};

/**
 * Decide, for every pass bought with the email, who ends up holding it.
 *
 * `boundTo` maps a device to the attendee it points at (null when unbound).
 * A device bound to the owner is the same person on another phone: untouched.
 * Any other device holding one of these codes is evicted from that code.
 */
export function planReclaim(
  voterId: string,
  ownerAttendeeId: string,
  codes: CodeRow[],
  boundTo: Map<string, string | null>,
): ReclaimPlan {
  const take: string[] = [];
  const evictMap = new Map<string, string[]>();
  for (const c of codes) {
    const holder = c.redeemedBy;
    if (holder === null || holder === voterId) {
      if (holder === null) take.push(c.code);
      continue;
    }
    if (boundTo.get(holder) === ownerAttendeeId) continue; // owner's other phone
    take.push(c.code);
    evictMap.set(holder, [...(evictMap.get(holder) ?? []), c.code]);
  }
  return { take, evict: Array.from(evictMap, ([voterId, codes]) => ({ voterId, codes })) };
}

// ── the writes ───────────────────────────────────────────────────────────────

/**
 * Fold one attendee into another. Used when this device already had an
 * unnamed attendee of its own (it redeemed before verifying) and the email
 * turns out to belong to a record made on another phone. Nothing is dropped:
 * credits, attendance, cover choice and gift codes all move to the survivor.
 */
async function mergeAttendeeInto(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return;
  await executeQuery(`UPDATE loop_media_credits SET attendee_id = ?2 WHERE attendee_id = ?1`, [fromId, intoId]);
  await executeQuery(
    `INSERT OR IGNORE INTO loop_attendance (event_id, attendee_id, code, first_seen_at)
     SELECT event_id, ?2, code, first_seen_at FROM loop_attendance WHERE attendee_id = ?1`,
    [fromId, intoId],
  );
  await executeQuery(`DELETE FROM loop_attendance WHERE attendee_id = ?1`, [fromId]);
  await executeQuery(
    `INSERT OR IGNORE INTO loop_cover_choices (attendee_id, event_id, photo_uid, chosen_at)
     SELECT ?2, event_id, photo_uid, chosen_at FROM loop_cover_choices WHERE attendee_id = ?1`,
    [fromId, intoId],
  ).catch(() => undefined);
  await executeQuery(`DELETE FROM loop_cover_choices WHERE attendee_id = ?1`, [fromId]).catch(() => undefined);
  await executeQuery(`UPDATE loop_gift_codes SET attendee_id = ?2 WHERE attendee_id = ?1`, [fromId, intoId]).catch(() => undefined);
  await executeQuery(`UPDATE loop_attendee_devices SET attendee_id = ?2 WHERE attendee_id = ?1`, [fromId, intoId]);
  await executeQuery(`DELETE FROM loop_attendees WHERE id = ?1`, [fromId]);
}

/**
 * The attendee who owns this email. In order: the one who claimed it; else the
 * unnamed record of whichever device first redeemed one of its passes (the
 * buyer, before they had a name); else this device's own record, which takes
 * the email now.
 */
async function resolveOwner(email: string, voterId: string, codes: CodeRow[]): Promise<string> {
  const mail = normEmail(email);
  const claimed = await attendeeByEmail(mail);
  if (claimed) return claimed;

  for (const c of codes) {
    if (!c.redeemedBy) continue;
    const a = await attendeeForVoter(c.redeemedBy);
    if (a && a.email === null) {
      await executeQuery(`UPDATE loop_attendees SET email = ?2 WHERE id = ?1 AND email IS NULL`, [a.id, mail]);
      const check = await attendeeByEmail(mail);
      if (check) return check;
    }
  }

  const me = await ensureAttendee(voterId);
  await executeQuery(`UPDATE loop_attendees SET email = ?2 WHERE id = ?1 AND email IS NULL`, [me.id, mail]);
  return (await attendeeByEmail(mail)) ?? me.id;
}

/**
 * Put an address on this device's attendee, but only if nobody owns it yet.
 *
 * Used by the claim link for the buyer's own ticket (unit #1 of an order). A
 * friend's phone opening a forwarded Guest 2 link must never claim the buyer's
 * address: `loop_attendees.email` is unique, so the buyer could then never own
 * it, and a later six-digit proof would merge the buyer INTO the friend.
 */
export async function claimEmailIfUnowned(email: string, voterId: string): Promise<boolean> {
  const mail = normEmail(email);
  if (!mail || !voterId || voterId === "anonymous") return false;
  if (await attendeeByEmail(mail)) return false;
  const me = await ensureAttendee(voterId);
  const meta = await executeQuery(
    `UPDATE loop_attendees SET email = ?2 WHERE id = ?1 AND email IS NULL`,
    [me.id, mail],
  );
  return meta.changes > 0;
}

export type RecoveryResult = {
  attendeeId: string;
  codes: { code: string; serial: number | null; redeemed: boolean }[];
  taken: number;
  evicted: number;
};

/**
 * After the inbox is proven: bind this device to the owner, hold every pass
 * bought with the email here, and take back any pass a stranger is holding.
 */
export async function recoverForVerifiedOwner(eventId: string, email: string, voterId: string): Promise<RecoveryResult> {
  const mail = normEmail(email);
  const rows = await queryDatabase<{ code: string; redeemed_by: string | null }>(
    `SELECT code, redeemed_by FROM event_codes WHERE event_id = ?1 AND LOWER(TRIM(email)) = ?2 ORDER BY created_at ASC`,
    [eventId, mail],
  );
  const codes: CodeRow[] = rows.map((r) => ({ code: r.code, redeemedBy: r.redeemed_by }));

  const ownerId = await resolveOwner(mail, voterId, codes);

  // This device may already point at its own unnamed record; fold it in.
  const mine = await attendeeForVoter(voterId);
  if (mine && mine.id !== ownerId) await mergeAttendeeInto(mine.id, ownerId);
  await bindDevice(voterId, ownerId);

  const holders = Array.from(new Set(codes.map((c) => c.redeemedBy).filter((v): v is string => Boolean(v))));
  const boundTo = new Map<string, string | null>();
  for (const v of holders) boundTo.set(v, (await attendeeForVoter(v))?.id ?? null);

  const plan = planReclaim(voterId, ownerId, codes, boundTo);

  for (const code of plan.take) {
    await executeQuery(`UPDATE event_codes SET redeemed_by = ?3 WHERE event_id = ?1 AND code = ?2`, [eventId, code, voterId]);
  }
  let evicted = 0;
  for (const { voterId: stranger } of plan.evict) {
    // Only drop holder status if that device holds nothing else for this event.
    const still = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM event_codes WHERE event_id = ?1 AND redeemed_by = ?2`,
      [eventId, stranger],
    );
    if ((still?.n ?? 0) === 0) {
      await executeQuery(`DELETE FROM event_holders WHERE event_id = ?1 AND voter_id = ?2`, [eventId, stranger]);
      evicted++;
    }
  }

  if (codes.length > 0) {
    await executeQuery(`INSERT OR IGNORE INTO event_holders (event_id, voter_id) VALUES (?1, ?2)`, [eventId, voterId]);
    await recordAttendance(eventId, ownerId, codes[0].code);
  }

  const after = await queryDatabase<{ code: string; serial: number | null; redeemed_by: string | null }>(
    `SELECT code, serial, redeemed_by FROM event_codes WHERE event_id = ?1 AND LOWER(TRIM(email)) = ?2 ORDER BY created_at ASC`,
    [eventId, mail],
  );
  return {
    attendeeId: ownerId,
    codes: after.map((r) => ({ code: r.code, serial: r.serial ?? null, redeemed: r.redeemed_by !== null })),
    taken: plan.take.length,
    evicted,
  };
}
