import { executeQuery, queryDatabase } from '@/lib/db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// Build prioritized list of endpoint URLs to try
const MODEL_CANDIDATES = [
  GEMINI_MODEL,
  'gemini-2.0-flash-001',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.0-flash-exp',
];

const GEMINI_API_URLS = MODEL_CANDIDATES.flatMap(m => [
  `https://generativelanguage.googleapis.com/v1/models/${m}:generateContent`,
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
]);

const TIMEOUT_MS = 6000; // 6s primary attempt
const SECOND_ATTEMPT_TIMEOUT_MS = 8000; // fallback slightly longer

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

export async function callGeminiWithRetry(prompt: string) {
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
      await executeQuery(`CREATE TABLE IF NOT EXISTS gemini_cache (cache_key TEXT PRIMARY KEY, cache_value TEXT, timestamp INTEGER)`);
      const tz = process.env.GEMINI_CACHE_TZ || 'UTC';
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const dateKey = `verse_${parts}`;
      const rows = await queryDatabase(`SELECT cache_value FROM gemini_cache WHERE cache_key = ? LIMIT 1`, [dateKey]);
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
      console.warn('[Gemini] cache read error', e);
    }

    // 2. Check API Key
    if (!GEMINI_API_KEY) {
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

    // 4. Call Gemini
    const { data, simplified } = await callGeminiWithRetry(prompt);
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error('No content generated from Gemini');

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
    const last = await queryDatabase(`SELECT cache_value FROM gemini_cache WHERE cache_key = ? LIMIT 1`, ['last_successful_verse']);
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
