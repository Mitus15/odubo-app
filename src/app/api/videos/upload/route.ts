import { getUserFromRequest, isAdminUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
export const runtime = 'nodejs';
import CloudflareStreamAPI from "@/lib/cloudflareStream";
import { rateLimit } from "@/lib/rateLimit";
import { executeQuery } from "@/lib/db";

// Configure larger request size limit for video uploads
export const maxDuration = 300; // 5 minutes timeout (adjusted for Vercel hobby limits)
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Authenticate admin using server-side token
  const authUser = getUserFromRequest(req);
  if (!isAdminUser(authUser)) {
    return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
  }
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = await rateLimit({ key: `upload:${ip}`, limit: 5, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    // Get the request body as FormData
    const formData = await req.formData();

    // Extract files
    const videoFile = formData.get("file") as File | null;
    if (!videoFile) {
      return NextResponse.json({ error: "Missing video file" }, { status: 400 });
    }

    // Extract metadata fields
    const title = (formData.get("title") as string) || "";
    const artist_name = (formData.get("artist_name") as string) || "";
    const description = (formData.get("description") as string) || "";
    const category = (formData.get("category") as string) || "";
    const is_public = formData.get("is_public") === "true" || formData.get("is_public") === "1" ? 1 : 0;
    const type = (formData.get("type") as string) || "";
    const mood = (formData.get("mood") as string) || "";
    const credits = (formData.get("credits") as string) || "";
    const related_projects = (formData.get("related_projects") as string) || "";

    // Upload directly to Cloudflare Stream
    const streamAPI = new CloudflareStreamAPI();
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : undefined;

    const uploadResult = await streamAPI.uploadVideo(videoFile, {
      name: title || videoFile.name,
      requireSignedURLs: !(is_public === 1),
      allowedOrigins: siteOrigin,
      meta: {
        title: title || videoFile.name,
        creator: artist_name || '',
        artist_name,
        description,
        category,
        type,
        mood,
        credits,
        related_projects,
        tags: [category, type, mood].filter(Boolean).join(','),
        uploadedAt: new Date().toISOString(),
      },
    });

    const streamVideoId = uploadResult.result.uid;

    // Prefer Stream embed URL (or HLS if you use custom player)
    const embedUrl = streamAPI.getEmbedUrl(streamVideoId);
    const posterUrl = streamAPI.getThumbnailUrl(streamVideoId);

    // Duration as mm:ss if available
    const seconds = Number(uploadResult.result.duration || 0);
    const duration = seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '';

    // Insert video metadata into D1 videos table (consolidated)
    const sql = `INSERT INTO videos (
      uid, title, artist_name, description, url, poster_url, thumbnail, duration,
      category, is_public, type, mood, credits, related_projects, status, stream_video_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, datetime('now'), datetime('now'))`;

    const params = [
      streamVideoId, // use Stream UID as our uid
      title || videoFile.name,
      artist_name,
      description,
      embedUrl,
      posterUrl,
      posterUrl, // thumbnail
      duration,
      category,
      is_public,
      type,
      mood,
      credits,
      related_projects,
      streamVideoId,
    ];

    await executeQuery(sql, params);

    return NextResponse.json({
      success: true,
      message: "Video uploaded to Cloudflare Stream and recorded.",
      video: {
        uid: streamVideoId,
        title: title || videoFile.name,
        artist_name,
        description,
        url: embedUrl,
        poster_url: posterUrl,
        thumbnail: posterUrl,
        duration,
        category,
        is_public,
        type,
        mood,
        credits,
        related_projects,
        status: 'published',
        stream_video_id: streamVideoId,
        created_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed", details: String(err) }, { status: 500 });
  }
}
