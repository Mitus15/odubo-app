import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { Buffer } from 'buffer';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { uploadFileToGemini, callGeminiWithFile } from '@/lib/gemini';
import { executeQuery, queryDatabase, updateJobStatus } from '@/lib/db';

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

  try {
    const stream = new CloudflareStreamAPI();

    // Ensure MP4 download is available; poll until ready
    let downloadUrl = await stream.getDownloadUrl(cfVideoId);
    if (!downloadUrl) {
      await stream.enableDownloads(cfVideoId);
      for (let i = 0; i < 30 && !downloadUrl; i++) {
        await new Promise(r => setTimeout(r, 2000));
        downloadUrl = await stream.getDownloadUrl(cfVideoId);
      }
      if (!downloadUrl) throw new Error('Timeout waiting for video download URL');
    }

    // Fetch video details for duration
    let videoDuration = 0;
    try {
      const details = await stream.getVideo(cfVideoId);
      videoDuration = details.result.duration || 0;
    } catch {}

    // Download source to temp file
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Failed to download source video: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(tmpInput, buf);

    // Upload to Gemini and request analysis
    fileUri = await uploadFileToGemini(buf, 'video/mp4', `video-${cfVideoId}`);
    const prompt = `
      Role: World-class video semantic analyst and social media strategist.
      Priority: You MUST prioritize musical movements (chorus, bridge, drop) over visual scene changes for clip segmentation.
      Task: Analyze the video (including its visual and audio components) and generate the full semantic framework object.

      Output must be a valid JSON object with keys: title, description, artist_name, mood, category,
      suggestedClips (array of { startTime, endTime, priority, reason }), and optional keyframeInstructions
      (array of { timestamp, coordinate: { x, y }, zoom }).

      Rules:
      - Suggested clips are advisory only if manual markers exist.
      - If no manual markers: provide 5–8 musically significant suggestedClips.
      - Times must be seconds (numbers) or MM:SS strings (quoted) that we convert.
      - Focus on musically significant spans (chorus/verse/bridge/drop).
    `;
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

    // Optional: update video metadata with analysis summary
    try {
      await executeQuery(
        `UPDATE videos SET 
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          artist_name = COALESCE(?, artist_name),
          mood = COALESCE(?, mood),
          category = COALESCE(?, category),
          ai_description = ?,
          tags = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [
          analysis.title,
          analysis.description,
          analysis.artist_name,
          analysis.mood,
          analysis.category,
          JSON.stringify(analysis),
          JSON.stringify(analysis.keywords || analysis.tags || []),
          videoId
        ]
      );
    } catch (e) {
      console.warn('[Worker] Failed to update video analysis fields');
    }

    // Cleanup existing clips for this video
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

    // Generate and upload clips — prefer manual markers; if present they define exact boundaries
    const minDur = 1; // minimal sanity: skip zero/negative
    const maxDur = videoDuration || 10_000; // no artificial cap when using markers
    const targetDur = 30; // only used in AI fallback

    // 1) Check manual markers
    const markers: Array<{ timestamp: number; label?: string }> = await queryDatabase(
      `SELECT timestamp, label FROM video_markers WHERE video_id = ? ORDER BY timestamp ASC`,
      [videoId]
    );

    let finalClips: Array<{ startTime: number; endTime: number; priority?: any; reason?: any }> = [];

    if (markers && markers.length > 0 && videoDuration && videoDuration > 0) {
      // Strict segmentation: consecutive marker timestamps define boundaries.
      // If the first marker is not at 0, prepend 0. Always ensure final segment ends at videoDuration unless a marker equals duration.
      const markerTimes = markers
        .map(m => Number(m.timestamp))
        .filter(n => !Number.isNaN(n) && n >= 0 && n <= videoDuration)
        .sort((a,b) => a-b);
      if (markerTimes[0] !== 0) markerTimes.unshift(0);
      if (markerTimes[markerTimes.length - 1] !== videoDuration) markerTimes.push(videoDuration);
      for (let i = 0; i < markerTimes.length - 1; i++) {
        const s = markerTimes[i];
        const e = markerTimes[i+1];
        if (e <= s) continue;
        const dur = e - s;
        if (dur < minDur) continue; // ignore zero-length spans
        finalClips.push({ startTime: s, endTime: e, priority: 'marker', reason: 'manual boundary' });
      }
    } else {
      // Fallback: AI suggestions (no minimum count padding now)
      const rawClips = Array.isArray(analysis.suggestedClips) ? analysis.suggestedClips : [];
      const normalized: Array<{ startTime: number; endTime: number; priority?: any; reason?: any }> = [];
      for (const c of rawClips) {
        let s = parseTime((c as any).startTime);
        let e = parseTime((c as any).endTime);
        if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue;
        if (videoDuration > 0) {
          if (s >= videoDuration) continue;
          if (e > videoDuration) e = videoDuration;
        }
        if (videoDuration > 0 && e === videoDuration) e = Math.max(s + 0.1, videoDuration - 0.05);
        // Accept directly; do not enforce artificial min/max when AI-driven.
        if (e > s) normalized.push({ startTime: s, endTime: e, priority: (c as any).priority, reason: (c as any).reason });
      }
      normalized.sort((a, b) => a.startTime - b.startTime);
      finalClips = normalized;
    }

    for (const clip of finalClips) {
      let { startTime, endTime } = clip;

      // Simplified, comma-free 9:16 crop for 16:9 sources (centered):
      // w = trunc(ih*9/16/2)*2 (even), h = ih, x = (iw - w)/2, y = 0
      // This avoids commas in expressions which can confuse filter parsing.
      const cropFilter = `crop=trunc(ih*9/16/2)*2:ih:(iw - trunc(ih*9/16/2)*2)/2:0`;
      const tmpOut = path.join(os.tmpdir(), `clip-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);

      await new Promise((resolve, reject) => {
        ffmpeg(tmpInput)
          .inputOptions([
            '-analyzeduration', '2000000', // ~2s
            '-probesize', '50M'
          ])
          .setStartTime(startTime)
          .setDuration(endTime - startTime)
          .format('mp4')
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-map 0:v:0',
            '-map 0:a?', // include audio if present
            '-shortest',
            '-movflags +faststart',
            '-vf', `${cropFilter},format=yuv420p`,
            '-pix_fmt yuv420p',
            '-preset ultrafast',
            '-crf 23',
            '-max_muxing_queue_size 1024',
            '-avoid_negative_ts make_zero',
            '-vsync 2'
          ])
          .on('start', (cmd: string) => {
            console.log('[FFmpeg] start:', cmd);
          })
          .on('stderr', (line: string) => {
            if (line) console.log('[FFmpeg]', line);
          })
          .on('error', (err: any) => {
            console.error('[FFmpeg] error:', err?.message || err);
            reject(err);
          })
          .on('end', () => resolve(null))
          .save(tmpOut);
      });

      const outBuf = await fs.readFile(tmpOut);
      try {
        const upload = await stream.uploadVideoStream(outBuf, {
          name: `Clip: ${analysis.title || ''} - ${clip.priority || ''}`.trim(),
          meta: { source: 'gemini-auto-clip', originalVideoId: cfVideoId }
        });
        if (upload.success && upload.result) {
          const clipData = upload.result;
          const thumb = stream.getThumbnailUrl(clipData.uid);
          await executeQuery(
            `INSERT INTO videos (title, uid, url, poster_url, thumbnail, duration, status, type, is_public, publication_status, related_projects, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'published', 'clip', 1, 'live', ?, datetime('now'), datetime('now'))`,
            [
              `Clip: ${analysis.title || ''} - ${clip.priority || ''}`.trim(),
              clipData.uid,
              clipData.preview,
              thumb,
              thumb,
              endTime - startTime,
              JSON.stringify([`parent_id:${videoId}`, `style:vertical`])
            ]
          );
        } else {
          console.error('[Worker] Upload failed:', upload);
        }
      } finally {
        try { await fs.unlink(tmpOut); } catch {}
      }
    }

    await updateJobStatus(jobId, 'COMPLETED', null, videoId, cfVideoId);
  } catch (err: any) {
    console.error(`[Worker] Job ${jobId} failed:`, err);
    await updateJobStatus(jobId, 'FAILED', err?.message || String(err), videoId, cfVideoId);
  } finally {
    try { if (tmpInput && fsSync.existsSync(tmpInput)) await fs.unlink(tmpInput); } catch {}
    // Optional: cleanup Gemini file by URI if supported
  }
}
