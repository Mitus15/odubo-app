import { getUserByEmail } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const runtime = 'edge';
import CloudflareStreamAPI from "@/lib/cloudflareStream";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Configure larger request size limit for video uploads
export const maxDuration = 900; // 15 minutes timeout for 20GB uploads
export const dynamic = 'force-dynamic';

// S3 client setup for Cloudflare R2 (backup/fallback)
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(req: NextRequest) {
  // Authenticate admin
  const email = req.headers.get("x-user-email") || req.headers.get("X-User-Email");
  const user = await getUserByEmail(email || "");
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
  }

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
    const category = formData.get("category") as string || "";
    const is_public = formData.get("is_public") === "true" || formData.get("is_public") === "1" ? 1 : 0;
    const type = formData.get("type") as string || "";
    const credits = formData.get("credits") as string || "";
    const uploadMethod = formData.get("uploadMethod") as string || "stream"; // "stream" or "r2"

    // Determine upload strategy
    const useCloudflareStream = uploadMethod === "stream" && 
      process.env.CLOUDFLARE_ACCOUNT_ID && 
      process.env.CLOUDFLARE_API_TOKEN;

    let videoUrl = "";
    let posterUrl = "";
    let streamVideoId = "";
    let duration = 0;
    let thumbnailUrl = "";

    if (useCloudflareStream) {
      // Upload to Cloudflare Stream
      console.log('Uploading video to Cloudflare Stream...');
      
      try {
        const streamAPI = new CloudflareStreamAPI();
        
        // Upload video to Stream
        const uploadResult = await streamAPI.uploadVideo(videoFile, {
          name: title,
          requireSignedURLs: !is_public,
          meta: {
            title,
            artist_name,
            description,
            category,
            type,
            credits,
            uploadedBy: email,
            uploadedAt: new Date().toISOString()
          }
        });

        if (!uploadResult.success) {
          throw new Error('Failed to upload to Cloudflare Stream');
        }

        streamVideoId = uploadResult.result.uid;
        videoUrl = streamAPI.getHlsUrl(streamVideoId);
        thumbnailUrl = streamAPI.getThumbnailUrl(streamVideoId);
        duration = uploadResult.result.duration || 0;

        console.log('Video uploaded to Stream successfully:', {
          uid: streamVideoId,
          status: uploadResult.result.status.state
        });

        // Upload poster to R2 if provided (Stream thumbnails are auto-generated)
        if (posterFile) {
          const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
          const posterFileName = `posters/${Date.now()}-${posterFile.name}`;
          
          await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: posterFileName,
            Body: Buffer.from(await posterFile.arrayBuffer()),
            ContentType: posterFile.type,
          }));
          
          posterUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${posterFileName}`;
        } else {
          // Use Stream's auto-generated thumbnail as poster
          posterUrl = thumbnailUrl;
        }

      } catch (streamError) {
        console.error('Cloudflare Stream upload failed, falling back to R2:', streamError);
        
        // Fallback to R2 upload
        const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
        const videoFileName = `videos/${Date.now()}-${videoFile.name}`;
        
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: videoFileName,
          Body: Buffer.from(await videoFile.arrayBuffer()),
          ContentType: videoFile.type,
        }));

        videoUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${videoFileName}`;

        // Upload poster to R2 if provided
        if (posterFile) {
          const posterFileName = `posters/${Date.now()}-${posterFile.name}`;
          
          await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: posterFileName,
            Body: Buffer.from(await posterFile.arrayBuffer()),
            ContentType: posterFile.type,
          }));
          
          posterUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${posterFileName}`;
        }
      }
    } else {
      // Upload to R2 directly
      console.log('Uploading video to Cloudflare R2...');
      
      const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
      const videoFileName = `videos/${Date.now()}-${videoFile.name}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: videoFileName,
        Body: Buffer.from(await videoFile.arrayBuffer()),
        ContentType: videoFile.type,
      }));

      videoUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${videoFileName}`;

      // Upload poster to R2 if provided
      if (posterFile) {
        const posterFileName = `posters/${Date.now()}-${posterFile.name}`;
        
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: posterFileName,
          Body: Buffer.from(await posterFile.arrayBuffer()),
          ContentType: posterFile.type,
        }));
        
        posterUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${posterFileName}`;
      }
    }

    // Save video metadata to D1 database
    const videoData = {
      title,
      artist_name,
      description,
      url: videoUrl,
      poster_url: posterUrl,
      thumbnail: thumbnailUrl || posterUrl,
      duration: duration > 0 ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '',
      category,
      is_public,
      type,
      credits,
      stream_video_id: streamVideoId,
      created_at: new Date().toISOString()
    };

    // Insert into D1 database
    const d1Response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.CLOUDFLARE_D1_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CLOUDFLARE_D1_API_TOKEN ? { "Authorization": `Bearer ${process.env.CLOUDFLARE_D1_API_TOKEN}` } : {})
        },
        body: JSON.stringify({
          sql: `INSERT INTO videos (
            title, artist_name, description, url, poster_url, thumbnail, 
            duration, category, is_public, type, credits, stream_video_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            videoData.title,
            videoData.artist_name,
            videoData.description,
            videoData.url,
            videoData.poster_url,
            videoData.thumbnail,
            videoData.duration,
            videoData.category,
            videoData.is_public,
            videoData.type,
            videoData.credits,
            videoData.stream_video_id,
            videoData.created_at
          ]
        })
      }
    );

    if (!d1Response.ok) {
      const d1ErrorData = await d1Response.json();
      console.error('D1 database error:', d1ErrorData);
      throw new Error(`Database error: ${JSON.stringify(d1ErrorData)}`);
    }

    const d1Result = await d1Response.json() as any;
    console.log('Video metadata saved to D1:', d1Result);

    // If using Stream, start polling for video processing status
    if (streamVideoId && useCloudflareStream) {
      // Don't wait for processing to complete, return immediately
      // The frontend can poll for status updates or we can implement webhooks
      console.log(`Video uploaded to Stream with ID: ${streamVideoId}. Processing in background...`);
    }

    return NextResponse.json({
      success: true,
      message: useCloudflareStream 
        ? "Video uploaded to Cloudflare Stream and recorded in D1." 
        : "Video uploaded to R2 and recorded in D1.",
      data: {
        ...videoData,
        id: d1Result.result?.[0]?.meta?.last_row_id || null,
        uploadMethod: useCloudflareStream ? 'stream' : 'r2',
        streamVideoId: streamVideoId || null,
        processing: streamVideoId ? true : false
      }
    });

  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
