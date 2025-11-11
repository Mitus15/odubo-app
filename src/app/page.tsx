import HomePageClient from '@/app/HomePageClient';
import { queryDatabase } from '@/lib/db';

// Use dynamic rendering with ISR to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // ISR: regenerate every hour

// Server-side verse fetching function - calls Gemini API directly
async function getVerse() {
  try {
    const timestamp = Date.now().toString();
    const requestId = Math.random().toString(36).substring(7);

    // Check for cached verse first (from gemini_cache table)
    try {
      const tz = process.env.GEMINI_CACHE_TZ || 'UTC';
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-CA', { 
        timeZone: tz, 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).format(now);
      const dateKey = `verse_${parts}`;
      
      const rows = await queryDatabase(
        `SELECT cache_value FROM gemini_cache WHERE cache_key = ? LIMIT 1`, 
        [dateKey]
      );
      
      if (rows && rows.length > 0) {
        const cached = JSON.parse((rows[0] as any).cache_value);
        console.log('[HomePage] Using cached verse for', dateKey);
        return {
          text: cached.text || '',
          reference: cached.reference || '',
          error: null
        };
      }
    } catch (cacheErr) {
      console.warn('[HomePage] Cache read error:', cacheErr);
    }

    // No cache hit - try to fetch from our API endpoint
    // Use localhost since we're in server-side context
    const port = process.env.PORT || '3000';
    const baseUrl = `http://localhost:${port}`;
    const apiUrl = `${baseUrl}/api/gemini`;
    
    let response: Response | null = null;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getVerse', timestamp, requestId }),
        cache: 'no-store',
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000)
      });
    } catch (err) {
      console.error('[HomePage] /api/gemini fetch error:', err);
      response = null;
    }

    if (!response || !response.ok) {
      try {
        if (response) {
          const txt = await response.text().catch(() => '<unreadable>');
          console.error('Gemini fetch failed:', response.status, response.statusText, txt);
        } else {
          console.error('Gemini fetch failed: no response received from /api/gemini');
        }
      } catch (logErr) {
        console.error('Error while logging Gemini fetch failure:', logErr);
      }
      throw new Error('Failed to fetch verse');
    }

    const data = await response.json() as {
      text?: string;
      reference?: string;
      note?: string;
    };
    return {
      text: data.text || '',
      reference: data.reference || '',
      error: data.note || null
    };
  } catch (error) {
    // Improved diagnostics: log type, message (if any), and stack when available
    try {
      const errType = error === null ? 'null' : typeof error;
      const errMessage = (error && (error as any).message) ? (error as any).message : String(error);
      const errStack = (error && (error as any).stack) ? (error as any).stack : 'no-stack';
      console.error('getVerse error:', { errType, errMessage, errStack });
    } catch (logErr) {
      console.error('getVerse logging failure:', logErr);
    }

    return {
      text: "Trust in the Lord with all your heart and lean not on your own understanding.",
      reference: "Proverbs 3:5",
      error: "Unable to fetch today's verse. Showing a timeless favorite."
    };
  }
}

// Server component - note the 'async' keyword
export default async function HomePage() {
  const verseOfTheDay = await getVerse();

  return <HomePageClient verseOfTheDay={verseOfTheDay} />;
}
