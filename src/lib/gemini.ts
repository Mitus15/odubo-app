import { executeQuery, queryDatabase } from '@/lib/db';
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Initialize SDK
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Build prioritized list of endpoint URLs to try (Legacy REST usage)
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  GEMINI_MODEL,
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
  if (!genAI) throw new Error('GEMINI_API_KEY not set');
  
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Return in the structure expected by existing callers
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
    console.error('[Gemini] SDK error:', e);
    throw e;
  }
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

function buildMultimodalBody(parts: GeminiPart[], simplified = false) {
  const base: any = {
    contents: [{ parts }],
    generationConfig: simplified
      ? {
          temperature: 0.7,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 300,
        }
      : {
          temperature: 0.8,
          topK: 64,
          topP: 0.9,
          maxOutputTokens: 500,
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

export async function callGeminiMultimodal(parts: GeminiPart[]) {
  const attempts: Array<{ simplified: boolean; timeout: number }> = [
    { simplified: false, timeout: 15000 }, // Longer timeout for multimodal
    { simplified: true, timeout: 20000 },
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
          body: buildMultimodalBody(parts, simplified)
        }, timeout);
        const duration = Date.now() - started;
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error('[Gemini] multimodal upstream error', {
            status: res.status,
            simplified,
            durationMs: duration,
            url,
            bodySnippet: body.slice(0, 300)
          });
          lastErr = new Error(`Upstream ${res.status}`);
          continue;
        }
        const data = await res.json() as any;
        return { data, simplified };
      } catch (e: any) {
        console.error('[Gemini] multimodal fetch error', { attempt: i + 1, simplified, message: e?.message });
        lastErr = e;
      }
    }
  }
  throw lastErr || new Error('Gemini multimodal fetch failed');
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

export async function uploadFileToGemini(buffer: Buffer, mimeType: string, displayName: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  
  // 1. Start Resumable Upload
  const initRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': buffer.length.toString(),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });

  if (!initRes.ok) throw new Error(`Failed to init upload: ${initRes.statusText}`);
  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('No upload URL returned');

  // 2. Upload Bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Length': buffer.length.toString(),
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) throw new Error(`Failed to upload bytes: ${uploadRes.statusText}`);
  const uploadJson = await uploadRes.json() as any;
  const fileUri = uploadJson.file.uri;
  const name = uploadJson.file.name; // files/xyz

  // 3. Wait for Active
  let state = uploadJson.file.state;
  while (state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 2000));
    const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${GEMINI_API_KEY}`);
    const checkJson = await checkRes.json() as any;
    state = checkJson.state;
    if (state === 'FAILED') throw new Error('Gemini file processing failed');
  }

  return fileUri;
}

export async function callGeminiWithFile(prompt: string, fileUri: string, mimeType: string) {
  if (!genAI) throw new Error('GEMINI_API_KEY not set');
  
  try {
    // Use gemini-2.5-flash (stable)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          fileUri: fileUri,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // Return in the structure expected by existing callers (REST format)
    return {
      candidates: [
        {
          content: {
            parts: [
              { text }
            ]
          }
        }
      ]
    };
  } catch (e: any) {
    console.error('[Gemini] SDK File error:', e);
    throw new Error(`Gemini SDK error: ${e.message}`);
  }
}
