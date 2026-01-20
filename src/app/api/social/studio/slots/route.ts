import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// Helper to generate unique ID
function generateId(): string {
  return `slot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Helper to parse JSON safely
function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * GET /api/social/studio/slots
 * List all posting slots
 */
export async function GET() {
  try {
    const rows = await queryDatabase(
      `SELECT id, day_of_week, time, timezone, platforms, is_active, label, created_at
       FROM posting_slots
       ORDER BY time ASC`
    );

    const slots = (rows || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      day_of_week: row.day_of_week as number | null,
      time: row.time as string,
      timezone: row.timezone as string,
      platforms: parseJSON<string[]>(row.platforms as string, []),
      is_active: Boolean(row.is_active),
      label: row.label as string | null,
      created_at: row.created_at as string,
    }));

    return NextResponse.json({ slots });
  } catch (error) {
    console.error('[Slots API] List error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch slots', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/social/studio/slots
 * Create a new posting slot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { time, day_of_week = null, platforms = ['instagram', 'tiktok'], is_active = true, label = null, timezone = 'America/Los_Angeles' } = body;

    if (!time) {
      return NextResponse.json({ error: 'Time is required' }, { status: 400 });
    }

    const id = generateId();

    await executeQuery(
      `INSERT INTO posting_slots (id, day_of_week, time, timezone, platforms, is_active, label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, day_of_week, time, timezone, JSON.stringify(platforms), is_active ? 1 : 0, label]
    );

    return NextResponse.json({
      success: true,
      slot: {
        id,
        day_of_week,
        time,
        timezone,
        platforms,
        is_active,
        label,
      },
    });
  } catch (error) {
    console.error('[Slots API] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create slot', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
