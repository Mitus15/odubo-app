import { executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { attendeeByEmail, attendeeForVoter, bindDevice, ensureAttendee, recordAttendance } from "@/lib/loop/identity";

/**
 * Recovery: a ticket follows its owner to a new phone.
 *
 * The checkout email is the only identity a buyer has, so proving the inbox
 * is proving the person. The claim link in the pass email proves it (see
 * passLinks.ts); opening it on a device does three things at once:
 *
 *   1. binds this device to the attendee who owns the email (their credited
 *      shots, cover choice and attendance come with them),
 *   2. makes this device a holder of every pass bought with that email, and
 *   3. takes any of those passes back from a device that is not theirs.
 *
 * The third is what "nobody can take it away from you" means in practice. A
 * pass redeemed by someone who merely knew the email loses it the moment the
 * real owner proves the inbox. A pass on the owner's OTHER phone is left alone,
 * because that phone is bound to the same attendee. (A six-digit emailed code
 * did the proving until 2026-09-16; the owner asked what it was for, and the
 * answer was nothing the link did not already do. Table
 * loop_email_verifications stays, empty.)
 *
 * The pure decision (`planReclaim`) is separated from the writes so the rule
 * is under test without a database.
 */

// ── the address ──────────────────────────────────────────────────────────────

export function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The secret every inbox-proof hash is salted with (the claim link's token hash). */
export function otpPepper(): string {
  return process.env.LOOP_OTP_PEPPER || process.env.JWT_SECRET || "dev-insecure-pepper";
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
