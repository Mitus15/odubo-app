import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId, resolveSeedTracks } from "@/lib/loop/anthem-server";
import { buildBracket } from "@/lib/loop/anthem";
import { bracketSchedule } from "@/lib/loop/anthem-rounds";
import { voteStore, type Side } from "@/lib/loop/votes";

/**
 * Cast or change this voter's pick in the active round. Casting and changing are
 * the same upsert of `(voterId, matchupId) → side`, so a person votes once per
 * matchup and may switch freely until the round closes. The server rebuilds the
 * bracket to confirm the matchup is genuinely votable (active round, still open,
 * formed) before recording — the optimistic client assumes success, so this is
 * the authority that can reject and return the true tallies for reconciliation.
 */
export async function POST(req: Request) {
  const { matchupId, side } = (await req.json()) as {
    matchupId?: string;
    side?: string;
  };

  if (!matchupId || (side !== "a" && side !== "b")) {
    return NextResponse.json({ error: "invalid vote" }, { status: 400 });
  }

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const [seeds, tallies, schedule] = await Promise.all([
    resolveSeedTracks(event.id),
    voteStore.getTallies(event.id),
    bracketSchedule(event),
  ]);
  const bracket = buildBracket(seeds, tallies, schedule, Date.now());

  const matchup = bracket.rounds.flatMap((r) => r.matchups).find((m) => m.id === matchupId);

  if (!matchup || !matchup.votable) {
    const myBallots = await voteStore.getBallots(event.id, voterId);
    return NextResponse.json(
      { error: "matchup not open for voting", tallies, myBallots },
      { status: 409 },
    );
  }

  await voteStore.set(event.id, voterId, matchupId, side as Side);
  const [newTallies, myBallots] = await Promise.all([
    voteStore.getTallies(event.id),
    voteStore.getBallots(event.id, voterId),
  ]);
  return NextResponse.json({ ok: true, tallies: newTallies, myBallots });
}
