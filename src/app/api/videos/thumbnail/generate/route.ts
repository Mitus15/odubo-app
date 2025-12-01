import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdminUser } from "@/lib/auth";
import { executeQuery, queryDatabase } from "@/lib/db";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;

interface ThumbnailCandidate {
  id: number;
  url: string;
  pct: number;
  rank: number;
  rationale: string;
}

export const runtime = "nodejs";

/**
 * POST /api/videos/thumbnail/generate
 * 
 * Consolidated AI thumbnail generation workflow:
 * 1. Sample frames from the video at narrative beats (0.15, 0.35, 0.50, 0.65, 0.85)
 * 2. Use Gemini Vision to analyze and rank each frame
 * 3. Return ranked candidates for user selection
 * 
 * Body: { videoId: number, uid?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !isAdminUser(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json() as any;
    const { videoId, uid } = body;

    if (!videoId) {
      return NextResponse.json({ error: "videoId required" }, { status: 400 });
    }

    // Fetch video from database using helper function
    const rows = await queryDatabase('SELECT * FROM videos WHERE id = ? LIMIT 1', [videoId]);
    
    if (!rows.length) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const video = rows[0];
    const streamUid = uid || video.uid;
    if (!streamUid) {
      console.error(`[Thumbnail] No Stream UID available for video ${videoId}. Video record:`, video);
      return NextResponse.json({ error: "No Stream UID available" }, { status: 400 });
    }

    console.log(`Generating thumbnails for video ${videoId}, UID: ${streamUid}`);

    // Sample frames at narrative beats using Cloudflare Stream's thumbnail API
    // Format: https://videodelivery.net/{uid}/thumbnails/thumbnail.jpg?time={time}&height={height}
    const sampleTimes = [5, 15, 30, 45, 60]; // seconds
    const sampleTimestamps = [0.15, 0.35, 0.50, 0.65, 0.85]; // For AI scoring context
    
    const thumbnailUrls = sampleTimes.map((seconds) => 
      `https://videodelivery.net/${streamUid}/thumbnails/thumbnail.jpg?time=${seconds}s&height=720`
    );

    console.log('Thumbnail URLs:', thumbnailUrls);

    // Use Gemini Vision to analyze and rank frames
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    const useGemini = !!GEMINI_API_KEY;
    
    console.log(`Gemini API available: ${useGemini}`);

    const candidates: ThumbnailCandidate[] = [];

    for (let i = 0; i < sampleTimes.length; i++) {
      const pct = sampleTimestamps[i]; // For display/tracking purposes
      const url = thumbnailUrls[i];

      try {
        // Fetch the image
        console.log(`Fetching frame at ${sampleTimes[i]}s (${pct * 100}%): ${url}`);
        const imgRes = await fetch(url);
        if (!imgRes.ok) {
          console.warn(`Failed to fetch thumbnail at ${pct}: ${imgRes.status}`);
          // Add candidate anyway with default score
          candidates.push({
            id: i + 1,
            url,
            pct,
            rank: 5,
            rationale: `Frame unavailable (${imgRes.status})`
          });
          continue;
        }

        console.log(`Successfully fetched frame at ${pct * 100}%`);

        // If Gemini is available, analyze with AI
        if (useGemini) {
          const imgBuffer = await imgRes.arrayBuffer();
          const base64Image = Buffer.from(imgBuffer).toString('base64');

          // Analyze with Gemini Vision
          const prompt = `Analyze this video frame as a potential thumbnail. Rate its effectiveness on a scale of 1-10 considering:
- Visual composition and balance
- Subject clarity and focus
- Emotional impact and engagement
- Professional quality
- Ability to represent the video content

Respond with JSON: { "score": <number 1-10>, "rationale": "<brief explanation>" }`;

          // Use the SDK-compatible model name
          const model = 'gemini-2.5-flash';
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
          
          const result = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: base64Image
                    }
                  }
                ]
              }]
            })
          });

          if (!result.ok) {
            console.error(`Gemini API error at ${pct}:`, result.status, await result.text());
            candidates.push({
              id: i + 1,
              url,
              pct,
              rank: 5,
              rationale: "AI analysis failed"
            });
            continue;
          }

          const responseData = await result.json() as any;
          const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          // Extract JSON from response (handle markdown code blocks)
          let analysisData;
          try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analysisData = JSON.parse(jsonMatch[0]);
            } else {
              analysisData = JSON.parse(responseText);
            }
          } catch (parseErr) {
            console.warn(`Failed to parse Gemini response for frame ${pct}:`, responseText);
            analysisData = { score: 5, rationale: "Analysis unavailable" };
          }

          candidates.push({
            id: i + 1,
            url,
            pct,
            rank: analysisData.score || 5,
            rationale: analysisData.rationale || "No analysis"
          });
        } else {
          // No Gemini - just add frame with default score
          candidates.push({
            id: i + 1,
            url,
            pct,
            rank: 5,
            rationale: "No AI analysis (Gemini API key not configured)"
          });
        }

      } catch (err: any) {
        console.error(`Error processing frame at ${pct}:`, err.message, err.stack);
        candidates.push({
          id: i + 1,
          url,
          pct,
          rank: 5,
          rationale: `Error: ${err.message || 'Unknown error'}`
        });
      }
    }

    console.log(`Generated ${candidates.length} candidates`);

    // Sort by rank (highest first)
    candidates.sort((a, b) => b.rank - a.rank);

    // Re-rank for display (1 = best)
    candidates.forEach((c, idx) => {
      c.rank = idx + 1;
    });

    // If we have a top candidate, automatically set it as the poster
    if (candidates.length > 0) {
      const bestCandidate = candidates[0];
      
      // Update video with best thumbnail using helper function
      await executeQuery(
        'UPDATE videos SET poster_url = ?, thumbnail = ? WHERE id = ?',
        [bestCandidate.url, bestCandidate.url, videoId]
      );
    }

    return NextResponse.json({
      success: true,
      candidates,
      message: `Generated ${candidates.length} thumbnail options`,
    });

  } catch (error: any) {
    console.error("Thumbnail generation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
