import { getUserFromRequest, isAdminUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { uploadFileOrganized } from "@/worker/upload";
import { VideoType } from "@/lib/fileOrganization";
import CloudflareStreamAPI from "@/lib/cloudflareStream";
import { rateLimit } from "@/lib/rateLimit";

// Configure larger request size limit for video uploads
export const maxDuration = 900; // 15 minutes timeout for 20GB uploads
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
    const posterFile = formData.get("poster") as File | null;
    
    if (!videoFile) {
      return NextResponse.json({ error: "Missing video file" }, { status: 400 });
    }

    // Extract metadata fields
    const title = formData.get("title") as string || "";
    const artist_name = formData.get("artist_name") as string || "";
    const description = formData.get("description") as string || "";
    const thumbnail = formData.get("thumbnail") as string || "";
    const duration = formData.get("duration") as string || "";
    const category = formData.get("category") as string || "";
    const is_public = formData.get("is_public") === "true" || formData.get("is_public") === "1" ? 1 : 0;
    const type = formData.get("type") as string || "";
    const mood = formData.get("mood") as string || "";
    const credits = formData.get("credits") as string || "";
    const related_projects = formData.get("related_projects") as string || "";

    console.log("Received video upload:", { title, type, category, videoFileName: videoFile.name });

    // Generate video ID for organization
    const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Map type to our video type system
    const videoType: VideoType = type === 'music-video' ? 'music-video' : 
                                 type === 'short-film' ? 'short-film' : 
                                 'feature';

    // Upload video file using organized system
    const videoArrayBuffer = await videoFile.arrayBuffer();
    const videoUint8Array = new Uint8Array(videoArrayBuffer);
    
    const videoUploadResult = await uploadFileOrganized(
      videoUint8Array,
      videoFile.name,
      videoFile.type,
      {
        fileType: 'video',
        videoId,
        videoType,
        fileName: videoFile.name
      }
    );

    if (!videoUploadResult.success) {
      return NextResponse.json(
        { error: `Video upload failed: ${videoUploadResult.error}` },
        { status: 500 }
      );
    }

    let videoUrl = videoUploadResult.url!;
    let posterUrl = "";
    let streamVideoId: string | null = null;

    // Upload poster if provided
    if (posterFile) {
      console.log("Uploading poster file:", posterFile.name);
      
      const posterArrayBuffer = await posterFile.arrayBuffer();
      const posterUint8Array = new Uint8Array(posterArrayBuffer);
      
      const posterUploadResult = await uploadFileOrganized(
        posterUint8Array,
        posterFile.name,
        posterFile.type,
        {
          fileType: 'video-poster',
          videoId,
          fileName: posterFile.name
        }
      );

      if (posterUploadResult.success) {
        posterUrl = posterUploadResult.url!;
      } else {
        console.warn(`Poster upload failed: ${posterUploadResult.error}`);
      }
    }

    // If Cloudflare Stream credentials are present, ingest the uploaded R2 video into Stream
    try {
      if (process.env.CLOUDFLARE_ACCOUNT_ID && (process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN)) {
        const streamAPI = new CloudflareStreamAPI();
        const copyRes = await streamAPI.uploadFromUrl(videoUrl, {
          name: title || videoFile.name,
          requireSignedURLs: !(is_public === 1),
          // allowedOrigins: process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : undefined,
          meta: {
            title: title || videoFile.name,
            artist_name,
            description,
            category,
            type,
            mood,
            credits,
            related_projects,
            uploadedAt: new Date().toISOString(),
          },
        });
        streamVideoId = copyRes.result.uid;
        // Prefer Stream embed URL so the player auto-detects Stream
        videoUrl = `https://iframe.videodelivery.net/${streamVideoId}`;
        // If no explicit poster provided later, we can use Stream's thumbnail
        if (!posterFile) {
          posterUrl = `https://videodelivery.net/${streamVideoId}/thumbnails/thumbnail.jpg`;
        }
      }
    } catch (streamErr) {
      console.error("Cloudflare Stream ingestion failed, keeping R2 URL:", streamErr);
    }

    // Insert video metadata into D1 videos table
    // Try with artist_name first, fall back if column doesn't exist
    let sql, params;
    
    // First attempt with new schema including artist_name and status
    sql = `INSERT INTO videos (title, artist_name, description, url, poster_url, thumbnail, duration, category, is_public, type, mood, credits, related_projects, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`;
    params = [
      title || videoFile.name,
      artist_name,
      description,
      videoUrl,
      posterUrl,
      thumbnail,
      duration,
      category,
      is_public,
      type,
      mood,
      credits,
      related_projects,
      new Date().toISOString()
    ];

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });
    }

    let d1Response = await fetch(`${dbUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CLOUDFLARE_D1_API_TOKEN ? { "Authorization": `Bearer ${process.env.CLOUDFLARE_D1_API_TOKEN}` } : {})
      },
      body: JSON.stringify({ sql, params }),
    });

    let d1Data = await d1Response.json() as { success?: boolean; [key: string]: any };
    
    // If the first attempt fails (likely due to missing columns), try fallback schema
    if (!d1Response.ok || d1Data.success === false) {
      console.log('First attempt failed, trying fallback schema without artist_name and status...');
      
      // Fall back to original schema without artist_name, status
      sql = `INSERT INTO videos (title, description, url, poster_url, thumbnail, duration, category, is_public, type, mood, credits, related_projects, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        title || videoFile.name,
        description,
        videoUrl,
        posterUrl,
        thumbnail,
        duration,
        category,
        is_public,
        type,
        mood,
        credits,
        related_projects,
        new Date().toISOString()
      ];

      d1Response = await fetch(`${dbUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CLOUDFLARE_D1_API_TOKEN ? { "Authorization": `Bearer ${process.env.CLOUDFLARE_D1_API_TOKEN}` } : {})
        },
        body: JSON.stringify({ sql, params }),
      });

      d1Data = await d1Response.json() as { success?: boolean; [key: string]: any };
    }
    if (!d1Response.ok || d1Data.success === false) {
      return NextResponse.json({ error: "Files uploaded but DB insert failed", details: d1Data }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Video uploaded to R2 and recorded in D1.", 
      videoUrl, 
      posterUrl: posterUrl || null
    }, { status: 200 });

  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed", details: String(err) }, { status: 500 });
  }
}
