import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

/**
 * GET /api/social/studio/campaigns/[id]
 * Get a single campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await queryDatabase(
      `SELECT id, name, description, color, start_date, end_date, status, post_count, created_at, updated_at
       FROM campaigns
       WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;
    const campaign = {
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
    };

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('[Campaigns API] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/social/studio/campaigns/[id]
 * Update a campaign
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build update query dynamically
    const updates: string[] = ['updated_at = datetime(\'now\')'];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      values.push(body.color);
    }
    if (body.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(body.start_date);
    }
    if (body.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(body.end_date);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }

    values.push(id);

    await executeQuery(
      `UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Campaigns API] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/social/studio/campaigns/[id]
 * Delete a campaign (archives it instead of hard delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete - set status to archived
    await executeQuery(
      `UPDATE campaigns SET status = 'archived', updated_at = datetime('now') WHERE id = ?`,
      [id]
    );

    // Clear campaign_id from associated posts
    await executeQuery(
      `UPDATE social_posts SET campaign_id = NULL WHERE campaign_id = ?`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Campaigns API] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
