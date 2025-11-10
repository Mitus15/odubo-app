import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import sharp from 'sharp';
import { rateLimit } from '@/lib/rateLimit';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Sample a richer set of frames for artistic + narrative analysis
async function sampleFrames(uid: string, durationSec: number): Promise<{ pct: number; url: string; buffer?: Buffer }[]> {
  const stream = new CloudflareStreamAPI();
  const pcts: number[] = [];
  // Use beats: opening, inciting (~10%), rising (~25-35%), midpoint (~50%), climax (~75-85%), closing (~95%) + aesthetic spread
  [0.02,0.10,0.18,0.27,0.35,0.50,0.62,0.75,0.83,0.90,0.96].forEach(p => pcts.push(p));
  const unique = Array.from(new Set(pcts));
  const frames: { pct: number; url: string; buffer?: Buffer }[] = [];
  for (const pct of unique) {
    const t = Math.max(0, Math.min(durationSec - 0.2, pct * durationSec));
    const url = stream.getThumbnailUrl(uid, { time: `${Math.round(t)}s`, width: 640 });
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      frames.push({ pct, url, buffer: buf });
    } catch {}
  }
  return frames;
}

async function describeFramesWithGemini(frames: { pct: number; url: string; buffer?: Buffer }[], context: { title: string; existing?: string; mood?: string; category?: string }) {
  if (!GEMINI_API_KEY || frames.length === 0) return null;
  const parts: any[] = [];
  parts.push({ text: [
    'Analyse these video frames as an expert film editor + narrative analyst.',
    'For each frame consider: composition, color palette, lighting style, subject(s), emotional tone, setting, implied action, symbolism.',
    'Infer overarching themes, mood progression, potential narrative arc, genre indicators, stylistic traits (e.g. saturated neon, desaturated grit, natural warm, high contrast chiaroscuro).',
    'Return STRICT JSON:\n{',
    '  "frames": [{"index": i, "pct": number, "subjects": ["..."], "emotion": "...", "composition_notes": "..."}],',
    '  "style_palette": "short description of recurring visual style",',
    '  "themes": ["up to 8 thematic tags"],',
    '  "mood_curve": [ {"pct": number, "mood": "word"} ],',
    '  "summary": "3-4 sentence evocative paragraph integrating character, setting, tone",',
    '  "seo_description": "1 crisp sentence for catalog",',
    '  "tags": ["up to 12 discovery tags (kebab-case)"],',
    '  "shots_signature": "comma-separated micro stylistic identifiers"',
    '}',
    `Context: title=${context.title}; existing=${context.existing || ''}; mood=${context.mood || ''}; category=${context.category || ''}`,
  ].join('\n') });

  for (const f of frames.slice(0, 8)) { // limit images for token efficiency
    if (!f.buffer) continue;
    const resized = await sharp(f.buffer).resize({ width: 512 }).jpeg({ quality: 72 }).toBuffer();
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: resized.toString('base64') } });
  }

  const model = 'gemini-1.5-flash-8b';
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts }] }) });
  const data: any = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
  try {
    const body = (await req.json()) as { id?: number; uid?: string; force?: boolean };
    const id = Number(body.id) || null;
    const uidInput = (body.uid || '').toString() || null;
    const force = !!body.force;
    if (!id && !uidInput) return NextResponse.json({ error: 'id or uid required' }, { status: 400 });

    const where = id ? 'id = ?' : 'uid = ?';
    const arg = id ? id : uidInput;
    const rows = await queryDatabase(`SELECT id, uid, title, description, short_description, long_description, ai_description, category, mood, tags, duration_seconds FROM videos WHERE ${where} LIMIT 1`, [arg]);
    if (!rows.length) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    const v = rows[0];

    // If we already have an ai_description and not forcing, we can still enrich with analysis without overwriting summary
    const existingText = v.long_description || v.short_description || v.description || '';

    // Get video duration (seconds) from column or fallback via Stream lookup
    let durationSec = Number(v.duration_seconds || 0);
    if (!durationSec || !Number.isFinite(durationSec)) {
      try {
        const stream = new CloudflareStreamAPI();
        const details = await stream.getVideo(v.uid);
        durationSec = Number(details?.result?.duration || 0);
      } catch {}
    }

    // Rate limit per user/email + video
    const rlKey = `deep-analyze:${user?.email || 'anon'}:${v.uid}`;
    const rl = await rateLimit({ key: rlKey, limit: 5, windowMs: 60 * 60 * 1000 }); // 5/hour
    if (!rl.allowed && !force) {
      return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.resetAt }, { status: 429 });
    }

    const frames = await sampleFrames(v.uid, durationSec || 0);
    const analysis = await describeFramesWithGemini(frames, {
      title: v.title || v.uid || 'Untitled',
      existing: existingText,
      mood: v.mood || '',
      category: v.category || ''
    });

    if (analysis) {
      // Persist enriched analysis; don’t duplicate tags count, merge with existing tags
      let existingTags: string[] = [];
      try { existingTags = Array.isArray(v.tags) ? v.tags : JSON.parse(String(v.tags || '[]')); } catch {}
      let newTags: string[] = Array.isArray(analysis.tags) ? analysis.tags : [];
      const mergedTags = Array.from(new Set([...existingTags, ...newTags])).slice(0, 20);

      const aiDescriptionFinal = force || !v.ai_description ? (analysis.summary || v.ai_description || null) : v.ai_description;

      await executeQuery(`UPDATE videos SET ai_description = ?, short_description = COALESCE(short_description, ?), long_description = long_description, tags = ? WHERE id = ?`, [
        aiDescriptionFinal,
        analysis.seo_description || aiDescriptionFinal,
        JSON.stringify(mergedTags),
        v.id,
      ]);

      await executeQuery(`INSERT INTO videos_analysis(uid, transcript_json, chorus_timestamps_json, mood, genre, themes_json, provider, model, diagnostics_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        v.uid,
        null,
        null,
        v.mood || null,
        null,
        JSON.stringify(analysis.themes || []),
        'google',
        'gemini-1.5-flash-8b',
        JSON.stringify({ style_palette: analysis.style_palette, shots_signature: analysis.shots_signature })
      ]);

      return NextResponse.json({ success: true, analysis, updated: true });
    }

    return NextResponse.json({ success: true, analysis: null, updated: false });
  } catch (error) {
    console.error('deep analyze video error:', error);
    return NextResponse.json({ error: 'Failed to deep analyze video' }, { status: 500 });
  }
}
