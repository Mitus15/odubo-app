import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// Helper to generate unique ID
function generateId(): string {
  return `camp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * GET /api/social/studio/campaigns
 * List all campaigns
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = `
      SELECT id, name, description, color, start_date, end_date, status, post_count, created_at, updated_at
      FROM campaigns
    `;
    const params: unknown[] = [];

    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const rows = await queryDatabase(query, params);

    const campaigns = (rows || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string | null,
      start_date: row.start_date as string | null,
      end_date: row.end_date as string | null,
      status: row.status as string,
      post_count: (row.post_count as number) || 0,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('[Campaigns API] List error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/social/studio/campaigns
 * Create a new campaign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description = null,
      color = null,
      start_date = null,
      end_date = null,
      status = 'active',
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const id = generateId();

    await executeQuery(
      `INSERT INTO campaigns (id, name, description, color, start_date, end_date, status, post_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
      [id, name, description, color, start_date, end_date, status]
    );

    return NextResponse.json({
      success: true,
      campaign: {
        id,
        name,
        description,
        color,
        start_date,
        end_date,
        status,
        post_count: 0,
      },
    });
  } catch (error) {
    console.error('[Campaigns API] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
