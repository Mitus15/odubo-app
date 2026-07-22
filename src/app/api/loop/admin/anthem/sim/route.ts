import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import {
  lockTop8,
  populateLonglist,
  resetAnthem,
  runFullSession,
  simulateLikes,
  simulateRoundVotes,
} from "@/lib/loop/anthem-sim";

/**
 * Admin session simulator. Drives a full anthem cycle with N synthetic
 * participants so the team can test the mechanism end-to-end.
 *
 * Gated by the `ls_admin` session cookie in middleware AND behind the
 * ENABLE_ANTHEM_SIM flag — a TEST-ONLY tool that writes synthetic data, so it
 * 404s unless the flag is explicitly on (keep it off for launch).
 */
export async function POST(req: Request) {
  if (process.env.ENABLE_ANTHEM_SIM !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json()) as { action?: string; count?: number };
  const event = await getCurrentEvent();
  const count = clampCount(body.count);

  switch (body.action) {
    case "reset":
      await resetAnthem(event.id);
      return NextResponse.json({ ok: true });
    case "populate": {
      const added = await populateLonglist(event.id);
      return NextResponse.json({ ok: true, added });
    }
    case "like": {
      const likes = await simulateLikes(event.id, count);
      return NextResponse.json({ ok: true, likes, voters: count });
    }
    case "lockTop8":
      return NextResponse.json(await lockTop8(event.id));
    case "voteRound": {
      const result = await simulateRoundVotes(event, count);
      return NextResponse.json({ ok: true, ...result, voters: count });
    }
    case "runAll":
      return NextResponse.json(await runFullSession(event, count));
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}

function clampCount(value: number | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 75;
  return Math.min(Math.floor(n), 500);
}
