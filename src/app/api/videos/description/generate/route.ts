import { NextRequest, NextResponse } from 'next/server';
import { callGeminiMultimodal, GeminiPart } from '@/lib/gemini';
import { callDeepSeekWithRetry } from '@/lib/deepseek';
import { queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    console.log(`[AI Desc] Fetching image: ${url}`);
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Odubo-Studio/1.0',
        'Accept': 'image/jpeg,image/png,image/*'
      }
    });
    if (!res.ok) {
      console.error(`[AI Desc] Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      return null;
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) {
      console.error(`[AI Desc] Empty buffer for ${url}`);
      return null;
    }
    return Buffer.from(buffer).toString('base64');
  } catch (e) {
    console.error(`[AI Desc] Exception fetching ${url}:`, e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: any = await request.json();
    let { title, category, mood, type, existingDescription, videoId, uid } = body;

    if (!title && !videoId) {
      return NextResponse.json({ error: 'Title or Video ID is required' }, { status: 400 });
    }

    let videoUid = uid;
    let videoTitle = title;
    let videoCategory = category;
    let videoMood = mood;
    let videoType = type;
    let transcriptText = '';
    let frames: string[] = [];
    let visualsSkipped = false;

    // If we have a video ID, fetch rich context
    if (videoId || uid) {
      const identifier = videoId ? 'id' : 'uid';
      const value = videoId || uid;
      
      const vRows = await queryDatabase(
        `SELECT id, uid, title, category, mood, type, duration, poster_url, url FROM videos WHERE ${identifier} = ? LIMIT 1`,
        [value]
      );
      
      if (vRows.length > 0) {
        const v = vRows[0];
        videoUid = v.uid;

        // Fallback: Extract UID from URL or Poster URL if missing
        if (!videoUid) {
          const uidMatch = (v.url || '').match(/([a-f0-9]{32})/);
          if (uidMatch) videoUid = uidMatch[1];
          else {
             const posterMatch = (v.poster_url || '').match(/([a-f0-9]{32})/);
             if (posterMatch) videoUid = posterMatch[1];
          }
          if (videoUid) console.log(`[AI Desc] Extracted UID ${videoUid} from video URL/Poster`);
        }

        videoTitle = videoTitle || v.title;
        videoCategory = videoCategory || v.category;
        videoMood = videoMood || v.mood;
        videoType = videoType || v.type;

        // 1. Fetch Transcript/Lyrics and Analysis Context
        if (videoUid) {
          const aRows = await queryDatabase(
            'SELECT transcript_json, themes_json, mood, genre FROM videos_analysis WHERE uid = ? ORDER BY created_at DESC LIMIT 1',
            [videoUid]
          );
          if (aRows.length > 0) {
            const analysis = aRows[0];
            
            // Prefer analysis metadata if available
            if (analysis.mood) videoMood = analysis.mood;
            if (analysis.genre) videoCategory = analysis.genre; // Use genre as category/style context

            // Parse Transcript
            if (analysis.transcript_json) {
              try {
                const t = JSON.parse(analysis.transcript_json);
                if (Array.isArray(t.results)) {
                   transcriptText = t.results.map((r: any) => r.text).join(' ');
                } else if (t.text) {
                   transcriptText = t.text;
                }
              } catch (e) {
                console.warn('Failed to parse transcript', e);
              }
            }

            // Parse Themes
            if (analysis.themes_json) {
              try {
                const themes = JSON.parse(analysis.themes_json);
                if (Array.isArray(themes) && themes.length > 0) {
                  existingDescription = (existingDescription ? existingDescription + '\n' : '') + `Identified Themes: ${themes.join(', ')}`;
                }
              } catch (e) {
                console.warn('Failed to parse themes', e);
              }
            }
          }

          // 2. Fetch Frames (Visual Context)
          const duration = parseFloat(v.duration || '0');
          const timestamps = duration > 0 
            ? [duration * 0.2, duration * 0.5, duration * 0.8] 
            : [0, 5, 10]; // Fallback if duration unknown

          // Try to construct a valid thumbnail URL base
          // Use videodelivery.net which is the standard public CDN for Stream
          let thumbBase = `https://videodelivery.net/${videoUid}/thumbnails/thumbnail.jpg`;
          
          // Fetch 3 frames
          const framePromises = timestamps.map(async (t) => {
            const url = `${thumbBase}?time=${t}s&height=480`;
            const b64 = await fetchImageAsBase64(url);
            if (!b64) console.warn(`[AI Desc] Failed to fetch frame at ${t}s: ${url}`);
            return b64;
          });
          
          // Also fetch current poster if available
          if (v.poster_url) {
            framePromises.push(fetchImageAsBase64(v.poster_url));
          }

          const results = await Promise.all(framePromises);
          frames = results.filter(Boolean) as string[];
          
          if (frames.length === 0) {
            console.warn('[AI Desc] No frames could be fetched. Video might be private or processing.');
            visualsSkipped = true;
          } else {
            console.log(`[AI Desc] Successfully fetched ${frames.length} frames for analysis.`);
          }
        }
      }
    }

    // Construct Prompt
    let promptText = `
      Analyze the provided video frames and metadata to write a descriptive summary of the video and its content.
      
      Video Details:
      - Title: "${videoTitle}"
      - Type: ${videoType || 'Video'}
      - Category: ${videoCategory || 'General'}
      - Mood: ${videoMood || 'Neutral'}
      ${existingDescription ? `- Context/Notes: ${existingDescription}` : ''}
    `;

    if (transcriptText) {
      promptText += `\n\nTranscript/Lyrics Excerpt:\n"${transcriptText.slice(0, 1000)}..."\n`;
    }

    promptText += `
      Guidelines:
      - ROLE: Act as a definitive voice in music and video curation. Present this video with authority.
      - LYRICAL & THEMATIC DEPTH: Use the provided transcript/lyrics to explain the song's core message. Do not just describe visuals; explain what the song *says*.
      - AUDIO INFERENCE: Based on the lyrics (e.g. rhythm, slang, emotion) and visual energy (e.g. fast cuts, dark lighting), vividly describe the musical style and sonic atmosphere (e.g. "thumping bass-heavy trap," "ethereal acoustic ballad").
      - VISUAL SYNERGY: Describe how the visual aesthetics reinforce the song's themes.
      - Style: Confident, insightful, and professional. Avoid passive voice.
      - Length: 3-4 sentences.
      - Output: Return ONLY the final description text.
    `;

    let generatedText = '';

    if (frames.length > 0) {
      // Multimodal Request
      const parts: GeminiPart[] = [
        { text: promptText },
        ...frames.map(data => ({
          inlineData: {
            mimeType: 'image/jpeg',
            data
          }
        }))
      ];
      const { data } = await callGeminiMultimodal(parts);
      generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      // Text-only Request - Fallback to DeepSeek
      console.warn('[AI Desc] Falling back to text-only generation due to missing frames.');
      promptText += `\n\n(Note: Visual frames were unavailable. Base the description on the title and metadata provided.)`;
      const { data } = await callDeepSeekWithRetry(promptText);
      generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (!generatedText) {
      throw new Error('No content generated');
    }

    return NextResponse.json({ description: generatedText.trim(), visualsSkipped });
  } catch (error: any) {
    console.error('Description generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate description' },
      { status: 500 }
    );
  }
}
