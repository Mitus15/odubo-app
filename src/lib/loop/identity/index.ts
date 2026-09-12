import { queryDatabase, queryOne, executeQuery } from "@/lib/loop/db";

/**
 * Attendee identity — who was in the room, what they've attended, what they
 * shot. See docs/decisions/loop-identity-and-danceyokey.md.
 *
 * The `ls_voter` device cookie is never the identity; it POINTS at one
 * (`loop_attendee_devices`). An attendee survives lost cookies and new phones
 * because the checkout email is the recovery key. No passwords anywhere — the
 * stakes (seeing your own gallery) match the proof (knowing the exact address
 * a pass was bought with), and both paths are rate-limited.
 */

export type Attendee = {
  id: string;
  displayName: string | null;
  email: string | null;
  /** Volumes attended — what "regular" means here. */
  volumes: number;
};

function newId(): string {
  return `att_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

const normEmail = (e: string | null | undefined): string | null =>
  e?.trim().toLowerCase() || null;

/** The attendee this device points at, if any. */
export async function attendeeForVoter(
  voterId: string,
): Promise<Attendee | null> {
  if (!voterId || voterId === "anonymous") return null;
  const row = await queryOne<{
    id: string;
    display_name: string | null;
    email: string | null;
    volumes: number;
  }>(
    `SELECT a.id, a.display_name, a.email,
            (SELECT COUNT(*) FROM loop_attendance att WHERE att.attendee_id = a.id) AS volumes
       FROM loop_attendee_devices d
       JOIN loop_attendees a ON a.id = d.attendee_id
      WHERE d.voter_id = ?1`,
    [voterId],
  );
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    volumes: row.volumes ?? 0,
  };
}

/**
 * Get-or-create the attendee for this device. Called when a code is redeemed,
 * so the night works with zero forms; claiming a name/email comes later.
 */
export async function ensureAttendee(voterId: string): Promise<Attendee> {
  const existing = await attendeeForVoter(voterId);
  if (existing) return existing;

  const id = newId();
  await executeQuery(
    `INSERT INTO loop_attendees (id, created_at, last_seen_at)
     VALUES (?1, ?2, ?2)`,
    [id, new Date().toISOString()],
  );
  await executeQuery(
    `INSERT OR IGNORE INTO loop_attendee_devices (voter_id, attendee_id) VALUES (?1, ?2)`,
    [voterId, id],
  );
  return { id, displayName: null, email: null, volumes: 0 };
}

/** Record that this attendee was at this event (idempotent). */
export async function recordAttendance(
  eventId: string,
  attendeeId: string,
  code: string | null,
): Promise<void> {
  await executeQuery(
    `INSERT OR IGNORE INTO loop_attendance (event_id, attendee_id, code) VALUES (?1, ?2, ?3)`,
    [eventId, attendeeId, code],
  );
}

/** Point a device at an existing attendee (a new phone, a cleared browser). */
export async function bindDevice(
  voterId: string,
  attendeeId: string,
): Promise<void> {
  await executeQuery(
    `INSERT INTO loop_attendee_devices (voter_id, attendee_id, bound_at)
     VALUES (?1, ?2, ?3)
       ON CONFLICT(voter_id) DO UPDATE SET attendee_id = ?2, bound_at = ?3`,
    [voterId, attendeeId, new Date().toISOString()],
  );
}

/** Thrown when a claim would hand one person's record to another device. */
export class EmailBelongsToSomeoneElse extends Error {
  constructor() {
    super("That email is already claimed.");
    this.name = "EmailBelongsToSomeoneElse";
  }
}

/**
 * "This is me" — bind a name and the checkout email to this device's attendee.
 *
 * Claiming an UNCLAIMED email is free: if nobody owns it, typing it is just
 * labelling yourself, and that is the common case.
 *
 * Claiming one that already belongs to somebody else is REFUSED. It used to
 * re-point the device at them, on the reasoning that a person is one person
 * however many phones they have used. That is the right goal and it was the
 * wrong mechanism: nothing proved the address was yours. Anyone who knew a
 * guest's email could take their record, and with it their credited shots,
 * their cover choice and their claim on the cover payout. The rate limit is no
 * defence — a targeted takeover needs one attempt, not a thousand.
 *
 * Merging devices comes back at rung 4, behind a code sent to the address, now
 * that there is a sending domain that exists. Until then a second device
 * recovers through /loop/code with the checkout email, which is proof, because
 * the code was sent there. Refusing is worse to use and strictly better than
 * handing somebody else's night away.
 *
 * A display name is a label, not a claim: two people called Sarah are fine.
 * Only the email carries identity.
 *
 * See docs/decisions/odubo-one-person-one-record.md.
 */
export async function claimIdentity(
  voterId: string,
  displayName: string | null,
  email: string | null,
): Promise<Attendee> {
  const me = await ensureAttendee(voterId);
  const mail = normEmail(email);
  const name = displayName?.trim().slice(0, 60) || null;

  if (mail) {
    const owner = await queryOne<{ id: string }>(
      `SELECT id FROM loop_attendees WHERE email = ?1`,
      [mail],
    );
    if (owner && owner.id !== me.id) throw new EmailBelongsToSomeoneElse();
  }

  await executeQuery(
    `UPDATE loop_attendees
        SET display_name = COALESCE(?2, display_name),
            email = COALESCE(?3, email),
            last_seen_at = ?4
      WHERE id = ?1`,
    [me.id, name, mail, new Date().toISOString()],
  );
  return (await attendeeForVoter(voterId)) ?? me;
}

/** The attendee who bought with this email, if they've claimed it. */
export async function attendeeByEmail(email: string): Promise<string | null> {
  const mail = normEmail(email);
  if (!mail) return null;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM loop_attendees WHERE email = ?1`,
    [mail],
  );
  return row?.id ?? null;
}

/**
 * The join that resolves a shot to its author, and the expression that picks
 * the best name available.
 *
 * Exported as SQL fragments rather than reimplemented at each call site because
 * contributor royalties are paid on this answer: the Journal, the Wall and the
 * cover ballot all have to name the same person for the same photo. They did
 * not — the ballot read the free-text name typed at upload while the Journal
 * read the durable attendee record, so one shot could be credited two ways.
 *
 * Prefers the attendee (the person, durable across devices and volumes) and
 * falls back to whatever they typed on the upload, which is all an unclaimed
 * guest has.
 */
export const CREDIT_JOIN = `LEFT JOIN loop_media_credits c ON c.photo_uid = p.uid
       LEFT JOIN loop_attendees a ON a.id = c.attendee_id`;

export const CREDIT_EXPR = `COALESCE(NULLIF(TRIM(a.display_name), ''), NULLIF(TRIM(p.user_name), ''))`;

/** Credit a captured shot to its author. Written once, never updated. */
export async function creditMedia(
  photoUid: string,
  attendeeId: string,
  eventId: string,
): Promise<void> {
  await executeQuery(
    `INSERT OR IGNORE INTO loop_media_credits (photo_uid, attendee_id, event_id)
     VALUES (?1, ?2, ?3)`,
    [photoUid, attendeeId, eventId],
  );
}

/** Photo uids this attendee shot at an event — the basis of "your shots",
 *  profiles, contributor credits and royalty accounting. */
export async function creditedUids(
  attendeeId: string,
  eventId?: string,
): Promise<string[]> {
  const rows = eventId
    ? await queryDatabase<{ photo_uid: string }>(
        `SELECT photo_uid FROM loop_media_credits WHERE attendee_id = ?1 AND event_id = ?2`,
        [attendeeId, eventId],
      )
    : await queryDatabase<{ photo_uid: string }>(
        `SELECT photo_uid FROM loop_media_credits WHERE attendee_id = ?1`,
        [attendeeId],
      );
  return rows.map((r) => r.photo_uid);
}

/** Attendance count → the "regular" weighting Danceyokey uses. */
export async function volumesAttended(attendeeId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM loop_attendance WHERE attendee_id = ?1`,
    [attendeeId],
  );
  return row?.n ?? 0;
}

export type Contributor = {
  attendeeId: string;
  name: string | null;
  shots: number;
};

/**
 * Everyone who shot something at a volume, with how much of it they shot.
 *
 * The basis of the credits roll. Derived from `loop_media_credits`, never from
 * a list anyone maintains: a contributor list that can be edited is a
 * contributor list that will eventually disagree with what the royalties are
 * paid on.
 */
export async function listContributors(
  eventId: string,
): Promise<Contributor[]> {
  const rows = await queryDatabase<{
    attendee_id: string;
    name: string | null;
    shots: number;
  }>(
    `SELECT c.attendee_id, a.display_name AS name, COUNT(*) AS shots
       FROM loop_media_credits c
       LEFT JOIN loop_attendees a ON a.id = c.attendee_id
      WHERE c.event_id = ?1
      GROUP BY c.attendee_id, a.display_name
      ORDER BY shots DESC, a.display_name IS NULL, a.display_name`,
    [eventId],
  );
  return rows.map((r) => ({
    attendeeId: r.attendee_id,
    name: r.name,
    shots: Number(r.shots) || 0,
  }));
}
