import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { uploadFileToGemini, callGeminiWithFile } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  let downloadEnabled = false;
  let targetUid = '';
  const stream = new CloudflareStreamAPI();

  try {
    // 1. Get Video UID
    const rows = await queryDatabase('SELECT id, uid, title, url, poster_url FROM videos WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    let { uid, title, url, poster_url } = rows[0];

    // Fallback: Extract UID if missing
    if (!uid) {
      const uidMatch = (url || '').match(/([a-f0-9]{32})/);
      if (uidMatch) uid = uidMatch[1];
      else {
          const posterMatch = (poster_url || '').match(/([a-f0-9]{32})/);
          if (posterMatch) uid = posterMatch[1];
      }
      
      if (uid) {
        console.log(`[Transcript] Extracted UID ${uid} from URL/Poster. Updating DB...`);
        await executeQuery('UPDATE videos SET uid = ? WHERE id = ?', [uid, id]);
      }
    }

    targetUid = uid;

    if (!uid) return NextResponse.json({ error: 'Video has no UID' }, { status: 400 });

    // 2. Enable Downloads
    console.log(`[Transcript] Enabling downloads for ${uid}...`);
    await stream.enableDownloads(uid);
    downloadEnabled = true;

    // 3. Poll for Download URL
    let downloadUrl: string | null = null;
    for (let i = 0; i < 10; i++) {
      downloadUrl = await stream.getDownloadUrl(uid);
      if (downloadUrl) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!downloadUrl) {
      throw new Error('Timed out waiting for download URL');
    }

    console.log(`[Transcript] Downloading video from ${downloadUrl}...`);
    
    // 4. Download Video
    const vidRes = await fetch(downloadUrl);
    if (!vidRes.ok) throw new Error(`Failed to download video: ${vidRes.status}`);
    const arrayBuffer = await vidRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 200 * 1024 * 1024) { // 200MB limit safety
      throw new Error('Video too large for inline processing (>200MB)');
    }

    // 5. Upload to Gemini
    console.log(`[Transcript] Uploading ${buffer.length} bytes to Gemini...`);
    const fileUri = await uploadFileToGemini(buffer, 'video/mp4', `video-${uid}`);
    console.log(`[Transcript] File uploaded: ${fileUri}`);

    // 6. Generate Transcript
    const prompt = `
      Listen to the audio in this video and provide a structured transcript.
      
      Return ONLY a valid JSON object with this structure:
      {
        "text": "Full transcript text with speaker labels if applicable.",
        "results": [
          { "time": "00:00", "text": "Line of text..." }
        ],
        "language": "en",
        "topics": ["topic1", "topic2"]
      }
      
      If there are lyrics, format them as lines. Capture the mood and style in the text if possible (e.g. [Upbeat music plays]).
    `;

    const result = await callGeminiWithFile(prompt, fileUri, 'video/mp4');
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) throw new Error('No transcript generated');

    // Parse JSON
    let transcriptJson = generatedText.replace(/```json\s*|\s*```/g, '').trim();
    // Try to extract JSON if wrapped in text
    const jsonMatch = transcriptJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) transcriptJson = jsonMatch[0];

    try {
      JSON.parse(transcriptJson); // Validate
    } catch (e) {
      console.warn('Invalid JSON from Gemini, saving as raw text wrapper');
      transcriptJson = JSON.stringify({ text: generatedText });
    }

    // 7. Save to DB (Merge with latest analysis to preserve context)
    const latestRows = await queryDatabase(
      'SELECT * FROM videos_analysis WHERE uid = ? ORDER BY created_at DESC LIMIT 1',
      [uid]
    );
    
    let newMood = null;
    let newGenre = null;
    let newThemes = null;
    let newDiagnostics = null;
    let newProvider = 'google';
    let newModel = 'gemini-2.5-flash';

    if (latestRows.length > 0) {
      const latest = latestRows[0];
      newMood = latest.mood;
      newGenre = latest.genre;
      newThemes = latest.themes_json;
      newDiagnostics = latest.diagnostics_json;
      // Keep provider/model if we are just appending transcript? No, this is a new analysis event.
    }

    await executeQuery(
      `INSERT INTO videos_analysis(uid, transcript_json, mood, genre, themes_json, diagnostics_json, provider, model) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid, transcriptJson, newMood, newGenre, newThemes, newDiagnostics, newProvider, newModel]
    );

    return NextResponse.json({ success: true, transcript: JSON.parse(transcriptJson) });

  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: error.message || 'Failed to transcribe' }, { status: 500 });
  } finally {
    // 8. Cleanup: Disable downloads
    if (downloadEnabled && targetUid) {
      try {
        await stream.disableDownloads(targetUid);
        console.log('[Transcript] Downloads disabled.');
      } catch (e) {
        console.error('Failed to disable downloads:', e);
      }
    }
  }
}
