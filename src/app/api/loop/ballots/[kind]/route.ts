import { NextResponse } from "next/server";
import { getCurrentEvent, getCurrentPhase } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { getBallot, toggleBallotVote, type BallotKind } from "@/lib/loop/ballots";

/**
 * The member ballots. GET returns the live standings (public — the standings
 * are the room's story, not a secret); POST toggles a vote (closed circle:
 * holders only, enforced in the lib).
 */

const KINDS: BallotKind[] = ["tracklist", "cover"];

function parseKind(raw: string): BallotKind | null {
  return (KINDS as string[]).includes(raw) ? (raw as BallotKind) : null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ kind: string }> },
) {
  const { kind: rawKind } = await ctx.params;
  const kind = parseKind(rawKind);
  if (!kind) return NextResponse.json({ error: "unknown ballot" }, { status: 404 });

  const [event, phase, voterId] = await Promise.all([
    getCurrentEvent(),
    getCurrentPhase(),
    currentVoterId(),
  ]);
  return NextResponse.json(await getBallot(kind, event.id, phase, voterId));
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ kind: string }> },
) {
  const { kind: rawKind } = await ctx.params;
  const kind = parseKind(rawKind);
  if (!kind) return NextResponse.json({ error: "unknown ballot" }, { status: 404 });

  const { optionId } = (await req.json()) as { optionId?: string };
  if (!optionId) return NextResponse.json({ error: "missing option" }, { status: 400 });

  const [event, phase, voterId] = await Promise.all([
    getCurrentEvent(),
    getCurrentPhase(),
    currentVoterId(),
  ]);
  const result = await toggleBallotVote(kind, event.id, phase, voterId, optionId);

  if (!result.ok) {
    const map = {
      closed: { status: 409, error: "this vote isn't open" },
      "not-holder": {
        status: 403,
        error: "voting is for the room — enter your event code first",
      },
      "unknown-option": { status: 404, error: "that option isn't on the ballot" },
      budget: { status: 409, error: "you've used all your votes — remove one first" },
    } as const;
    const m = map[result.reason];
    return NextResponse.json({ error: m.error, reason: result.reason }, { status: m.status });
  }
  return NextResponse.json(result);
}
