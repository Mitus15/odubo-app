import { queryDatabase, queryOne, executeQuery } from "@/lib/loop/db";

/**
 * Danceyokey — karaoke's social contract, for dancing. A host keeps a list;
 * you pick a song; when you're called the floor is yours for one song, solo or
 * with a crew. Few spots a night, so a spot is a prize.
 *
 * See docs/decisions/loop-identity-and-danceyokey.md for the four selection
 * modes and why regulars are weighted the way they are.
 */

export type SignupStatus = "waiting" | "queued" | "performing" | "done" | "cut";
export type SelectionMode = "firstcome" | "hostpick" | "random";

export type Signup = {
  id: string;
  eventId: string;
  attendeeId: string | null;
  /** The act — one name or many. */
  performers: string;
  songTitle: string | null;
  songArtist: string | null;
  note: string | null;
  status: SignupStatus;
  position: number | null;
  source: "advance" | "in-room" | "wildcard";
  createdAt: string;
  /** Volumes this attendee has attended — the regular weighting. */
  volumes: number;
};

export type DanceyokeySettings = {
  /** Spots on the floor tonight. */
  spots: number;
  mode: SelectionMode;
  /** Sign-ups accepted right now. */
  open: boolean;
};

type Row = {
  id: string;
  event_id: string;
  attendee_id: string | null;
  performers: string;
  song_title: string | null;
  song_artist: string | null;
  note: string | null;
  status: SignupStatus;
  position: number | null;
  source: Signup["source"];
  created_at: string;
  volumes: number | null;
};

const toSignup = (r: Row): Signup => ({
  id: r.id,
  eventId: r.event_id,
  attendeeId: r.attendee_id,
  performers: r.performers,
  songTitle: r.song_title,
  songArtist: r.song_artist,
  note: r.note,
  status: r.status,
  position: r.position,
  source: r.source,
  createdAt: r.created_at,
  volumes: r.volumes ?? 0,
});

const SELECT = `
  SELECT s.id, s.event_id, s.attendee_id, s.performers, s.song_title, s.song_artist,
         s.note, s.status, s.position, s.source, s.created_at,
         (SELECT COUNT(*) FROM loop_attendance a WHERE a.attendee_id = s.attendee_id) AS volumes
    FROM danceyokey_signups s`;

/* ────────────────────────────── settings ────────────────────────────── */

export async function getSettings(): Promise<DanceyokeySettings> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await queryDatabase<{ key: string; value: string }>(
      `SELECT key, value FROM loop_settings
        WHERE key IN ('danceyokey_spots', 'danceyokey_mode', 'danceyokey_open')`,
    );
  } catch {
    /* table missing → defaults */
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const mode = map.get("danceyokey_mode");
  return {
    spots: Number(map.get("danceyokey_spots") ?? 3) || 3,
    mode: mode === "hostpick" || mode === "random" ? mode : "firstcome",
    // Open by default: the common case is wanting sign-ups.
    open: (map.get("danceyokey_open") ?? "1") !== "0",
  };
}

export async function setSetting(
  key: "danceyokey_spots" | "danceyokey_mode" | "danceyokey_open",
  value: string,
): Promise<void> {
  await executeQuery(
    `INSERT INTO loop_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3`,
    [key, value, new Date().toISOString()],
  );
}

/* ─────────────────────────────── reads ─────────────────────────────── */

/** Everything for the host console, sorted the way the night runs. */
export async function listAll(eventId: string): Promise<Signup[]> {
  const rows = await queryDatabase<Row>(
    `${SELECT} WHERE s.event_id = ?1
      ORDER BY
        CASE s.status
          WHEN 'performing' THEN 0
          WHEN 'queued' THEN 1
          WHEN 'waiting' THEN 2
          WHEN 'done' THEN 3
          ELSE 4
        END,
        s.position ASC,
        s.created_at ASC`,
    [eventId],
  );
  return rows.map(toSignup);
}

/** The waiting list in the order first-come would call it: earlier sign-ups
 *  first, regulars ahead of first-timers within the same minute. */
export async function waitingList(eventId: string): Promise<Signup[]> {
  const list = (await listAll(eventId)).filter((s) => s.status === "waiting");
  return list.sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Math.abs(ta - tb) > 60_000) return ta - tb;
    return b.volumes - a.volumes || ta - tb;
  });
}

export async function mySignup(eventId: string, attendeeId: string): Promise<Signup | null> {
  const row = await queryOne<Row>(
    `${SELECT} WHERE s.event_id = ?1 AND s.attendee_id = ?2
        AND s.status IN ('waiting', 'queued', 'performing')
      ORDER BY s.created_at DESC`,
    [eventId, attendeeId],
  );
  return row ? toSignup(row) : null;
}

/** What a guest needs: their act, and how the night is running. */
export async function guestView(eventId: string, attendeeId: string | null) {
  const [settings, all] = await Promise.all([getSettings(), listAll(eventId)]);
  const mine = attendeeId
    ? (all.find(
        (s) => s.attendeeId === attendeeId && ["waiting", "queued", "performing"].includes(s.status),
      ) ?? null)
    : null;
  const queued = all.filter((s) => s.status === "queued" || s.status === "performing");
  const waiting = all.filter((s) => s.status === "waiting");
  const onNow = all.find((s) => s.status === "performing") ?? null;
  const upNext = queued.find((s) => s.status === "queued") ?? null;

  let myPlace: number | null = null;
  if (mine?.status === "waiting") {
    const order = await waitingList(eventId);
    myPlace = order.findIndex((s) => s.id === mine.id) + 1 || null;
  }

  return {
    settings,
    mine,
    myPlace,
    counts: { waiting: waiting.length, queued: queued.length, spots: settings.spots },
    onNow: onNow ? { performers: onNow.performers, songTitle: onNow.songTitle } : null,
    upNext: upNext ? { performers: upNext.performers, songTitle: upNext.songTitle } : null,
  };
}

/* ────────────────────────────── writes ────────────────────────────── */

function newId(): string {
  return `dy_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

export async function signUp(input: {
  eventId: string;
  attendeeId: string | null;
  performers: string;
  songTitle: string | null;
  songArtist: string | null;
  note: string | null;
  source: Signup["source"];
  /** Wildcards go straight into the running order. */
  queued?: boolean;
}): Promise<Signup | null> {
  const id = newId();
  const now = new Date().toISOString();
  const position = input.queued ? await nextPosition(input.eventId) : null;
  await executeQuery(
    `INSERT INTO danceyokey_signups
       (id, event_id, attendee_id, performers, song_title, song_artist, note,
        status, position, source, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`,
    [
      id,
      input.eventId,
      input.attendeeId,
      input.performers.slice(0, 200),
      input.songTitle?.slice(0, 160) ?? null,
      input.songArtist?.slice(0, 160) ?? null,
      input.note?.slice(0, 300) ?? null,
      input.queued ? "queued" : "waiting",
      position,
      input.source,
      now,
    ],
  );
  const row = await queryOne<Row>(`${SELECT} WHERE s.id = ?1`, [id]);
  return row ? toSignup(row) : null;
}

async function nextPosition(eventId: string): Promise<number> {
  const row = await queryOne<{ p: number | null }>(
    `SELECT MAX(position) AS p FROM danceyokey_signups
      WHERE event_id = ?1 AND status IN ('queued', 'performing', 'done')`,
    [eventId],
  );
  return (row?.p ?? 0) + 1;
}

/** Guest withdraws their own act (only while it's still on the list). */
export async function withdraw(id: string, attendeeId: string): Promise<boolean> {
  const meta = await executeQuery(
    `UPDATE danceyokey_signups SET status = 'cut', updated_at = ?3
      WHERE id = ?1 AND attendee_id = ?2 AND status IN ('waiting', 'queued')`,
    [id, attendeeId, new Date().toISOString()],
  );
  return meta.changes > 0;
}

/** Host: put a waiting act into the running order. */
export async function promote(id: string): Promise<boolean> {
  const row = await queryOne<{ event_id: string }>(
    `SELECT event_id FROM danceyokey_signups WHERE id = ?1`,
    [id],
  );
  if (!row) return false;
  const meta = await executeQuery(
    `UPDATE danceyokey_signups SET status = 'queued', position = ?2, updated_at = ?3
      WHERE id = ?1 AND status = 'waiting'`,
    [id, await nextPosition(row.event_id), new Date().toISOString()],
  );
  return meta.changes > 0;
}

/** Host: move through the state machine (start, finish, cut, put back). */
export async function setStatus(id: string, status: SignupStatus): Promise<boolean> {
  const meta = await executeQuery(
    `UPDATE danceyokey_signups SET status = ?2, updated_at = ?3 WHERE id = ?1`,
    [id, status, new Date().toISOString()],
  );
  return meta.changes > 0;
}

/** Host: reorder within the running order. */
export async function move(id: string, direction: "up" | "down"): Promise<boolean> {
  const me = await queryOne<{ event_id: string; position: number | null }>(
    `SELECT event_id, position FROM danceyokey_signups WHERE id = ?1 AND status = 'queued'`,
    [id],
  );
  if (!me || me.position === null) return false;
  const neighbour = await queryOne<{ id: string; position: number }>(
    direction === "up"
      ? `SELECT id, position FROM danceyokey_signups
          WHERE event_id = ?1 AND status = 'queued' AND position < ?2
          ORDER BY position DESC LIMIT 1`
      : `SELECT id, position FROM danceyokey_signups
          WHERE event_id = ?1 AND status = 'queued' AND position > ?2
          ORDER BY position ASC LIMIT 1`,
    [me.event_id, me.position],
  );
  if (!neighbour) return false;
  const now = new Date().toISOString();
  await executeQuery(`UPDATE danceyokey_signups SET position = ?2, updated_at = ?3 WHERE id = ?1`, [
    id,
    neighbour.position,
    now,
  ]);
  await executeQuery(`UPDATE danceyokey_signups SET position = ?2, updated_at = ?3 WHERE id = ?1`, [
    neighbour.id,
    me.position,
    now,
  ]);
  return true;
}

/**
 * Host: draw a random act from the waiting list. Regulars get one extra
 * ticket per previous volume (capped at 3) — favoured, but a first-timer
 * still has a real chance, which is the point of a draw the room watches.
 */
export async function drawRandom(eventId: string): Promise<Signup | null> {
  const waiting = await waitingList(eventId);
  if (waiting.length === 0) return null;
  const tickets: Signup[] = [];
  for (const s of waiting) {
    const extra = Math.min(s.volumes, 3);
    for (let i = 0; i < 1 + extra; i++) tickets.push(s);
  }
  const winner = tickets[Math.floor(Math.random() * tickets.length)];
  await promote(winner.id);
  const row = await queryOne<Row>(`${SELECT} WHERE s.id = ?1`, [winner.id]);
  return row ? toSignup(row) : null;
}
