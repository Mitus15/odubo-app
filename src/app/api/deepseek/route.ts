import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';
import { callDeepSeekWithRetry, fetchVerseOfTheDay } from '@/lib/deepseek';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

let hasLoggedKeyDiag = false;

async function listModelsDiag() {
  try {
    const res = await fetch('https://api.deepseek.com/models', {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` }
    });
    if (!res.ok) return;
    const json: any = await res.json();
    const names = (json.data || []).map((m: any) => ({ id: m.id }));
    console.info('[DeepSeek] available models (sample):', names.slice(0, 10));
  } catch {}
}

interface RequestBody {
  action: string;
  date?: string;
  verse?: string;
  reference?: string;
  question?: string;
  timestamp?: string;
  requestId?: string;
  excludeRefs?: string[];
}

export async function POST(request: NextRequest) {
  // One-time diagnostics about key presence (masked)
  if (!hasLoggedKeyDiag) {
    console.info('[DeepSeek] key configured', {
      present: !!DEEPSEEK_API_KEY,
      length: DEEPSEEK_API_KEY?.length || 0,
      preview: DEEPSEEK_API_KEY ? `${DEEPSEEK_API_KEY.slice(0, 4)}...${DEEPSEEK_API_KEY.slice(-2)}` : 'none'
    });
    hasLoggedKeyDiag = true;
  }

  let parsedBody: any = null;

  try {
    // Be tolerant of empty bodies
    try {
      parsedBody = await request.json();
    } catch {
      parsedBody = {};
    }
    const body = parsedBody as RequestBody;
    const { action, date, verse, reference, question, timestamp, requestId, excludeRefs = [] } = body;

    let prompt = '';

    switch (action) {
      case 'getVerse':
        const result = await fetchVerseOfTheDay(timestamp, requestId, excludeRefs);
        return NextResponse.json(result, {
          headers: {
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600',
            'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
            'Vary': 'Accept-Encoding'
          }
        });
      case 'explainVerse':
        if (!verse || !reference) return NextResponse.json({ error: 'Missing verse or reference' }, { status: 400 });
        prompt = `Please provide a thoughtful explanation of this Bible verse:\n\n"${verse}" - ${reference}\n\nInclude:\n1. Historical context\n2. Meaning and interpretation\n3. How it applies to modern life\n\nKeep the explanation accessible and encouraging, around 2-3 sentences.`;
        break;
      case 'askQuestion':
        if (!verse || !reference || !question) return NextResponse.json({ error: 'Missing verse/reference/question' }, { status: 400 });
        prompt = `Based on this Bible verse: "${verse}" - ${reference}\n\nPlease answer this question: ${question}\n\nProvide a thoughtful, biblically-grounded response that's encouraging and practical.`;
        break;
      case 'classifyProduct':
        prompt = `Classify this product into one of two categories: "clothes" or "items".\n\nProduct title: ${verse || ''}\nProduct type: ${reference || ''}\nTags: ${question || ''}\n\nRules:\n- clothes: apparel such as t-shirt, tee, shirt, hoodie, sweatshirt, sweater, jacket, coat, pant, trouser, jean, short, hat, beanie, cap, sock, shoe, sneaker, dress, skirt.\n- items: accessories, tech, art prints, stickers, mugs, sleeves, laptop/phone accessories, posters, merch items that are not worn as apparel.\n- If ambiguous, choose "items" unless it's clearly wearable apparel.\n\nRespond ONLY with a strict JSON object: {"category":"clothes"} or {"category":"items"}`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // If no API key, return error
    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'DeepSeek API key not configured' }, { status: 500 });
    }

    // Call DeepSeek with retry
    const { data, simplified } = await callDeepSeekWithRetry(prompt);
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error('No content generated from DeepSeek');

    // Non-verse responses
    return NextResponse.json({ response: generatedText, simplified }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('DeepSeek API error:', error);
    // Fire-and-forget diag to log available models once
    listModelsDiag();
    return NextResponse.json({ error: 'Failed to get response from DeepSeek' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}