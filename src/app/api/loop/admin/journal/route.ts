import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import {
  setJournalIssue,
  setJournalMoments,
  type JournalMoment,
} from "@/lib/loop/journal-store";

/**
 * Save The Loop Journal for the active event. One endpoint, two payload
 * shapes, because the panel has two save buttons that must not clobber each
 * other's data:
 *   { issue: { headline, standfirst, published } } — the editorial frame
 *   { items: JournalMoment[] }                     — the Iconic Moments list
 *
 * Gated by the `ls_admin` session cookie in middleware (see admin-auth.ts).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    issue?: { headline?: unknown; standfirst?: unknown; published?: unknown };
    items?: unknown;
  };
  const event = await getCurrentEvent();

  if (Array.isArray(body.items)) {
    await setJournalMoments(event.id, body.items as JournalMoment[]);
    return NextResponse.json({ ok: true });
  }

  if (body.issue && typeof body.issue === "object") {
    const { headline, standfirst, published } = body.issue;
    await setJournalIssue(event.id, {
      headline: typeof headline === "string" ? headline : undefined,
      standfirst: typeof standfirst === "string" ? standfirst : undefined,
      published: typeof published === "boolean" ? published : undefined,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "expected { issue } or { items }" },
    { status: 400 },
  );
}
