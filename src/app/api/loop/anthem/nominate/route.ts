import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { isNominationOpen } from "@/lib/loop/anthem-rounds";
import { add, leaderboard } from "@/lib/loop/anthem-candidates";
import { canSuggest } from "@/lib/loop/event-codes";
import type { TrackResult } from "@/lib/loop/music/itunes";

/**
 * Suggest a track for the bracket. Only accepted while nominations are open;
 * deduped by iTunes id so re-suggesting a song just surfaces the existing
 * candidate. The suggester implicitly upvotes their own pick.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<TrackResult>;
  if (!body.id || !body.title || !body.previewUrl) {
    return NextResponse.json({ error: "invalid track" }, { status: 400 });
  }

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  if (!(await isNominationOpen(event, Date.now()))) {
    return NextResponse.json({ error: "nominations are closed" }, { status: 409 });
  }
  if (!(await canSuggest(event.id, voterId))) {
    return NextResponse.json(
      { error: "a pass is needed to suggest a song" },
      { status: 403 },
    );
  }

  const track: TrackResult = {
    id: body.id,
    title: body.title,
    artist: body.artist ?? "",
    previewUrl: body.previewUrl,
    artworkUrl: body.artworkUrl ?? "",
  };
  await add(event.id, track, voterId, Date.now());
  const rows = (await leaderboard(event.id, voterId)).filter((r) => !r.candidate.hidden);
  return NextResponse.json({ ok: true, leaderboard: rows });
}
