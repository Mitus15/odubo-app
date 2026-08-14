import { NextResponse } from "next/server";
import { addNote } from "@/lib/loop/notes";

/**
 * Post a note to the running thread on the Promoter Studio.
 *
 * POST only — the thread itself is server-rendered by the Studio page, so a
 * GET here would be a second copy of the same read. No event id: the thread is
 * partnership-scoped by design (see lib/loop/notes.ts).
 *
 * Gated by the `ls_admin` session cookie in middleware (see admin-auth.ts).
 */
export async function POST(req: Request) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!body) {
    return NextResponse.json({ error: "a note needs some words" }, { status: 400 });
  }

  const note = await addNote({
    author: typeof raw.author === "string" ? raw.author : "",
    topic: typeof raw.topic === "string" ? raw.topic : "",
    body,
  });

  return NextResponse.json({ ok: true, note });
}
