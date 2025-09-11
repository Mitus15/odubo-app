import HomePageClient from '@/app/HomePageClient';

// Server-side verse fetching function
async function getVerse() {
  try {
    const timestamp = Date.now().toString();
    const requestId = Math.random().toString(36).substring(7);

    // Resolve a robust base URL for server environments (Vercel/local)
    // First try: relative path (internal routing)
    let response = await fetch(`/api/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getVerse',
        timestamp,
        requestId,
      }),
      cache: 'no-store'
    });

    // Fallback: build absolute URL if relative failed
    if (!response.ok) {
      try {
        const hdrs = await import('next/headers').then(m => m.headers());
        const proto = hdrs.get('x-forwarded-proto') || 'https';
        const host = hdrs.get('host');
        const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || '';
        const normalizedEnvUrl = envUrl ? (envUrl.startsWith('http') ? envUrl : `https://${envUrl}`) : '';
        const baseUrl = normalizedEnvUrl || (host ? `${proto}://${host}` : (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3000'));
        response = await fetch(`${baseUrl}/api/gemini`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getVerse', timestamp, requestId }),
          cache: 'no-store'
        });
      } catch (e) {
        console.error('Absolute fetch attempt failed:', e);
      }
    }

    if (!response.ok) {
      try {
        const txt = await response.text();
        console.error('Gemini fetch failed:', response.status, response.statusText, txt);
      } catch {}
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
    console.error('getVerse error:', error);
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
