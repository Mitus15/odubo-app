import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId, getAnthemState } from "@/lib/loop/anthem-server";

/**
 * The single source of truth for the anthem client: the active event's stage,
 * schedule, nomination leaderboard, locked seeds, derived bracket, and THIS
 * voter's current picks. The client derives the bracket with the same pure
 * `buildBracket`, so optimistic votes update instantly.
 */
export async function GET() {
  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const state = await getAnthemState(event, voterId);
  return NextResponse.json(state);
}
