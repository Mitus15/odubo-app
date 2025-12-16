import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { queryDatabase } from '@/lib/db';

// Get the currently active/published featured mode
export async function GET() {
  try {
    // Get the first published mode (there should only be one)
    const rows = await queryDatabase(
      `SELECT mode FROM featured_pages WHERE is_published = 1 ORDER BY updated_at DESC LIMIT 1`,
      []
    );
    
    if (rows && rows.length) {
      return NextResponse.json({ mode: rows[0].mode }, {
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=10',
        }
      });
    }
    
    // Default to event if nothing is published
    return NextResponse.json({ mode: 'event' }, {
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=10',
      }
    });
  } catch (e) {
    console.error('featured-active-mode error:', e);
    return NextResponse.json({ mode: 'event' }); // Fallback to event
  }
}
