import { getUserByEmail } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Get search params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query videos from D1
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });
    }

    const sql = `SELECT * FROM videos ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const params = [limit, offset];

    const d1Response = await fetch(`${dbUrl}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CLOUDFLARE_D1_API_TOKEN ? { "Authorization": `Bearer ${process.env.CLOUDFLARE_D1_API_TOKEN}` } : {})
      },
      body: JSON.stringify({ sql, params }),
    });

    const d1Data = await d1Response.json() as {
      result?: { results?: any[] }[];
      success?: boolean;
      [key: string]: any;
    };

    if (!d1Response.ok || d1Data.success === false) {
      return NextResponse.json({ error: "Failed to fetch videos", details: d1Data }, { status: 500 });
    }

    const videos = d1Data.result?.[0]?.results || [];
    
    return NextResponse.json({ 
      videos: videos.map(video => ({
        ...video,
        is_public: video.is_public === 1,
        credits: video.credits ? JSON.parse(video.credits) : [],
        related_projects: video.related_projects ? JSON.parse(video.related_projects) : []
      }))
    }, { status: 200 });

  } catch (err) {
    console.error("Get videos error:", err);
    return NextResponse.json({ error: "Failed to fetch videos", details: String(err) }, { status: 500 });
  }
}
