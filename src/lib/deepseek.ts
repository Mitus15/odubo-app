import { executeQuery, queryDatabase } from '@/lib/db';
import OpenAI from 'openai';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

// Initialize OpenAI SDK with DeepSeek base URL
const openai = DEEPSEEK_API_KEY ? new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
}) : null;

// Model candidates for fallback
const MODEL_CANDIDATES = [
  DEEPSEEK_MODEL,
  'deepseek-v4-pro',
  'deepseek-v4-flash',
];

// Timeout wrapper for fetch
const TIMEOUT_MS = 6000;
const SECOND_ATTEMPT_TIMEOUT_MS = 8000;

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

// Build messages array from prompt (DeepSeek uses OpenAI chat format)
function buildMessages(prompt: string, simplified = false) {
  return [
    {
      role: 'system' as const,
      content: 'You are a helpful assistant.'
    },
    {
      role: 'user' as const,
      content: prompt
    }
  ];
}

// Build request body
function buildBody(prompt: string, simplified = false) {
  const messages = buildMessages(prompt, simplified);
  return {
    model: DEEPSEEK_MODEL,
    messages,
    temperature: simplified ? 0.7 : 0.8,
    max_tokens: simplified ? 160 : 256,
    stream: false,
  };
}

export async function callDeepSeekWithRetry(prompt: string) {
  if (!openai) throw new Error('DEEPSEEK_API_KEY not set');

  try {
    const response = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: buildMessages(prompt),
      temperature: 0.8,
      max_tokens: 256,
      stream: false,
    });

    const text = response.choices[0]?.message?.content || '';

    // Return in the structure expected by existing callers (Gemini-compatible format)
    return {
      data: {
        candidates: [
          {
            content: {
              parts: [
                { text }
              ]
            }
          }
        ]
      },
      simplified: false
    };
  } catch (e: any) {
    console.error('[DeepSeek] SDK error:', e);
    throw e;
  }
}

export interface VerseResult {
  text: string;
  reference: string;
  note?: string | null;
  error?: string | null;
}

export async function fetchVerseOfTheDay(timestamp?: string, requestId?: string, excludeRefs: string[] = []): Promise<VerseResult> {
  try {
    // 1. Check Cache
    try {
      await executeQuery(`CREATE TABLE IF NOT EXISTS verse_cache (cache_key TEXT PRIMARY KEY, cache_value TEXT, timestamp INTEGER)`);
      const tz = process.env.DEEPSEEK_CACHE_TZ || 'UTC';
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const dateKey = `verse_${parts}`;
      const rows = await queryDatabase(`SELECT cache_value FROM verse_cache WHERE cache_key = ? LIMIT 1`, [dateKey]);
      if (rows && rows.length > 0) {
        try {
          const cached = JSON.parse((rows[0] as any).cache_value);
          return {
            text: cached.text,
            reference: cached.reference,
            note: cached.note || null
          };
        } catch {}
      }
    } catch (e) {
      console.warn('[DeepSeek] cache read error', e);
    }

    // 2. Check API Key
    if (!DEEPSEEK_API_KEY) {
      return await getFallbackVerse('Served last successful verse (no API key)', 'Fallback verse (no API key)');
    }

    // 3. Build Prompt
    const timestampSeed = parseInt(timestamp || Date.now().toString()) % 31;
    const requestSeed = requestId ? requestId.charCodeAt(0) % 31 : 0;
    const combinedSeed = (timestampSeed + requestSeed) % 31;
    const chapters = Array.from({ length: 31 }, (_, i) => i + 1);
    const suggestedChapter = chapters[combinedSeed];
    const bannedList = excludeRefs.length > 0 ? `\n- STRICTLY AVOID these references: ${excludeRefs.join(', ')}` : '';
    const prompt = `You are a biblical scholar providing fresh, inspiring Bible verses. Generate a Bible verse from the book of Proverbs that would be meaningful for reflection and encouragement.\n\nRequirements:\n- The verse MUST be from the book of Proverbs.\n- Use accurate verse text from NIV, ESV, or NASB translation.\n- Consider selecting from Proverbs chapter ${suggestedChapter} but you may choose any chapter.\n- AVOID these commonly used verses: Proverbs 3:5-6, Proverbs 15:1, Proverbs 1:7\n${bannedList}\n- Select a verse that offers wisdom, encouragement, or practical life guidance.\n- Make it suitable for personal meditation and growth.\n- Prioritize lesser-known but meaningful verses.\n\nRequest ID: ${requestId}\nTimestamp: ${timestamp}\nSuggested focus: Chapter ${suggestedChapter}\n\nCRITICAL: Respond with ONLY a valid JSON object. No other text:\n\n{"text": "The complete verse text", "reference": "Proverbs Chapter:Verse"}`;

    // 4. Call DeepSeek
    const { data } = await callDeepSeekWithRetry(prompt);
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error('No content generated from DeepSeek');

    // 5. Parse Response
    let cleanedText = generatedText.trim();
    cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/g, '');
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
      return { text: verseData.text, reference: verseData.reference, note: 'Returned non-Proverbs verse' };
    }

    // 6. Update Cache
    try {
        const tz = process.env.DEEPSEEK_CACHE_TZ || 'UTC';
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
        const dateKey = `verse_${parts}`;
        const payload = JSON.stringify({ text: verseData.text, reference: verseData.reference, note: verseData.note || null });
        const ts = Date.now();
await executeQuery(`CREATE TABLE IF NOT EXISTS verse_cache (cache_key TEXT PRIMARY KEY, cache_value TEXT, timestamp INTEGER)`);
        await executeQuery(`INSERT INTO verse_cache (cache_key, cache_value, timestamp) VALUES (?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET cache_value = ?, timestamp = ?`, [dateKey, payload, ts, payload, ts]);
        await executeQuery(`INSERT INTO verse_cache (cache_key, cache_value, timestamp) VALUES (?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET cache_value = ?, timestamp = ?`, ['last_successful_verse', payload, ts, payload, ts]);
    } catch (cacheErr) {
      console.warn('[DeepSeek] cache write error', cacheErr);
    }

    return {
      text: verseData.text,
      reference: verseData.reference,
      note: verseData.note || null
    };

  } catch (error) {
    console.error('fetchVerseOfTheDay error:', error);
    return await getFallbackVerse('Served last successful verse (error)', 'Fallback verse (error)');
  }
}

async function getFallbackVerse(cacheNote: string, defaultNote: string): Promise<VerseResult> {
  try {
    const last = await queryDatabase(`SELECT cache_value FROM verse_cache WHERE cache_key = ? LIMIT 1`, ['last_successful_verse']);
    if (last && last.length > 0) {
      const parsed = JSON.parse((last[0] as any).cache_value);
      return { ...parsed, note: cacheNote };
    }
  } catch {}
  return {
    text: 'Trust in the Lord with all your heart and lean not on your own understanding.',
    reference: 'Proverbs 3:5',
    note: defaultNote
  };
}
