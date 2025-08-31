import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { executeQuery, queryDatabase } from '@/lib/db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

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
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json() as RequestBody;
    const { action, date, verse, reference, question, timestamp, requestId, excludeRefs = [] } = body;

    let prompt = '';
    let isVerseRequest = false;

    switch (action) {
      case 'getVerse':
        isVerseRequest = true;
        // Server-side cache check: use Cloudflare D1 to store a verse per calendar day
        try {
          // Ensure cache table exists
          await executeQuery(`CREATE TABLE IF NOT EXISTS gemini_cache (cache_key TEXT PRIMARY KEY, cache_value TEXT, timestamp INTEGER)`);

          // Build a date-key in the configured timezone (defaults to UTC)
          const tz = process.env.GEMINI_CACHE_TZ || 'UTC';
          const now = new Date();
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
          // en-CA format is YYYY-MM-DD
          const dateKey = `verse_${parts}`;

          // Attempt to read cached verse for today's date key
          const rows = await queryDatabase(`SELECT cache_value, timestamp FROM gemini_cache WHERE cache_key = ? LIMIT 1`, [dateKey]);
          if (rows && rows.length > 0) {
            const row = rows[0] as any;
            try {
              const cached = JSON.parse(row.cache_value);
              return NextResponse.json(cached, { headers: { 'Cache-Control': 'public, max-age=86400' } });
            } catch (e) {
              // ignore parse errors and continue to generate a new verse
              console.warn('Failed to parse cached gemini verse, regenerating', e);
            }
          }
        } catch (dbErr) {
          console.warn('Gemini cache DB error (continuing without cache):', dbErr);
        }
        // Create more variety using timestamp and requestId
        const timestampSeed = parseInt(timestamp || '0') % 31;
        const requestSeed = requestId ? requestId.charCodeAt(0) % 31 : 0;
        const combinedSeed = (timestampSeed + requestSeed) % 31;
        const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
        const suggestedChapter = chapters[combinedSeed];
        
        const bannedList = excludeRefs.length > 0 ? `\n- STRICTLY AVOID these references: ${excludeRefs.join(', ')}` : '';

        prompt = `You are a biblical scholar providing fresh, inspiring Bible verses. Generate a Bible verse from the book of Proverbs that would be meaningful for reflection and encouragement.

        Requirements:
        - The verse MUST be from the book of Proverbs.
        - Use accurate verse text from NIV, ESV, or NASB translation.
        - Consider selecting from Proverbs chapter ${suggestedChapter} but you may choose any chapter.
        - AVOID these commonly used verses: Proverbs 3:5-6, Proverbs 15:1, Proverbs 1:7
        ${bannedList}
        - Select a verse that offers wisdom, encouragement, or practical life guidance.
        - Make it suitable for personal meditation and growth.
        - Prioritize lesser-known but meaningful verses.

        Request ID: ${requestId}
        Timestamp: ${timestamp}
        Suggested focus: Chapter ${suggestedChapter}

        CRITICAL: Respond with ONLY a valid JSON object. No other text:

        {"text": "The complete verse text", "reference": "Proverbs Chapter:Verse"}`;
        break;

      case 'explainVerse':
        prompt = `Please provide a thoughtful explanation of this Bible verse:
        
        "${verse}" - ${reference}
        
        Include:
        1. Historical context
        2. Meaning and interpretation
        3. How it applies to modern life
        
        Keep the explanation accessible and encouraging, around 2-3 sentences.`;
        break;
        
      case 'askQuestion':
        prompt = `Based on this Bible verse: "${verse}" - ${reference}
        
        Please answer this question: ${question}
        
        Provide a thoughtful, biblically-grounded response that's encouraging and practical.`;
        break;
      case 'classifyProduct':
        // Expect: question contains a short descriptor, or verse/reference unused
        // We'll reuse fields: verse as title, reference as productType, question as tags string
        prompt = `Classify this product into one of two categories: "clothes" or "items".
        
        Product title: ${verse || ''}
        Product type: ${reference || ''}
        Tags: ${question || ''}
        
        Rules:
        - clothes: apparel such as t-shirt, tee, shirt, hoodie, sweatshirt, sweater, jacket, coat, pant, trouser, jean, short, hat, beanie, cap, sock, shoe, sneaker, dress, skirt.
        - items: accessories, tech, art prints, stickers, mugs, sleeves, laptop/phone accessories, posters, merch items that are not worn as apparel.
        - If ambiguous, choose "items" unless it's clearly wearable apparel.
        
        Respond ONLY with a strict JSON object: {"category":"clothes"} or {"category":"items"}`;
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          topK: 64,
          topP: 0.9,
          maxOutputTokens: 256, // Smaller limit for simple JSON responses
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              reference: { type: 'string' }
            },
            required: ['text', 'reference']
          }
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as GeminiResponse;
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini');
    }

    console.log('Gemini raw response:', generatedText);

    if (isVerseRequest) {
      try {
        // Clean the response - remove any markdown formatting or extra text
        let cleanedText = generatedText.trim();
        
        // Remove markdown code blocks if present
        cleanedText = cleanedText.replace(/```json\s*/g, '');
        cleanedText = cleanedText.replace(/```\s*/g, '');
        cleanedText = cleanedText.replace(/\s*```$/g, '');
        
        // Remove any leading/trailing non-JSON text
        const jsonMatch = cleanedText.match(/\{[^}]*"text"[^}]*"reference"[^}]*\}/);
        if (jsonMatch) {
          cleanedText = jsonMatch[0];
        } else {
          // Try a more lenient match
          const lenientMatch = cleanedText.match(/\{[\s\S]*\}/);
          if (lenientMatch) {
            cleanedText = lenientMatch[0];
          }
        }
        
        console.log('Cleaned text for parsing:', cleanedText);
        
        const verseData = JSON.parse(cleanedText);
        
        // Validate the parsed data
        if (!verseData.text || !verseData.reference) {
          throw new Error('Missing required fields in parsed JSON');
        }
        
        // Ensure reference includes "Proverbs"
        if (!verseData.reference.toLowerCase().includes('proverbs')) {
          // If the model returned a different book, try once more by nudging the seed
          return NextResponse.json({
            text: verseData.text,
            reference: verseData.reference,
            note: 'Returned non-Proverbs verse'
          }, { headers: { 'Cache-Control': 'no-store' } });
        }

        // Upsert into D1 cache for today's date key
        try {
          const tz = process.env.GEMINI_CACHE_TZ || 'UTC';
          const now = new Date();
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
          const dateKey = `verse_${parts}`;

          const payload = JSON.stringify({ text: verseData.text, reference: verseData.reference, note: verseData.note || null });
          const ts = Date.now();
          // Try insert; if conflict, replace
          await executeQuery(`INSERT INTO gemini_cache (cache_key, cache_value, timestamp) VALUES (?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET cache_value = ?, timestamp = ?`, [dateKey, payload, ts, payload, ts]);
        } catch (cacheErr) {
          console.warn('Failed to write gemini cache:', cacheErr);
        }

        return NextResponse.json(verseData, { headers: { 'Cache-Control': 'public, max-age=86400' } });
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.log('Failed to parse:', generatedText);
        
        // Try to extract verse manually from the response
        const textMatch = generatedText.match(/"text":\s*"([^"]+)"/);
        const refMatch = generatedText.match(/"reference":\s*"([^"]+)"/);
        
        if (textMatch && refMatch) {
          console.log('Extracted manually:', { text: textMatch[1], reference: refMatch[1] });
          try {
            const tz = process.env.GEMINI_CACHE_TZ || 'UTC';
            const now = new Date();
            const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
            const dateKey = `verse_${parts}`;
            const payload = JSON.stringify({ text: textMatch[1], reference: refMatch[1], note: null });
            const ts = Date.now();
            await executeQuery(`INSERT INTO gemini_cache (cache_key, cache_value, timestamp) VALUES (?, ?, ?)
              ON CONFLICT(cache_key) DO UPDATE SET cache_value = ?, timestamp = ?`, [dateKey, payload, ts, payload, ts]);
          } catch (cacheErr) {
            console.warn('Failed to write gemini cache (manual extract):', cacheErr);
          }
          return NextResponse.json({
            text: textMatch[1],
            reference: refMatch[1]
          }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
        }
        
        // If all parsing fails, return a fallback structure
        try {
          const tz = process.env.GEMINI_CACHE_TZ || 'UTC';
          const now = new Date();
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
          const dateKey = `verse_${parts}`;
          const payload = JSON.stringify({ text: "Trust in the Lord with all your heart and lean not on your own understanding.", reference: "Proverbs 3:5", note: "AI response could not be parsed, showing fallback verse" });
          const ts = Date.now();
          await executeQuery(`INSERT INTO gemini_cache (cache_key, cache_value, timestamp) VALUES (?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET cache_value = ?, timestamp = ?`, [dateKey, payload, ts, payload, ts]);
        } catch (cacheErr) { }

        return NextResponse.json({
          text: "Trust in the Lord with all your heart and lean not on your own understanding.",
          reference: "Proverbs 3:5",
          note: "AI response could not be parsed, showing fallback verse"
        }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
      }
    }

    return NextResponse.json({ response: generatedText }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { error: 'Failed to get response from Gemini' }, 
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}