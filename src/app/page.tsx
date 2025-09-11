import HomePageClient from '@/app/HomePageClient';

// Server-side verse fetching function
async function getVerse() {
  try {
    const timestamp = Date.now().toString();
    const requestId = Math.random().toString(36).substring(7);

    // Resolve a robust base URL for server environments (Vercel/local)
    // Fetch the data directly on the server (relative path resolves correctly on Vercel and locally)
    const response = await fetch(`/api/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getVerse',
        timestamp,
        requestId,
      }),
      // Important: avoid POST caching at the framework layer; the API route handles its own caching
      cache: 'no-store'
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
