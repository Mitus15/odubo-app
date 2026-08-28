import { NextResponse } from "next/server";
import { getCurrentPhase } from "@/lib/loop/hub";
import { isBallotOpen, setBallotState, type BallotKind } from "@/lib/loop/ballots";

/**
 * Admin control for the member ballots. Auth rides the same middleware gate
 * as every /api/loop/admin/* route. The default is derived from the phase
 * (open from live onward); this endpoint stores an override, and `auto`
 * clears it back to the default.
 */

const KINDS: BallotKind[] = ["tracklist", "cover"];

export async function GET() {
  const phase = await getCurrentPhase();
  const state = Object.fromEntries(
    await Promise.all(
      KINDS.map(async (k) => [k, { open: await isBallotOpen(k, phase) }]),
    ),
  );
  return NextResponse.json({ phase, ballots: state });
}

export async function POST(req: Request) {
  const { kind, state } = (await req.json()) as {
    kind?: string;
    state?: string;
  };
  if (!KINDS.includes(kind as BallotKind)) {
    return NextResponse.json({ error: "unknown ballot" }, { status: 404 });
  }
  if (!["open", "closed", "auto"].includes(state ?? "")) {
    return NextResponse.json({ error: "state must be open | closed | auto" }, { status: 400 });
  }
  await setBallotState(kind as BallotKind, state === "auto" ? null : (state as "open" | "closed"));
  const phase = await getCurrentPhase();
  return NextResponse.json({ ok: true, open: await isBallotOpen(kind as BallotKind, phase) });
}
