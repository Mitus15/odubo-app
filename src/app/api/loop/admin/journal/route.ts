import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { setJournalIssue, setJournalMoments } from "@/lib/loop/journal-store";

/**
 * Save The Loop Journal for the active event. One endpoint, two payload
 * shapes, because the panel has two save buttons that must not clobber each
 * other's data:
 *   { issue: { headline, standfirst, published } }  — the editorial frame
 *   { items: [{ id, photoUid, caption }] }          — the Iconic Moments order
 *
 * `items` is only the editorial overlay. The photographs themselves come from
 * the Wall's featured set, so there is no image URL to accept here — which also
 * means this route can no longer be used to point the magazine at an arbitrary
 * off-site image.
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
    // Take only the overlay fields, whatever else the client sent.
    const items = body.items.map((raw) => {
      const m = (raw ?? {}) as Record<string, unknown>;
      return {
        id: typeof m.id === "string" ? m.id : undefined,
        photoUid: typeof m.photoUid === "string" ? m.photoUid : null,
        caption: typeof m.caption === "string" ? m.caption : "",
      };
    });
    await setJournalMoments(event.id, items);
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
