import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { executeQuery, queryDatabase } from '@/lib/db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-8b';

// Build prioritized list of endpoint URLs to try
const MODEL_CANDIDATES = [
  GEMINI_MODEL,
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash-002',
  'gemini-1.5-pro-002',
  'gemini-2.0-flash',
];

const GEMINI_API_URLS = MODEL_CANDIDATES.flatMap(m => [
  `https://generativelanguage.googleapis.com/v1/models/${m}:generateContent`,
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
]);

const TIMEOUT_MS = 6000; // 6s primary attempt
const SECOND_ATTEMPT_TIMEOUT_MS = 8000; // fallback slightly longer

let hasLoggedKeyDiag = false;

async function listModelsDiag() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    if (!res.ok) return;
    const json: any = await res.json();
    const names = (json.models || []).map((m: any) => ({ name: m.name, methods: m.supportedGenerationMethods }));
    console.info('[Gemini] available models (sample):', names.slice(0, 10));
  } catch {}
}

// High-impact reliability helpers
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function buildBody(prompt: string, simplified = false) {
  const base: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: simplified
      ? {
          temperature: 0.7,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 160,
        }
      : {
          temperature: 0.8,
          topK: 64,
          topP: 0.9,
          maxOutputTokens: 256,
        },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
    ]
  };
  return JSON.stringify(base);
}

async function callGeminiWithRetry(prompt: string) {
  const attempts: Array<{ simplified: boolean; timeout: number }> = [
    { simplified: false, timeout: TIMEOUT_MS },
    { simplified: true, timeout: SECOND_ATTEMPT_TIMEOUT_MS },
  ];
  let lastErr: any = null;
  for (let i = 0; i < attempts.length; i++) {
    const { simplified, timeout } = attempts[i];
    for (const url of GEMINI_API_URLS) {
      try {
        const started = Date.now();
        const res = await fetchWithTimeout(`${url}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: buildBody(prompt, simplified)
        }, timeout);
        const duration = Date.now() - started;
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error('[Gemini] upstream error', {
            status: res.status,
            simplified,
            durationMs: duration,
            url,
            bodySnippet: body.slice(0, 300)
          });
          lastErr = new Error(`Upstream ${res.status}`);
          // Try next URL or attempt
          continue;
        }
        const data = await res.json() as any;
        return { data, simplified };
      } catch (e: any) {
        if (e.name === 'AbortError') {
          console.error('[Gemini] timeout', { attempt: i + 1, simplified });
        } else {
          console.error('[Gemini] fetch error', { attempt: i + 1, simplified, message: e?.message });
        }
        lastErr = e;
        // Try next URL
      }
    }
  }
  throw lastErr || new Error('Gemini fetch failed');
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

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export async function POST(request: NextRequest) {
  // One-time diagnostics about key presence (masked)
  if (!hasLoggedKeyDiag) {
    console.info('[Gemini] key configured', {
      present: !!GEMINI_API_KEY,
      length: GEMINI_API_KEY?.length || 0,
      preview: GEMINI_API_KEY ? `${GEMINI_API_KEY.slice(0, 4)}...${GEMINI_API_KEY.slice(-2)}` : 'none'
    });
    hasLoggedKeyDiag = true;
  }

  let isVerseRequest = false;
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
        isVerseRequest = true;
        try {
          await executeQuery(`CREATE TABLE IF NOT EXISTS gemini_cache (cache_key TEXT PRIMARY KEY, cache_value TEXT, timestamp INTEGER)`);
          const tz = process.env.GEMINI_CACHE_TZ || 'UTC';
          const now = new Date();
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
          const dateKey = `verse_${parts}`;
          const rows = await queryDatabase(`SELECT cache_value FROM gemini_cache WHERE cache_key = ? LIMIT 1`, [dateKey]);
          if (rows && rows.length > 0) {
            try {
              const cached = JSON.parse((rows[0] as any).cache_value);
              return NextResponse.json(cached, { headers: {
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
                'CDN-Cache-Control': 'public, max-age=86400',
                'Vary': 'Accept-Encoding'
              }});
            } catch {}
          }
        } catch (e) {
          console.warn('[Gemini] cache read error', e);
        }
        // Build prompt (reuse existing content)
        const timestampSeed = parseInt(timestamp || '0') % 31;
        const requestSeed = requestId ? requestId.charCodeAt(0) % 31 : 0;
        const combinedSeed = (timestampSeed + requestSeed) % 31;
        const chapters = Array.from({ length: 31 }, (_, i) => i + 1);
        const suggestedChapter = chapters[combinedSeed];
        const bannedList = excludeRefs.length > 0 ? `\n- STRICTLY AVOID these references: ${excludeRefs.join(', ')}` : '';
        prompt = `You are a biblical scholar providing fresh, inspiring Bible verses. Generate a Bible verse from the book of Proverbs that would be meaningful for reflection and encouragement.\n\nRequirements:\n- The verse MUST be from the book of Proverbs.\n- Use accurate verse text from NIV, ESV, or NASB translation.\n- Consider selecting from Proverbs chapter ${suggestedChapter} but you may choose any chapter.\n- AVOID these commonly used verses: Proverbs 3:5-6, Proverbs 15:1, Proverbs 1:7\n${bannedList}\n- Select a verse that offers wisdom, encouragement, or practical life guidance.\n- Make it suitable for personal meditation and growth.\n- Prioritize lesser-known but meaningful verses.\n\nRequest ID: ${requestId}\nTimestamp: ${timestamp}\nSuggested focus: Chapter ${suggestedChapter}\n\nCRITICAL: Respond with ONLY a valid JSON object. No other text:\n\n{"text": "The complete verse text", "reference": "Proverbs Chapter:Verse"}`;
        break;
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

    // If no API key, serve cache/static for verse; error for non-verse
    if (!GEMINI_API_KEY) {
      if (isVerseRequest) {
        try {
          const last = await queryDatabase(`SELECT cache_value FROM gemini_cache WHERE cache_key = ? LIMIT 1`, ['last_successful_verse']);
          if (last && last.length > 0) {
            const parsed = JSON.parse((last[0] as any).cache_value);
            return NextResponse.json({ ...parsed, note: 'Served last successful verse (no API key)' }, { headers: { 'Cache-Control': 'no-store' } });
          }
        } catch {}
        return NextResponse.json({ text: 'Trust in the Lord with all your heart and lean not on your own understanding.', reference: 'Proverbs 3:5', note: 'Fallback verse (no API key)' }, { headers: { 'Cache-Control': 'no-store' } });
      }
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // Call Gemini with retry
    const { data, simplified } = await callGeminiWithRetry(prompt);
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error('No content generated from Gemini');

    // Parsing & caching (only adjust verse path)
    if (isVerseRequest) {
      try {
        let cleanedText = generatedText.trim();
        cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/g, '');
        // Try strict JSON first
        let jsonStr: string | null = null;
        try {
          JSON.parse(cleanedText);
          jsonStr = cleanedText;
        } catch {
          const strictMatch = cleanedText.match(/\{[^]*?\}/);
          if (strictMatch) jsonStr = strictMatch[0];
        }
        if (!jsonStr) throw new Error('No JSON object found');
        const verseData = JSON.parse(jsonStr);
        if (!verseData.text || !verseData.reference) throw new Error('Missing required fields');
        if (!String(verseData.reference).toLowerCase().includes('proverbs')) {
          return NextResponse.json({ text: verseData.text, reference: verseData.reference, note: 'Returned non-Proverbs verse' }, { headers: { 'Cache-Control': 'no-store' } });
        }
        // Upsert today + last_successful_verse
        try {
            const tz = process.env.GEMINI_CACHE_TZ || 'UTC';
            const now = new Date();
            const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
            const dateKey = `verse_${parts}`;
            const payload = JSON.stringify({ text: verseData.text, reference: verseData.reference, note: verseData.note || null, simplified });
            const ts = Date.now();
            await executeQuery(`CREATE TABLE IF NOT EXISTS gemini_cache (cache_key TEXT PRIMARY KEY, cache_value TEXT, timestamp INTEGER)`);
            await executeQuery(`INSERT INTO gemini_cache (cache_key, cache_value, timestamp) VALUES (?, ?, ?)
              ON CONFLICT(cache_key) DO UPDATE SET cache_value = ?, timestamp = ?`, [dateKey, payload, ts, payload, ts]);
            await executeQuery(`INSERT INTO gemini_cache (cache_key, cache_value, timestamp) VALUES (?, ?, ?)
              ON CONFLICT(cache_key) DO UPDATE SET cache_value = ?, timestamp = ?`, ['last_successful_verse', payload, ts, payload, ts]);
        } catch (cacheErr) {
          console.warn('[Gemini] cache write error', cacheErr);
        }
        return NextResponse.json(
          { ...verseData, simplified },
          { headers: {
              'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600',
              'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
              'Vary': 'Accept-Encoding'
            }
          }
        );
      } catch (parseErr) {
        console.error('[Gemini] parse error', parseErr);
        // Attempt fallback: last_successful_verse
        try {
          const last = await queryDatabase(`SELECT cache_value FROM gemini_cache WHERE cache_key = ? LIMIT 1`, ['last_successful_verse']);
          if (last && last.length > 0) {
            const parsed = JSON.parse((last[0] as any).cache_value);
            return NextResponse.json({ ...parsed, note: 'Served last successful verse (parse failure)' }, { headers: { 'Cache-Control': 'no-store' } });
          }
        } catch {}
        return NextResponse.json({ text: 'Trust in the Lord with all your heart and lean not on your own understanding.', reference: 'Proverbs 3:5', note: 'Fallback verse (parse failure)' }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }

    // Non-verse responses
    return NextResponse.json({ response: generatedText, simplified }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Gemini API error:', error);
    if (isVerseRequest) {
      try {
        const last = await queryDatabase(`SELECT cache_value FROM gemini_cache WHERE cache_key = ? LIMIT 1`, ['last_successful_verse']);
        if (last && last.length > 0) {
          const parsed = JSON.parse((last[0] as any).cache_value);
          return NextResponse.json({ ...parsed, note: 'Served last successful verse (upstream failure)' }, { headers: { 'Cache-Control': 'no-store' } });
        }
      } catch {}
      return NextResponse.json({ text: 'Trust in the Lord with all your heart and lean not on your own understanding.', reference: 'Proverbs 3:5', note: 'Fallback verse (upstream failure)' }, { headers: { 'Cache-Control': 'no-store' } });
    }
    // Fire-and-forget diag to log available models once
    listModelsDiag();
    return NextResponse.json({ error: 'Failed to get response from Gemini' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}