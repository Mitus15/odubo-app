import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { isNominationOpen } from "@/lib/loop/anthem-rounds";
import { exists, toggleUpvote } from "@/lib/loop/anthem-candidates";

/**
 * Toggle this voter's like for a nomination (one per candidate, changeable while
 * nominations are open). Each voter gets up to UPVOTE_LIMIT likes per event —
 * a 4th add is rejected with 409. Returns the candidate's new state + likes used.
 */
export async function POST(req: Request) {
  const { candidateId } = (await req.json()) as { candidateId?: string };
  if (!candidateId) {
    return NextResponse.json({ error: "missing candidate" }, { status: 400 });
  }

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  if (!(await isNominationOpen(event, Date.now()))) {
    return NextResponse.json({ error: "nominations are closed" }, { status: 409 });
  }
  if (!(await exists(event.id, candidateId))) {
    return NextResponse.json({ error: "unknown candidate" }, { status: 404 });
  }

  const result = await toggleUpvote(event.id, voterId, candidateId);
  if (!result.ok) {
    return NextResponse.json(
      { error: `you get ${result.limit} likes — unlike one first`, ...result },
      { status: 409 },
    );
  }
  return NextResponse.json(result);
}
