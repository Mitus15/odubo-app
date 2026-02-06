/**
 * Thumbnail Service
 * 
 * Automated thumbnail generation for videos and clips.
 * 
 * Two modes:
 * 1. Clip thumbnails: Random frame extraction (10%-90% of duration) → R2 storage
 * 2. Parent video thumbnails: AI-powered frame analysis via Gemini → ranked candidates
 * 
 * Used by:
 * - Stream webhook handler (automatic processing when video is ready)
 * - Backfill scripts (batch processing existing content)
 * - Admin thumbnail regeneration
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { executeQuery, queryDatabase } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import sharp from 'sharp';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// R2 S3-compatible client
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'odubo-studio-media';
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

interface ThumbnailResult {
  success: boolean;
  posterUrl?: string;
  timestamp?: number;
  error?: string;
}

interface AICandidate {
  url: string;
  timestamp: number;
  pct: number;
  score: number;
  rationale?: string;
}

/**
 * Generate a random thumbnail for a clip
 * Picks a random frame between 10%-90% of duration, uploads to R2
 */
export async function generateClipThumbnail(
  uid: string,
  durationSeconds: number,
  videoId: number
): Promise<ThumbnailResult> {
  try {
    if (!durationSeconds || durationSeconds < 1) {
      return { success: false, error: 'Invalid duration' };
    }

    const stream = new CloudflareStreamAPI();

    // Pick random timestamp between 10%-90% to avoid black intro/outro frames
    const minPct = 0.1;
    const maxPct = 0.9;
    const randomPct = minPct + (Math.random() * (maxPct - minPct));
    const timestamp = Math.floor(randomPct * durationSeconds);

    // Fetch frame from Cloudflare Stream
    const thumbnailUrl = stream.getThumbnailUrl(uid, {
      time: `${timestamp}s`,
      width: 1280,
      height: 720
    });

    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      return { success: false, error: `Failed to fetch frame: ${response.status}` };
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Optimize with sharp
    const optimized = await sharp(imageBuffer)
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Upload to R2
    const key = `thumbnails/clips/${videoId}/${timestamp}.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: optimized,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    } as any));

    const posterUrl = `${R2_PUBLIC_URL}/${key}`;

    // Update database
    await executeQuery(
      'UPDATE videos SET poster_url = ?, thumbnail = ?, updated_at = datetime(\\'now\\') WHERE id = ?',
      [posterUrl, posterUrl, videoId]
    );

    console.log(`[ThumbnailService] Generated clip thumbnail for video ${videoId} at ${timestamp}s`);
    return { success: true, posterUrl, timestamp };

  } catch (error: any) {
    console.error(`[ThumbnailService] Failed to generate clip thumbnail for video ${videoId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate AI-ranked thumbnail candidates for a parent video
 * Samples frames at narrative beats, ranks with Gemini, auto-sets best
 */
export async function generateAIThumbnailCandidates(
  uid: string,
  videoId: number,
  context?: { title?: string; category?: string; mood?: string }
): Promise<ThumbnailResult> {
  try {
    const stream = new CloudflareStreamAPI();

    // Get video duration
    const details = await stream.getVideo(uid);
    const durationSec = Math.max(0, Number(details?.result?.duration || 0));

    if (durationSec < 1) {
      return { success: false, error: 'Video not ready or invalid duration' };
    }

    // Sample frames at narrative beats (avoid very beginning/end)
    const samplePcts = [0.15, 0.35, 0.50, 0.65, 0.85];
    const candidates: AICandidate[] = [];

    for (const pct of samplePcts) {
      const timestamp = Math.floor(pct * durationSec);
      const url = stream.getThumbnailUrl(uid, {
        time: `${timestamp}s`,
        width: 640,
        height: 360
      });

      // Fetch and analyze frame
      const response = await fetch(url);
      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());

      // Basic quality heuristics
      const score = await analyzeFrameQuality(buffer);

      candidates.push({
        url,
        timestamp,
        pct,
        score,
      });
    }

    if (candidates.length === 0) {
      return { success: false, error: 'No valid frames extracted' };
    }

    // Sort by quality score
    candidates.sort((a, b) => b.score - a.score);

    // Use Gemini for final ranking if API key available
    let finalRanking = candidates;
    if (GEMINI_API_KEY && candidates.length >= 3) {
      finalRanking = await rankWithGemini(candidates.slice(0, 5), context || {});
    }

    // Auto-set best thumbnail
    const best = finalRanking[0];
    const bestThumbnailUrl = stream.getThumbnailUrl(uid, {
      time: `${best.timestamp}s`,
      width: 1280,
      height: 720
    });

    // Update database
    await executeQuery(
      'UPDATE videos SET poster_url = ?, thumbnail = ?, thumbnail_timestamp_pct = ?, updated_at = datetime(\\'now\\') WHERE id = ?',
      [bestThumbnailUrl, bestThumbnailUrl, best.pct, videoId]
    );

    // Store candidates for admin review (optional - requires upload session concept)
    // For now, just log them
    console.log(`[ThumbnailService] Generated AI thumbnails for video ${videoId}. Best: ${best.timestamp}s (score: ${best.score.toFixed(2)})`);

    return {
      success: true,
      posterUrl: bestThumbnailUrl,
      timestamp: best.timestamp
    };

  } catch (error: any) {
    console.error(`[ThumbnailService] Failed to generate AI thumbnails for video ${videoId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Analyze frame quality using image processing heuristics
 */
async function analyzeFrameQuality(buffer: Buffer): Promise<number> {
  try {
    const img = sharp(buffer).resize({ width: 640, withoutEnlargement: true });
    const stats = await img.stats();

    // Brightness (prefer mid-range)
    const means = stats.channels.slice(0, 3).map(c => c.mean);
    const brightness = means.reduce((a, b) => a + b, 0) / (3 * 255);
    const brightnessPenalty = Math.abs(brightness - 0.55) * 0.8;

    // Contrast (higher is better)
    const stdevs = stats.channels.slice(0, 3).map(c => c.stdev);
    const contrast = stdevs.reduce((a, b) => a + b, 0) / (3 * 255);

    // Entropy (complexity/detail)
    const entropy = stats.entropy / 8; // Normalize to 0-1

    // Laplacian variance (sharpness)
    const { data } = await sharp(buffer)
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0, sumSq = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      sumSq += data[i] * data[i];
    }
    const mean = sum / data.length;
    const variance = sumSq / data.length - mean * mean;
    const clarity = Math.min(1, variance / (255 * 255) * 4);

    // Weighted score
    const score = 0.45 * entropy + 0.35 * contrast + 0.5 * clarity - brightnessPenalty;
    return Math.max(0, Math.min(1, score));

  } catch {
    return 0.5; // Default mid-score on error
  }
}

/**
 * Rank candidates using Gemini Vision API
 */
async function rankWithGemini(
  candidates: AICandidate[],
  context: { title?: string; category?: string; mood?: string }
): Promise<AICandidate[]> {
  try {
    if (!GEMINI_API_KEY) return candidates;

    const parts: any[] = [
      {
        text: [
          'You are an expert cinematographer choosing the best thumbnail frame.',
          'Evaluate EACH image by composition, subject clarity, color harmony, and emotional impact.',
          `Context: title="${context.title || ''}", category="${context.category || ''}", mood="${context.mood || ''}".`,
          'Return STRICT JSON: { "order": [0-based indexes best to worst], "rationale": "one sentence" }'
        ].join('\\n')
      }
    ];

    // Add images
    for (const candidate of candidates) {
      const response = await fetch(candidate.url);
      const buffer = await response.arrayBuffer();
      const resized = await sharp(Buffer.from(buffer))
        .resize({ width: 320 })
        .jpeg({ quality: 70 })
        .toBuffer();

      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: resized.toString('base64')
        }
      });
    }

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
    });

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\\{[\\s\\S]*\\}/);
    const parsed = match ? JSON.parse(match[0]) : null;

    if (parsed?.order && Array.isArray(parsed.order)) {
      const reordered = parsed.order.map((i: number) => candidates[i]).filter(Boolean);
      console.log(`[ThumbnailService] Gemini ranking: ${parsed.rationale || 'no rationale'}`);
      return reordered.length > 0 ? reordered : candidates;
    }

    return candidates;

  } catch (error) {
    console.warn('[ThumbnailService] Gemini ranking failed, using heuristic scores:', error);
    return candidates;
  }
}
