import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { admitCode, countAdmitted, lookupCode } from "@/lib/loop/event-codes";
import { parseScannedCode } from "@/lib/loop/door";

/**
 * The door. Auth: middleware gates /api/loop/admin/*.
 *
 *   GET                     → { admitted, sold }
 *   POST { code }           → look a pass up: { status: "found" | "unknown", pass }
 *   POST { code, admit }    → let it in:     { status: "admitted" | "already" | "unknown", pass }
 *
 * `code` may be the bare pass, or the whole door URL a ticket QR encodes.
 */
export async function GET() {
  const event = await getCurrentEvent();
  return NextResponse.json(await countAdmitted(event.id), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { code?: string; admit?: boolean } | null;
  const code = parseScannedCode(body?.code);
  if (!code) return NextResponse.json({ status: "unknown", error: "That is not a pass." }, { status: 400 });

  const event = await getCurrentEvent();

  if (!body?.admit) {
    const pass = await lookupCode(event.id, code);
    if (!pass) return NextResponse.json({ status: "unknown", code }, { status: 404 });
    return NextResponse.json({ status: "found", pass });
  }

  const result = await admitCode(event.id, code);
  if (!result.ok) return NextResponse.json({ status: "unknown", code }, { status: 404 });
  const pass = await lookupCode(event.id, code);
  return NextResponse.json({
    status: result.already ? "already" : "admitted",
    pass,
    counts: await countAdmitted(event.id),
  });
}
