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
export async function attendeeForVoter(voterId: string): Promise<Attendee | null> {
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
export async function bindDevice(voterId: string, attendeeId: string): Promise<void> {
  await executeQuery(
    `INSERT INTO loop_attendee_devices (voter_id, attendee_id, bound_at)
     VALUES (?1, ?2, ?3)
       ON CONFLICT(voter_id) DO UPDATE SET attendee_id = ?2, bound_at = ?3`,
    [voterId, attendeeId, new Date().toISOString()],
  );
}

/**
 * "This is me" — bind a name and the checkout email to this device's attendee.
 * If another attendee already owns that email, this device is re-pointed at
 * THEM and the shell record is left behind: the person is one person, however
 * many phones they've used.
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
    if (owner && owner.id !== me.id) {
      await bindDevice(voterId, owner.id);
      if (name) {
        await executeQuery(
          `UPDATE loop_attendees SET display_name = COALESCE(display_name, ?2), last_seen_at = ?3
            WHERE id = ?1`,
          [owner.id, name, new Date().toISOString()],
        );
      }
      const merged = await attendeeForVoter(voterId);
      return merged ?? me;
    }
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
export async function creditedUids(attendeeId: string, eventId?: string): Promise<string[]> {
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
