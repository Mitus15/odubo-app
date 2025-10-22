import HomePageClient from '@/app/HomePageClient';

export const revalidate = 86400; // refresh once per day (24h)

// Server-side verse fetching function
async function getVerse() {
  try {
    const timestamp = Date.now().toString();
    const requestId = Math.random().toString(36).substring(7);

    // Resolve base URL from environment only to avoid request-scoped APIs during SSG
    const envBase = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const baseUrl = String(envBase).replace(/\/$/, '');
    let response: Response | null = null;
    try {
      response = await fetch(`${baseUrl}/api/gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getVerse', timestamp, requestId }),
        // Let Next.js cache this fetch for the ISR period declared above
        next: { revalidate: 86400 }
      });
    } catch (err) {
      console.error('Absolute /api/gemini fetch threw:', err, 'baseUrl:', baseUrl);
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
