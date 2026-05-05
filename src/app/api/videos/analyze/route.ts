import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import OpenAI from 'openai';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

const openai = DEEPSEEK_API_KEY ? new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
}) : null;

async function generateAIDescription(input: { title: string; description?: string; category?: string; mood?: string; tags?: string[]; }): Promise<string | null> {
  if (!DEEPSEEK_API_KEY || !openai) return null;
  try {
    const prompt = `Summarize this video for a public catalog in 2-3 sentences. Tone: concise, evocative, no clickbait. Include mood and style cues when helpful.\n\n` +
      `Title: ${input.title}\n` +
      (input.description ? `Existing description: ${input.description}\n` : '') +
      (input.category ? `Category: ${input.category}\n` : '') +
      (input.mood ? `Mood: ${input.mood}\n` : '') +
      (input.tags && input.tags.length ? `Tags: ${input.tags.join(', ')}\n` : '');

    const response = await openai.chat.completions.create({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 256,
      stream: false,
    });

    const text = response.choices[0]?.message?.content || '';
    const clean = text.replace(/^\s+|\s+$/g, '').replace(/\n+/g, ' ');
    return clean || null;
  } catch (e) {
    console.warn('AI description error:', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });

  try {
    const body = (await req.json()) as { id?: number; uid?: string; force?: boolean };
    const id = Number(body.id) || null;
    const uid = (body.uid || '').toString() || null;
    const force = !!body.force;

    if (!id && !uid) return NextResponse.json({ error: 'id or uid required' }, { status: 400 });

    const where = id ? 'id = ?' : 'uid = ?';
    const arg = id ? id : uid;
    const rows = await queryDatabase(`SELECT id, uid, title, description, short_description, long_description, ai_description, category, mood, tags FROM videos WHERE ${where} LIMIT 1`, [arg]);
    if (!rows.length) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    const v = rows[0];

    // Parse tags
    let tags: string[] = [];
    try { tags = Array.isArray(v.tags) ? v.tags : JSON.parse(String(v.tags || '[]')); } catch {}

    // If ai_description exists and not forced, return it
    if (!force && v.ai_description) {
      return NextResponse.json({ success: true, ai_description: v.ai_description, cached: true });
    }

    const ai = await generateAIDescription({
      title: v.title || v.uid || 'Untitled',
      description: v.long_description || v.short_description || v.description || '',
      category: v.category || '',
      mood: v.mood || '',
      tags,
    });

    if (ai) {
      await executeQuery(`INSERT INTO videos_analysis(uid, mood, genre, themes_json, provider, model, diagnostics_json) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        v.uid,
        v.mood || null,
        null,
        JSON.stringify(tags || []),
        'deepseek',
        'deepseek-v4-flash',
        null,
      ]);
      await executeQuery(`UPDATE videos SET ai_description = ? WHERE id = ?`, [ai, v.id]);
      try { await writeAuditLog(req, user, 'videos.analyze', String(v.id), { uid: v.uid }); } catch {}
      return NextResponse.json({ success: true, ai_description: ai, cached: false });
    }

    return NextResponse.json({ success: true, ai_description: null, cached: false });
  } catch (error) {
    console.error('analyze video error:', error);
    return NextResponse.json({ error: 'Failed to analyze video' }, { status: 500 });
  }
}
