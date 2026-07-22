import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { setRunOfShow } from "@/lib/loop/content-store";
import type { RunOfShowItem } from "@/lib/loop/content";

/**
 * Save the Run of Show for the active event. The editor posts the whole list;
 * we normalise + replace. Persisted in D1.
 *
 * Gated by the `ls_admin` session cookie in middleware (see admin-auth.ts).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { items?: unknown };
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }

  const event = await getCurrentEvent();
  await setRunOfShow(event.id, body.items as RunOfShowItem[]);
  return NextResponse.json({ ok: true });
}
