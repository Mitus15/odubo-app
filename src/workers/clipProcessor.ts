import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { Buffer } from 'buffer';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { uploadFileToGemini, callGeminiWithFile } from '@/lib/gemini';
import { executeQuery, queryDatabase, updateJobStatus, appendJobEvent } from '@/lib/db';

// Parse times like 75.2 or "1:04.0" → seconds
function parseTime(t: any): number {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const s = t.trim();
    if (s.includes(':')) {
      const parts = s.split(':');
      if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
      if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    const n = parseFloat(s);
    if (!Number.isNaN(n)) return n;
  }
  return NaN;
}

export type ClipJobPayload = { jobId: string; videoId: number; cfVideoId: string; userId?: string };

export async function processClipJob(job: ClipJobPayload) {
  const { jobId, videoId, cfVideoId } = job;
  const tmpInput = path.join(os.tmpdir(), `source-${cfVideoId}-${Date.now()}.mp4`);
  let fileUri: string | null = null;

  await updateJobStatus(jobId, 'RUNNING', null, videoId, cfVideoId);
  await appendJobEvent(jobId, 'started', `Job started for video ${videoId}`);

  try {
    const stream = new CloudflareStreamAPI();

    // Ensure MP4 download is available; poll until ready (up to ~5 minutes)
    await appendJobEvent(jobId, 'check-download', 'Checking for download URL');
    let downloadUrl = await stream.getDownloadUrl(cfVideoId);
    if (!downloadUrl) {
      await stream.enableDownloads(cfVideoId);
      await appendJobEvent(jobId, 'enable-downloads', 'Enabled downloads on Stream');
      const start = Date.now();
      for (let i = 0; i < 150 && !downloadUrl; i++) { // 150 * 2s ≈ 5 minutes
        await new Promise(r => setTimeout(r, 2000));
        // Check readiness state to surface better errors
        try {
          const details = await stream.getVideo(cfVideoId);
          const state = details?.result?.status?.state;
          const pct = details?.result?.status?.pctComplete;
          if (i % 10 === 0) {
            console.log(`[Worker] Stream state=${state} pct=${pct} waiting for download URL...`);
            await appendJobEvent(jobId, 'stream-state', `state=${state} pct=${pct}`);
          }
        } catch {}
        downloadUrl = await stream.getDownloadUrl(cfVideoId);
      }
      if (!downloadUrl) {
        const waitedMs = Date.now() - start;
        const msg = `Timeout waiting for video download URL after ${Math.round(waitedMs/1000)}s`;
        await appendJobEvent(jobId, 'timeout', msg);
        throw new Error(msg);
      }
    }

    // Fetch video details for duration
    let videoDuration = 0;
    try {
      const details = await stream.getVideo(cfVideoId);
      videoDuration = details.result.duration || 0;
    } catch {}

    // Download source to temp file
    await appendJobEvent(jobId, 'download', 'Downloading source MP4');
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Failed to download source video: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(tmpInput, buf);

    // Upload to Gemini and request analysis
    await appendJobEvent(jobId, 'upload-ai', 'Uploading to Gemini');
    fileUri = await uploadFileToGemini(buf, 'video/mp4', `video-${cfVideoId}`);
    const prompt = `
      Role: World-class video semantic analyst and social media strategist.
      Style: Write like multimedia literature but in clear, colloquial language — vivid, concise, modern.
      Priority: You MUST prioritize musical movements (chorus, bridge, drop) over visual scene changes for clip segmentation.
      Task: Analyze the video (visual + audio) and return a JSON object with:
      - title
      - description (colloquial, evocative, ~3 sentences)
      - artist_name
      - mood
      - category
      - tags (array of short, lowercase tags)
      - suggestedClips: array of 5–8 items { startTime, endTime, priority (1-3), reason }
      - thumbnailMoments: array of 4–6 items { timestamp, label, emotion }
      - keyframeInstructions (optional): array of { timestamp, coordinate: { x, y }, zoom }

      Rules:
      - Suggested clips are advisory only if manual markers exist.
      - Times must be seconds (numbers) or MM:SS strings (quoted) that we convert.
      - Focus on musically significant spans (chorus/verse/bridge/drop).
      - Keep language friendly and specific; avoid marketing fluff.
    `;
    await appendJobEvent(jobId, 'ai-request', 'Requesting analysis');
    const gemRes = await callGeminiWithFile(prompt, fileUri, 'video/mp4');
    const rawText = (gemRes as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('No analysis returned from Gemini');

    // Sanitize and parse JSON
    let analysis: any;
    try {
      let clean = rawText.replace(/```json\n?|\n?```/g, '');
      clean = clean.replace(/:\s*(\d{1,2}:\d{1,2}(?:\.\d+)?)/g, ': "$1"');
      clean = clean.replace(/("timestamp"\s*:\s*)(\d{1,2}:\d{1,2}(?:\.\d+)?)/g, '$1"$2"');
      const objMatch = clean.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(objMatch ? objMatch[0] : clean);
    } catch (e) {
      console.error('[Worker] Invalid Gemini JSON:', rawText);
      throw new Error('Invalid JSON from Gemini');
    }

    // Normalize thumbnailMoments fallback to keyframeInstructions
    if (!analysis.thumbnailMoments && analysis.keyframeInstructions) {
      analysis.thumbnailMoments = analysis.keyframeInstructions
        .slice(0, 6)
        .map((k: any, idx: number) => ({ timestamp: k.timestamp, label: `Keyframe ${idx + 1}`, emotion: 'focus' }));
    }

    // Optional: update video metadata with analysis summary
    try {
      // User requested: AI should NOT replace original video name or artist.
      // Only update description, mood, category, ai_description, tags.
      await appendJobEvent(jobId, 'db-update', 'Updating video fields');
      await executeQuery(
        `UPDATE videos SET 
          description = COALESCE(?, description),
          mood = COALESCE(?, mood),
          category = COALESCE(?, category),
          ai_description = ?,
          tags = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [
          analysis.description,
          analysis.mood,
          analysis.category,
          JSON.stringify(analysis),
          JSON.stringify(analysis.keywords || analysis.tags || []),
          videoId
        ]
      );
    } catch (e) {
      console.warn('[Worker] Failed to update video analysis fields');
      await appendJobEvent(jobId, 'db-update-failed', 'Failed to update video analysis fields');
    }

    // Cleanup existing clips for this video - DISABLED per user request for new workflow
    // The user wants to manually manage clips.
    /*
    try {
      const oldClips = await queryDatabase(
        `SELECT id, uid FROM videos WHERE type = 'clip' AND related_projects LIKE ?`,
        [`%parent_id:${videoId}%`]
      );
      for (const oc of oldClips) {
        try { if (oc.uid) await stream.deleteVideo(oc.uid); } catch {}
        await executeQuery(`DELETE FROM videos WHERE id = ?`, [oc.id]);
      }
    } catch (e) {
      console.warn('[Worker] Clip cleanup failed', e);
    }
    */

    // Generate and upload clips — DISABLED per user request
    // The user wants to manually upload clips.
    /*
    const minDur = 1; // minimal sanity: skip zero/negative
    const maxDur = videoDuration || 10_000; // no artificial cap when using markers
    const targetDur = 30; // only used in AI fallback

    // ... (rest of clip generation logic) ...
    */
    
    console.log(`[Worker] Analysis complete for video ${videoId}. Clip generation skipped.`);
    await appendJobEvent(jobId, 'complete', 'Analysis complete');
    await updateJobStatus(jobId, 'COMPLETED', null, videoId, cfVideoId);


  } catch (err: any) {
    console.error(`[Worker] Job ${jobId} failed:`, err);
    await appendJobEvent(jobId, 'error', err?.message || String(err));
    await updateJobStatus(jobId, 'FAILED', err?.message || String(err), videoId, cfVideoId);
  } finally {
    try { if (tmpInput && fsSync.existsSync(tmpInput)) await fs.unlink(tmpInput); } catch {}
    // Optional: cleanup Gemini file by URI if supported
  }
}
