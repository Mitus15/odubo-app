import { NextResponse } from "next/server";
import { getCurrentEvent, getCurrentPhase } from "@/lib/loop/hub";
import {
  clearBallotResult,
  declareBallotResult,
  getBallot,
  getBallotResult,
  isBallotOpen,
  setBallotState,
  type BallotKind,
} from "@/lib/loop/ballots";
import { contactForPhoto } from "@/lib/loop/identity";

/**
 * Admin control for the member ballots. Auth rides the same middleware gate as
 * every /api/loop/admin/* route.
 *
 *   GET                        → each ballot's open state, the frozen result if
 *                                 any, the live standings, and, for the cover,
 *                                 who to pay for each shortlisted shot
 *   POST { kind, state }       → force open|closed, or auto (phase default)
 *   POST { kind, declare }     → freeze an option id as the winner; null clears
 */

const KINDS: BallotKind[] = ["tracklist", "cover"];

export async function GET() {
  const [phase, event] = await Promise.all([getCurrentPhase(), getCurrentEvent()]);
  const ballots = Object.fromEntries(
    await Promise.all(
      KINDS.map(async (k) => {
        // `admin` as the voter id: nobody's own votes are marked "yours".
        const [open, result, ballot] = await Promise.all([
          isBallotOpen(k, phase),
          getBallotResult(event.id, k),
          getBallot(k, event.id, phase, "admin"),
        ]);
        // For the cover, the $50 needs a person: attach who to pay per shot.
        const options =
          k === "cover"
            ? await Promise.all(
                ballot.options.map(async (o) => {
                  const uid = o.id.match(/^pic:(.+)$/)?.[1];
                  return { ...o, contact: uid ? await contactForPhoto(uid) : null };
                }),
              )
            : ballot.options;
        return [k, { open, result, options }];
      }),
    ),
  );
  return NextResponse.json({ phase, ballots });
}

export async function POST(req: Request) {
  const { kind, state, declare, note } = (await req.json().catch(() => ({}))) as {
    kind?: string;
    state?: string;
    /** An option id to freeze as the winner, or null to un-declare. */
    declare?: string | null;
    note?: string | null;
  };
  if (!KINDS.includes(kind as BallotKind)) {
    return NextResponse.json({ error: "unknown ballot" }, { status: 404 });
  }
  const k = kind as BallotKind;
  const event = await getCurrentEvent();

  // Declaring or clearing a result. A called result must be reversible: the
  // first thing anyone does with a big red button is press it by accident.
  if (declare !== undefined) {
    if (declare === null) {
      await clearBallotResult(event.id, k);
    } else {
      const phase = await getCurrentPhase();
      const ballot = await getBallot(k, event.id, phase, "admin");
      if (!ballot.options.some((o) => o.id === declare)) {
        return NextResponse.json({ error: "that option isn't on the ballot" }, { status: 404 });
      }
      await declareBallotResult(event.id, k, { winner: declare }, note?.trim() || null);
    }
    return NextResponse.json({ ok: true, result: await getBallotResult(event.id, k) });
  }

  if (!["open", "closed", "auto"].includes(state ?? "")) {
    return NextResponse.json({ error: "state must be open | closed | auto" }, { status: 400 });
  }
  await setBallotState(k, state === "auto" ? null : (state as "open" | "closed"));
  const phase = await getCurrentPhase();
  return NextResponse.json({ ok: true, open: await isBallotOpen(k, phase) });
}
