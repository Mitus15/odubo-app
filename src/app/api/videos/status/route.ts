import { NextRequest, NextResponse } from "next/server";
export const runtime = 'nodejs';
import CloudflareStreamAPI from "@/lib/cloudflareStream";
import { requireAdmin } from "@/lib/api/requireAdmin";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  // An X-User-Email header naming any registered user used to pass for an
  // admin here. Nothing sends it to this route.
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;

  try {
    const { searchParams } = new URL(req.url);
    const streamVideoId = searchParams.get('streamVideoId');

    if (!streamVideoId) {
      return NextResponse.json({ error: "Stream video ID required" }, { status: 400 });
    }

    // Check if Cloudflare Stream is configured
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || !(process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN)) {
      return NextResponse.json({ error: "Cloudflare Stream not configured" }, { status: 500 });
    }

    const streamAPI = new CloudflareStreamAPI();
    const videoDetails = await streamAPI.getVideo(streamVideoId);

    if (!videoDetails.success) {
      return NextResponse.json({ error: "Failed to fetch video status" }, { status: 500 });
    }

  const { result } = videoDetails;
  try { await writeAuditLog(req, gate.user, 'videos.stream_status', String(streamVideoId), { state: result.status.state, pct: result.status.pctComplete }); } catch {}
    
    return NextResponse.json({
      success: true,
      data: {
        uid: result.uid,
        status: result.status.state,
        progress: result.status.pctComplete,
        readyToStream: result.readyToStream,
        duration: result.duration,
        thumbnail: result.thumbnail,
        playback: result.playback,
        input: result.input,
        error: result.status.errorReasonText || null,
        created: result.created,
        modified: result.modified
      }
    });

  } catch (error) {
    console.error('Video status check error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
