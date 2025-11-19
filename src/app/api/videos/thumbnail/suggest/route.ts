import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import sharp from 'sharp';
import { writeAuditLog } from '@/lib/audit';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type FrameScore = {
  pct: number;
  url: string;
  brightness: number;
  contrast: number;
  entropy: number;
  clarity: number; // Laplacian variance normalized
  score: number;
  buffer?: Buffer;
};

async function fetchFrame(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function analyzeBuffer(buf: Buffer): Promise<{ brightness: number; contrast: number; entropy: number }> {
  const img = sharp(buf).resize({ width: 640, withoutEnlargement: true });
  const stats = await img.stats();
  // Approximate brightness from mean of RGB
  const means = stats.channels.slice(0, 3).map(c => c.mean);
  const stdevs = stats.channels.slice(0, 3).map(c => c.stdev);
  const brightness = means.reduce((a, b) => a + b, 0) / (3 * 255);
  const contrast = stdevs.reduce((a, b) => a + b, 0) / (3 * 255);
  const entropy = stats.entropy;
  return { brightness, contrast, entropy };
}

async function laplacianClarity(buf: Buffer): Promise<number> {
  // Compute variance of Laplacian (edge strength) as a blur measure
  const { data, info } = await sharp(buf)
    .greyscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Variance of pixel intensities
  const n = data.length;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i];
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  // Normalize roughly by 255^2
  const norm = variance / (255 * 255);
  // Clamp to [0,1]
  return Math.max(0, Math.min(1, norm * 4)); // scale up a bit
}

function scoreFrame(f: { brightness: number; contrast: number; entropy: number; clarity: number }): number {
  // Penalize too dark or too bright
  const brightnessPenalty = Math.abs(f.brightness - 0.55) * 0.8; // prefer mid brightness
  const base = 0.45 * f.entropy + 0.35 * f.contrast + 0.5 * f.clarity - brightnessPenalty;
  return base;
}

async function geminiRank(candidates: FrameScore[], context: { title?: string; category?: string; mood?: string }) {
  if (!GEMINI_API_KEY) return { ordered: candidates.map((_, i) => i), rationale: 'ai:skipped' };
  try {
    const parts: any[] = [
      { text: [
        'You are an expert creative director and cinematographer choosing the best thumbnail frame.',
        'Evaluate EACH image by:',
        '- Composition (rule of thirds, leading lines, framing, depth, balance)',
        '- Subject clarity (faces/subjects readable, minimal motion blur unless artistic)',
        '- Color harmony and palette (contrast, mood alignment, skin tones)',
        '- Mise-en-scène (props, wardrobe, setting, lighting that convey story and brand)',
        '- Emotional impact and story beat (intrigue, climax, iconic moment)',
        '- Avoid text overlays, random UI elements, or awkward mid-blinks if possible',
        '',
        `Context: title=${context.title || ''}, category=${context.category || ''}, mood=${context.mood || ''}.`,
        'Return STRICT JSON with shape:\n{',
        '  "order": [0-based indexes best..worst],',
        '  "scores": [{"i": index, "composition": 0..1, "clarity": 0..1, "color": 0..1, "emotion": 0..1}],',
        '  "rationale": "one-paragraph rationale summarizing choice"',
        '}',
      ].join('\n') }
    ];

    for (const c of candidates) {
      const b = c.buffer!;
      const resized = await sharp(b).resize({ width: 320 }).jpeg({ quality: 70 }).toBuffer();
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: resized.toString('base64') } });
    }

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
    });
    const data = (await resp.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : {};
    const order = Array.isArray(parsed.order) ? parsed.order.filter((i: number) => Number.isInteger(i)) : candidates.map((_, i: number) => i);
    const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : 'ai:ok';
    const scores = Array.isArray(parsed.scores) ? parsed.scores : [];
    return { ordered: order, rationale, scores } as any;
  } catch (e) {
    console.warn('Gemini ranking failed:', e);
    return { ordered: candidates.map((_, i) => i), rationale: 'ai:error' };
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });

  try {
    const body = (await req.json()) as { sessionId: number } as any;
    const sessionId = Number(body.sessionId);
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const sessions = await queryDatabase('SELECT id, uid, meta_json FROM video_upload_sessions WHERE id = ? LIMIT 1', [sessionId]);
    if (!sessions.length) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const session = sessions[0];
    const meta = (() => { try { return JSON.parse(session.meta_json || '{}'); } catch { return {}; } })();

    await executeQuery(`UPDATE video_upload_sessions SET status = 'analyzing', updated_at = datetime('now') WHERE id = ?`, [sessionId]);

    const stream = new CloudflareStreamAPI();
    const details = await stream.getVideo(session.uid);
    const durationSec = Math.max(0, Number(details?.result?.duration || 0));

    const basePcts: number[] = [];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const p = 0.1 + (0.8 * i) / (N - 1);
      basePcts.push(Number(p.toFixed(4)));
    }
    [0.25, 0.5, 0.75].forEach(p => basePcts.push(p));
    const pcts = Array.from(new Set(basePcts)).slice(0, 16);

    const frames: FrameScore[] = [];
    for (const pct of pcts) {
      const t = durationSec > 0 ? Math.max(0, Math.min(durationSec - 0.1, pct * durationSec)) : Math.floor(pct * 120);
      const url = stream.getThumbnailUrl(session.uid, { time: `${Math.round(t)}s`, width: 640 });
      const buf = await fetchFrame(url);
      if (!buf) continue;
      const { brightness, contrast, entropy } = await analyzeBuffer(buf);
      const clarity = await laplacianClarity(buf);
      const score = scoreFrame({ brightness, contrast, entropy, clarity });
      frames.push({ pct, url, brightness, contrast, entropy, clarity, score, buffer: buf });
    }

    frames.sort((a, b) => b.score - a.score);
    const top = frames.slice(0, 6);

  const { ordered, rationale, scores } = await geminiRank(top, { title: meta.title, category: meta.category, mood: meta.mood }) as any;

    const ranked = ordered
      .map((i: number) => top[i])
      .filter(Boolean)
      .slice(0, 3)
      .map((f: FrameScore, idx: number) => ({ ...f, finalRank: idx + 1 }));

    for (const r of ranked) {
      const scoreObj = Array.isArray(scores) ? scores.find((s: any) => Number(s?.i) === top.indexOf(r)) : null;
      const aiScore = typeof scoreObj?.composition === 'number' && typeof scoreObj?.clarity === 'number' && typeof scoreObj?.color === 'number' && typeof scoreObj?.emotion === 'number'
        ? (0.35 * scoreObj.composition + 0.25 * scoreObj.clarity + 0.2 * scoreObj.color + 0.2 * scoreObj.emotion)
        : r.score; // fallback to heuristic
      await executeQuery(
        `INSERT INTO videos_thumbnail_candidates (session_id, uid, url, timestamp_s, pct, sharpness, exposure, face_score, ai_score, rank, rationale)
         VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          sessionId,
          session.uid,
          r.url,
          r.pct,
          r.clarity, // use clarity as sharpness proxy
          r.brightness,
          aiScore,
          r.finalRank,
          rationale,
        ]
      );
    }

    await executeQuery(`UPDATE video_upload_sessions SET status = 'awaiting_choice', updated_at = datetime('now') WHERE id = ?`, [sessionId]);

    try { await writeAuditLog(req, user, 'videos.thumbnail.suggest', String(sessionId), { candidates: ranked.length }); } catch {}
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('thumbnail suggest error:', error);
    return NextResponse.json({ error: 'Failed to suggest thumbnails' }, { status: 500 });
  }
}
