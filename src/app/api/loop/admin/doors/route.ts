import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/loop/db";
import { doorsOpen } from "@/lib/loop/doors";

/** Open/close the room without codes. Auth: middleware gates /api/loop/admin/*. */
export async function GET() {
  return NextResponse.json({ open: await doorsOpen() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { open?: boolean } | null;
  if (typeof body?.open !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await executeQuery(
    `INSERT INTO loop_settings (key, value, updated_at) VALUES ('doors_open', ?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2`,
    [body.open ? "1" : "0", new Date().toISOString()],
  );
  return NextResponse.json({ open: await doorsOpen() });
}
