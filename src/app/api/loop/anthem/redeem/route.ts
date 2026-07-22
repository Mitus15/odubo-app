import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { canSuggest, redeem } from "@/lib/loop/event-codes";

/**
 * Redeem an event code to unlock suggesting. Binds the code to the current
 * anonymous voter (ls_voter), marking them a pass-holder. Upvoting and bracket
 * voting never need this — only suggesting a new song does.
 */
export async function POST(req: Request) {
  const { code } = (await req.json()) as { code?: string };
  if (!code || !code.trim()) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const result = await redeem(event.id, code, voterId);

  if (!result.ok) {
    const status = result.reason === "used" ? 409 : 404;
    const error = result.reason === "used" ? "that code is already used" : "unknown code";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ ok: true, canSuggest: await canSuggest(event.id, voterId) });
}
