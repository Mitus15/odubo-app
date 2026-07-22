import { NextResponse } from "next/server";
import { MOCK_CURRENT_EVENT, type EventPhase } from "@/lib/loop/hub";
import { setStoredPhase } from "@/lib/loop/phase-store";

/**
 * Sets the active event phase — a GLOBAL, D1-backed setting, so the flip takes
 * effect for every visitor (not just this browser). This replaced the old
 * per-browser `ls_phase` cookie, which only changed the admin's own view.
 *
 * Gated by the `ls_admin` session cookie in middleware (see admin-auth.ts).
 */
const VALID: EventPhase[] = ["pre", "live", "archived"];

export async function POST(req: Request) {
  const { phase } = (await req.json()) as { phase?: string };
  if (!phase || !VALID.includes(phase as EventPhase)) {
    return NextResponse.json({ error: "invalid phase" }, { status: 400 });
  }
  await setStoredPhase(MOCK_CURRENT_EVENT.id, phase as EventPhase);
  return NextResponse.json({ ok: true, phase });
}
