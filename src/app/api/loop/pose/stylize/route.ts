import { NextResponse } from "next/server";
import { getStylizeProvider } from "@/lib/loop/pose/generative";

/**
 * "Make it a poster" — the generative stylize upgrade for Pose Studio.
 *
 * The client POSTs the ORIGINAL captured photo (raw image bytes, the request's
 * content-type is the image mime). The provider (mock | live, per
 * POSE_STYLIZE_MODE) returns a Loop Soul poster. In `mock` mode it echoes the
 * image back so the full round-trip is testable with no key or cost; flip
 * POSE_STYLIZE_MODE=live (+ GEMINI_API_KEY) and the same path runs off Gemini.
 *
 * On-device duotone (stylize.ts) is the always-free baseline and doesn't hit
 * this route — this is only the opt-in exact-match upgrade.
 */
export const runtime = "nodejs";

// Guard against oversized uploads (phone photos are a few MB; cap generously).
const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request) {
  const buf = await req.arrayBuffer();
  if (!buf || buf.byteLength === 0) {
    return NextResponse.json({ error: "no image supplied" }, { status: 400 });
  }
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "image too large" }, { status: 413 });
  }

  const mime = req.headers.get("content-type") ?? "image/jpeg";
  try {
    const result = await getStylizeProvider().stylize({ image: buf, mime });
    return new Response(result.image, {
      status: 200,
      headers: { "content-type": result.mime, "x-stylize-mode": result.mode },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "stylize failed" },
      { status: 502 },
    );
  }
}
