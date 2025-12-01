import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Hardcoded test video ID (David In The City)
    const videoId = 16; 
    const cfVideoId = '9a6cdca07df6b8e328b40e89d873d9b6'; // Extracted from previous context

    console.log('Starting test analysis for video:', videoId, cfVideoId);

    // Call the analyze API internally
    const analyzeRes = await fetch('http://localhost:3000/api/analyze-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Mock auth header if needed, but the API checks session. 
        // Since we are calling from a script, we might need to bypass auth or generate a token.
        // For now, let's assume we run this in a dev environment where we can bypass or use a valid token.
        // Actually, the API checks `getUserFromRequest`.
        // We can't easily mock that without a valid session cookie.
        // So this test script might fail if run directly via node.
        // Better to run it as a client-side script or use a valid token.
      },
      body: JSON.stringify({ videoId, cfVideoId })
    });

    if (!analyzeRes.ok) {
      const text = await analyzeRes.text();
      console.error('Analysis failed:', text);
      return NextResponse.json({ error: text }, { status: analyzeRes.status });
    }

    const data = await analyzeRes.json();
    console.log('Analysis success:', JSON.stringify(data, null, 2));

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Test failed:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
