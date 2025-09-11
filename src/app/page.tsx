import HomePageClient from '@/app/HomePageClient';
import { headers } from 'next/headers';

// Server-side verse fetching function
async function getVerse() {
  try {
    const timestamp = Date.now().toString();
    const requestId = Math.random().toString(36).substring(7);

    // Resolve a robust base URL for server environments (Vercel/local)
    const hdrs = headers();
    const forwardedProto = hdrs.get('x-forwarded-proto') || 'https';
    const host = hdrs.get('host');
    const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || '';
    const normalizedEnvUrl = envUrl
      ? (envUrl.startsWith('http') ? envUrl : `https://${envUrl}`)
      : '';
    const baseUrl = normalizedEnvUrl || (host ? `${forwardedProto}://${host}` : 'http://localhost:3000');

    // Fetch the data directly on the server
    const response = await fetch(`${baseUrl}/api/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getVerse',
        timestamp,
        requestId,
      }),
      next: { revalidate: 86400 } // Revalidate every 24 hours (daily verse)
    });

    if (!response.ok) {
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
