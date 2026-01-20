import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

// Helper to safely parse JSON
function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * GET /api/social/posts/[id]
 * Get a single post by ID with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await queryDatabase(
      `SELECT
        id, status, created_by, approved_by,
        entity_id, account_ids,
        media_type, media_url, media_key, thumbnail_url,
        source_type, source_id,
        caption, caption_by_platform, hashtags, mentions, first_comment,
        scheduled_at, published_at, timezone,
        platforms, platform_status, platform_post_ids, platform_errors,
        title, requires_approval, is_important, notes, tags,
        error_message, retry_count, last_retry_at,
        created_at, updated_at
      FROM social_posts
      WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const row = rows[0] as Record<string, unknown>;

    // Parse JSON fields
    const post = {
      ...row,
      account_ids: parseJSON(row.account_ids as string, []),
      platforms: parseJSON(row.platforms as string, []),
      platform_status: parseJSON(row.platform_status as string, {}),
      platform_post_ids: row.platform_post_ids as string, // Keep as string for modal to parse
      platform_errors: parseJSON(row.platform_errors as string, {}),
      hashtags: parseJSON(row.hashtags as string, []),
      mentions: parseJSON(row.mentions as string, []),
      tags: parseJSON(row.tags as string, []),
      caption_by_platform: parseJSON(row.caption_by_platform as string, {}),
      requires_approval: Boolean(row.requires_approval),
      is_important: Boolean(row.is_important),
    };

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Social Posts] GET [id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch post', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/social/posts/[id]
 * Update a post (for editing drafts or updating status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = [
      'status',
      'caption',
      'hashtags',
      'mentions',
      'first_comment',
      'scheduled_at',
      'title',
      'notes',
      'requires_approval',
      'is_important',
      'error_message',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (['hashtags', 'mentions'].includes(field)) {
          values.push(JSON.stringify(body[field]));
        } else if (['requires_approval', 'is_important'].includes(field)) {
          values.push(body[field] ? 1 : 0);
        } else {
          values.push(body[field] as string | number | null);
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    await executeQuery(
      `UPDATE social_posts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Social Posts] PATCH [id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update post', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/social/posts/[id]
 * Delete a post
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if post exists
    const rows = await queryDatabase(
      `SELECT id, status FROM social_posts WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Delete the post
    await executeQuery(`DELETE FROM social_posts WHERE id = ?`, [id]);

    // Log activity
    await executeQuery(
      `INSERT INTO social_activity_log (id, user_id, action, target_type, target_id, details)
       VALUES (?, 'system', 'deleted', 'post', ?, ?)`,
      [crypto.randomUUID().split('-')[0], id, JSON.stringify({ deleted_at: new Date().toISOString() })]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Social Posts] DELETE [id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete post', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
