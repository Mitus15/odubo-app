import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

/**
 * GET /api/social/posts
 * List all scheduled/published posts
 * Supports filtering by entity_id and status
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entity_id');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = `
      SELECT
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
      WHERE 1=1
    `;

    const bindings: (string | number)[] = [];

    if (entityId) {
      query += ` AND entity_id = ?`;
      bindings.push(entityId);
    }

    if (status) {
      query += ` AND status = ?`;
      bindings.push(status);
    }

    query += ` ORDER BY
      CASE WHEN scheduled_at IS NOT NULL THEN scheduled_at ELSE created_at END DESC
      LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const result = await db.prepare(query).bind(...bindings).all();

    // Parse JSON fields
    const posts = (result.results || []).map((row: Record<string, unknown>) => ({
      ...row,
      account_ids: parseJSON(row.account_ids as string, []),
      platforms: parseJSON(row.platforms as string, []),
      platform_status: parseJSON(row.platform_status as string, {}),
      platform_post_ids: parseJSON(row.platform_post_ids as string, {}),
      platform_errors: parseJSON(row.platform_errors as string, {}),
      hashtags: parseJSON(row.hashtags as string, []),
      mentions: parseJSON(row.mentions as string, []),
      tags: parseJSON(row.tags as string, []),
      caption_by_platform: parseJSON(row.caption_by_platform as string, {}),
    }));

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM social_posts WHERE 1=1`;
    const countBindings: string[] = [];
    if (entityId) {
      countQuery += ` AND entity_id = ?`;
      countBindings.push(entityId);
    }
    if (status) {
      countQuery += ` AND status = ?`;
      countBindings.push(status);
    }
    const countResult = await db
      .prepare(countQuery)
      .bind(...countBindings)
      .first();

    return NextResponse.json({
      posts,
      total: (countResult as { count: number } | null)?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Social Posts] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/social/posts
 * Create a new post (draft or scheduled)
 * Now supports entity_id and account_ids for multi-entity posting
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const body = await request.json();
    const {
      status = 'draft',
      created_by = 'system',
      entity_id,
      account_ids,
      media_type,
      media_url,
      media_key,
      thumbnail_url,
      source_type,
      source_id,
      caption,
      caption_by_platform,
      hashtags,
      mentions,
      first_comment,
      scheduled_at,
      timezone,
      platforms,
      title,
      requires_approval,
      is_important,
      notes,
      tags,
    } = body as Record<string, unknown>;

    // Validate required fields
    if (!media_type || !media_url) {
      return NextResponse.json(
        { error: 'Missing required fields: media_type, media_url' },
        { status: 400 }
      );
    }

    // Must have either account_ids (new) or platforms (legacy)
    if (!account_ids && !platforms) {
      return NextResponse.json(
        { error: 'Missing required fields: account_ids or platforms' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID().split('-')[0];

    await db
      .prepare(
        `INSERT INTO social_posts (
          id, status, created_by, entity_id, account_ids,
          media_type, media_url, media_key, thumbnail_url,
          source_type, source_id,
          caption, caption_by_platform, hashtags, mentions, first_comment,
          scheduled_at, timezone,
          platforms, title, requires_approval, is_important, notes, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        status,
        created_by,
        entity_id || null,
        JSON.stringify(account_ids || []),
        media_type,
        media_url,
        media_key || null,
        thumbnail_url || null,
        source_type || null,
        source_id || null,
        caption || null,
        JSON.stringify(caption_by_platform || {}),
        JSON.stringify(hashtags || []),
        JSON.stringify(mentions || []),
        first_comment || null,
        scheduled_at || null,
        timezone || 'America/Los_Angeles',
        JSON.stringify(platforms || []),
        title || null,
        requires_approval ? 1 : 0,
        is_important ? 1 : 0,
        notes || null,
        JSON.stringify(tags || [])
      )
      .run();

    // Log activity
    await db
      .prepare(
        `INSERT INTO social_activity_log (id, user_id, action, target_type, target_id, details)
         VALUES (?, ?, 'created', 'post', ?, ?)`
      )
      .bind(
        crypto.randomUUID().split('-')[0],
        created_by,
        id,
        JSON.stringify({ status, entity_id, account_ids, platforms })
      )
      .run();

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error('[Social Posts] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create post', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Helper to safely parse JSON
function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
