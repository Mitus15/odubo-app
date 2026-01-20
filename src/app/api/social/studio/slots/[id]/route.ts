import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

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
 * GET /api/social/studio/slots/[id]
 * Get a single slot
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await queryDatabase(
      `SELECT id, day_of_week, time, timezone, platforms, is_active, label, created_at
       FROM posting_slots
       WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;
    const slot = {
      id: row.id as string,
      day_of_week: row.day_of_week as number | null,
      time: row.time as string,
      timezone: row.timezone as string,
      platforms: parseJSON<string[]>(row.platforms as string, []),
      is_active: Boolean(row.is_active),
      label: row.label as string | null,
      created_at: row.created_at as string,
    };

    return NextResponse.json({ slot });
  } catch (error) {
    console.error('[Slots API] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch slot', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/social/studio/slots/[id]
 * Update a slot
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.time !== undefined) {
      updates.push('time = ?');
      values.push(body.time);
    }
    if (body.day_of_week !== undefined) {
      updates.push('day_of_week = ?');
      values.push(body.day_of_week);
    }
    if (body.timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(body.timezone);
    }
    if (body.platforms !== undefined) {
      updates.push('platforms = ?');
      values.push(JSON.stringify(body.platforms));
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }
    if (body.label !== undefined) {
      updates.push('label = ?');
      values.push(body.label);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);

    await executeQuery(
      `UPDATE posting_slots SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Slots API] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update slot', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/social/studio/slots/[id]
 * Delete a slot
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await executeQuery(
      `DELETE FROM posting_slots WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Slots API] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete slot', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
