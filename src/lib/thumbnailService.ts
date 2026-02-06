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
 *
 * FIXES APPLIED:
 * - Added black frame detection (rejects frames with avg brightness < 15)
 * - Added retry logic for black frames (up to 3 attempts with different timestamps)
 * - Added R2 upload retry with exponential backoff (3 attempts)
 * - Added thumbnail status tracking in database
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
 * Detect if a frame is mostly black (blank/invalid)
 * Returns true if average brightness is below threshold
 */
async function isBlackFrame(buffer: Buffer): Promise<boolean> {
  try {
    const stats = await sharp(buffer).stats();
    // Get mean brightness across RGB channels
    const means = stats.channels.slice(0, 3).map(c => c.mean);
    const avgBrightness = means.reduce((a, b) => a + b, 0) / 3;

    // Threshold: if average brightness < 15 (out of 255), consider it black
    const isBlack = avgBrightness < 15;

    if (isBlack) {
      console.log(`[ThumbnailService] Detected black frame (brightness: ${avgBrightness.toFixed(2)})`);
    }

    return isBlack;
  } catch (error) {
    console.warn('[ThumbnailService] Error checking black frame:', error);
    return false; // Don't reject on error
  }
}

/**
 * Upload buffer to R2 with retry logic
 * Uses exponential backoff: 1s, 2s, 4s
 */
async function uploadToR2WithRetry(
  key: string,
  body: Buffer,
  maxRetries: number = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
      } as any));

      console.log(`[ThumbnailService] R2 upload succeeded on attempt ${attempt}`);
      return true;
    } catch (error) {
      console.warn(`[ThumbnailService] R2 upload attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  return false;
}

/**
 * Update thumbnail status in database
 */
async function updateThumbnailStatus(
  videoId: number,
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'fallback',
  source?: 'cloudflare' | 'r2' | 'ai',
  error?: string
): Promise<void> {
  try {
    const fields = ['thumbnail_status = ?'];
    const params: any[] = [status];

    if (source) {
      fields.push('thumbnail_source = ?');
      params.push(source);
    }

    if (error !== undefined) {
      fields.push('thumbnail_error = ?');
      params.push(error || null);
    }

    fields.push('updated_at = datetime(\'now\')');
    params.push(videoId);

    await executeQuery(
      `UPDATE videos SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  } catch (e) {
    console.warn('[ThumbnailService] Failed to update thumbnail status:', e);
  }
}

/**
 * Generate a random thumbnail for a clip
 * Picks a random frame between 10%-90% of duration, uploads to R2
 *
 * FIXED:
 * - Retries with different timestamps if frame is black (up to 3 attempts)
 * - Uses R2 upload retry with exponential backoff
 * - Tracks thumbnail_status in database
 */
export async function generateClipThumbnail(
  uid: string,
  durationSeconds: number,
  videoId: number
): Promise<ThumbnailResult> {
  // Mark as generating
  await updateThumbnailStatus(videoId, 'generating');

  try {
    if (!durationSeconds || durationSeconds < 1) {
      await updateThumbnailStatus(videoId, 'failed', undefined, 'Invalid duration');
      return { success: false, error: 'Invalid duration' };
    }

    const stream = new CloudflareStreamAPI();
    const maxAttempts = 3;
    let imageBuffer: Buffer | null = null;
    let timestamp = 0;

    // Try different timestamps if we keep getting black frames
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Pick random timestamp between 10%-90% to avoid black intro/outro frames
      const minPct = 0.1;
      const maxPct = 0.9;
      // Spread attempts across the video: first random, then progressively different
      const randomPct = minPct + (Math.random() * (maxPct - minPct));
      // On retries, offset by thirds to try different parts of video
      const adjustedPct = attempt === 1 ? randomPct : (0.15 + (attempt * 0.25)) % 0.85 + 0.1;
      timestamp = Math.floor(adjustedPct * durationSeconds);

      // Fetch frame from Cloudflare Stream
      const thumbnailUrl = stream.getThumbnailUrl(uid, {
        time: `${timestamp}s`,
        width: 1280,
        height: 720
      });

      const response = await fetch(thumbnailUrl);
      if (!response.ok) {
        console.warn(`[ThumbnailService] Attempt ${attempt}: Failed to fetch frame at ${timestamp}s: ${response.status}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Check if frame is black
      if (await isBlackFrame(buffer)) {
        console.log(`[ThumbnailService] Attempt ${attempt}: Black frame at ${timestamp}s, trying different timestamp`);
        continue;
      }

      // Good frame found!
      imageBuffer = buffer;
      break;
    }

    if (!imageBuffer) {
      // All attempts returned black frames - fall back to Cloudflare default
      console.warn(`[ThumbnailService] All ${maxAttempts} attempts returned black frames, using Cloudflare fallback`);
      const fallbackUrl = stream.getThumbnailUrl(uid, { width: 1280, height: 720 });
      await executeQuery(
        `UPDATE videos SET poster_url = ?, thumbnail = ?, updated_at = datetime('now') WHERE id = ?`,
        [fallbackUrl, fallbackUrl, videoId]
      );
      await updateThumbnailStatus(videoId, 'fallback', 'cloudflare', 'All frames were black');
      return { success: true, posterUrl: fallbackUrl, timestamp: 0 };
    }

    // Optimize with sharp
    const optimized = await sharp(imageBuffer)
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Upload to R2 with retry
    const key = `thumbnails/clips/${videoId}/${timestamp}.jpg`;
    const uploadSuccess = await uploadToR2WithRetry(key, optimized);

    if (!uploadSuccess) {
      // R2 failed after all retries - fall back to Cloudflare URL
      console.error(`[ThumbnailService] R2 upload failed for video ${videoId}, using Cloudflare fallback`);
      const fallbackUrl = stream.getThumbnailUrl(uid, { time: `${timestamp}s`, width: 1280, height: 720 });
      await executeQuery(
        `UPDATE videos SET poster_url = ?, thumbnail = ?, updated_at = datetime('now') WHERE id = ?`,
        [fallbackUrl, fallbackUrl, videoId]
      );
      await updateThumbnailStatus(videoId, 'fallback', 'cloudflare', 'R2 upload failed');
      return { success: true, posterUrl: fallbackUrl, timestamp };
    }

    const posterUrl = `${R2_PUBLIC_URL}/${key}`;

    // Update database
    await executeQuery(
      `UPDATE videos SET poster_url = ?, thumbnail = ?, updated_at = datetime('now') WHERE id = ?`,
      [posterUrl, posterUrl, videoId]
    );

    // Mark as completed from R2
    await updateThumbnailStatus(videoId, 'completed', 'r2', null);

    console.log(`[ThumbnailService] Generated clip thumbnail for video ${videoId} at ${timestamp}s (R2: ${key})`);
    return { success: true, posterUrl, timestamp };

  } catch (error: any) {
    console.error(`[ThumbnailService] Failed to generate clip thumbnail for video ${videoId}:`, error);
    await updateThumbnailStatus(videoId, 'failed', undefined, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate AI-ranked thumbnail candidates for a parent video
 * Samples frames at narrative beats, ranks with Gemini, auto-sets best
 *
 * FIXED:
 * - Skips black frames during sampling
 * - Tracks thumbnail_status in database
 */
export async function generateAIThumbnailCandidates(
  uid: string,
  videoId: number,
  context?: { title?: string; category?: string; mood?: string }
): Promise<ThumbnailResult> {
  // Mark as generating
  await updateThumbnailStatus(videoId, 'generating');

  try {
    const stream = new CloudflareStreamAPI();

    // Get video duration
    const details = await stream.getVideo(uid);
    const durationSec = Math.max(0, Number(details?.result?.duration || 0));

    if (durationSec < 1) {
      await updateThumbnailStatus(videoId, 'failed', undefined, 'Video not ready or invalid duration');
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

      // Skip black frames
      if (await isBlackFrame(buffer)) {
        console.log(`[ThumbnailService] Skipping black frame at ${pct * 100}% (${timestamp}s)`);
        continue;
      }

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
      await updateThumbnailStatus(videoId, 'failed', undefined, 'No valid frames extracted (all black)');
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
      `UPDATE videos SET poster_url = ?, thumbnail = ?, thumbnail_timestamp_pct = ?, updated_at = datetime('now') WHERE id = ?`,
      [bestThumbnailUrl, bestThumbnailUrl, best.pct, videoId]
    );

    // Mark as completed (AI source since we used Gemini ranking if available)
    await updateThumbnailStatus(videoId, 'completed', GEMINI_API_KEY ? 'ai' : 'cloudflare', null);

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
    await updateThumbnailStatus(videoId, 'failed', undefined, error.message);
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

    const data = await geminiResponse.json() as any;
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
