import { getUserByEmail } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import CloudflareStreamAPI from "@/lib/cloudflareStream";

export async function GET(req: NextRequest) {
  // Authenticate user
  const email = req.headers.get("x-user-email") || req.headers.get("X-User-Email");
  const user = await getUserByEmail(email || "");
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const streamVideoId = searchParams.get('streamVideoId');

    if (!streamVideoId) {
      return NextResponse.json({ error: "Stream video ID required" }, { status: 400 });
    }

    // Check if Cloudflare Stream is configured
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      return NextResponse.json({ error: "Cloudflare Stream not configured" }, { status: 500 });
    }

    const streamAPI = new CloudflareStreamAPI();
    const videoDetails = await streamAPI.getVideo(streamVideoId);

    if (!videoDetails.success) {
      return NextResponse.json({ error: "Failed to fetch video status" }, { status: 500 });
    }

    const { result } = videoDetails;
    
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
