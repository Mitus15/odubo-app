import { executeQuery, queryDatabase } from "@/lib/loop/db";

/**
 * The running thread — the async back-channel between the owner and the
 * promoter, rendered on the Promoter Studio (/loop/admin/studio).
 *
 * One flat list, newest first, topic-tagged. `topic` is free text so a note
 * can attach to anything — a Studio section, a Playbook tab, or whatever the
 * writer types. There is deliberately no event scoping (the thread belongs to
 * the partnership across volumes), no threading (two people), no pagination
 * (LIMIT 100 — revisit if the thread outgrows it), and no delete (a mispost in
 * a two-person thread is a shrug; the D1 console exists for emergencies).
 */

export type LoopNote = {
  id: string;
  author: string;
  topic: string;
  body: string;
  /** ISO string — sorts lexicographically-chronologically, timezone-safe. */
  createdAt: string;
};

export async function listNotes(limit = 100): Promise<LoopNote[]> {
  const rows = await queryDatabase<{
    id: string;
    author: string;
    topic: string;
    body: string;
    created_at: string;
  }>(
    `SELECT id, author, topic, body, created_at
       FROM loop_notes ORDER BY created_at DESC, id DESC LIMIT ?1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    author: r.author,
    topic: r.topic,
    body: r.body,
    createdAt: r.created_at,
  }));
}

/**
 * Add a note. `created_at` is stamped here as an ISO string rather than left
 * to the SQLite default — CURRENT_TIMESTAMP's "YYYY-MM-DD HH:MM:SS" carries no
 * timezone, and this thread is read on phones in Vancouver against a server on
 * UTC. Caps are enforced server-side so the client's maxLength is a courtesy,
 * not the defence.
 */
export async function addNote(input: {
  author?: string;
  topic?: string;
  body: string;
}): Promise<LoopNote> {
  const author = (input.author ?? "").trim().slice(0, 40) || "Anonymous";
  const topic = (input.topic ?? "").trim().slice(0, 60);
  const body = input.body.trim().slice(0, 2000);
  if (!body) throw new Error("empty note");

  const note: LoopNote = {
    id: crypto.randomUUID(),
    author,
    topic,
    body,
    createdAt: new Date().toISOString(),
  };

  await executeQuery(
    `INSERT INTO loop_notes (id, author, topic, body, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [note.id, note.author, note.topic, note.body, note.createdAt],
  );
  return note;
}
