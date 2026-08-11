import { NextRequest, NextResponse } from "next/server";
import { createStorageService } from "@/lib/storage/StorageService";

// Presigning uses the AWS SDK — Node runtime.
export const runtime = "nodejs";

/**
 * Serve Wall media via a presigned R2 GET (302 redirect). The bucket's public
 * URL rides on media.odubo.studio, which is down while the domain is lapsed —
 * presigned URLs go straight to the R2 S3 endpoint and work regardless. This
 * is the moments StorageService's until-now-unwired signed-download support.
 *
 * Keys are restricted to the galleries/ prefix (gallery media only) and are
 * unguessable UUIDs, so this stays safe to serve unauthenticated — the wall
 * list APIs are where attendee gating lives.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await ctx.params;
  const key = (segments ?? []).join("/");

  if (!key.startsWith("galleries/") || key.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const storage = createStorageService();
    const url = await storage.getPresignedUrl({
      key,
      operation: "get",
      expiresIn: 3600,
    });
    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        // Let the browser reuse the redirect for a while; well under the
        // presign's one-hour validity.
        "Cache-Control": "private, max-age=900",
      },
    });
  } catch (e) {
    console.error("[loop:media] presign failed:", e);
    return NextResponse.json({ error: "Media unavailable" }, { status: 502 });
  }
}
