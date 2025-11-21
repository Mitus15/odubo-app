import HomePageClient from '@/app/HomePageClient';
import { fetchVerseOfTheDay } from '@/lib/gemini';

// Use dynamic rendering with ISR to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // ISR: regenerate every hour

// Server-side verse fetching function - calls Gemini logic directly
async function getVerse() {
  try {
    const timestamp = Date.now().toString();
    const requestId = Math.random().toString(36).substring(7);

    // Call the shared logic directly (no HTTP fetch needed)
    const result = await fetchVerseOfTheDay(timestamp, requestId);
    
    return {
      text: result.text,
      reference: result.reference,
      error: result.note || result.error || null
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
