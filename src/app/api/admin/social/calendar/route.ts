import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

// GET: Fetch content for calendar view (grouped by date)
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start'); // ISO date string
    const end = searchParams.get('end'); // ISO date string
    const platforms = searchParams.getAll('platforms'); // Filter by platform
    const statuses = searchParams.getAll('status'); // Filter by status
    const contentTypes = searchParams.getAll('content_type'); // Filter by content type

    // Build query conditions
    const conditions: string[] = [];
    const params: any[] = [];

    // Date range filter (required for calendar)
    if (start) {
      conditions.push('sc.scheduled_for >= ?');
      params.push(start);
    }
    if (end) {
      conditions.push('sc.scheduled_for <= ?');
      params.push(end);
    }

    // Status filter
    if (statuses.length > 0) {
      conditions.push(`sc.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }

    // Content type filter
    if (contentTypes.length > 0) {
      conditions.push(`sc.content_type IN (${contentTypes.map(() => '?').join(', ')})`);
      params.push(...contentTypes);
    }

    // Platform filter (check scheduled_platforms JSON)
    // Note: This is a simple LIKE check; for complex queries consider JSON functions
    if (platforms.length > 0) {
      const platformConditions = platforms.map(() => 'sc.scheduled_platforms LIKE ?');
      conditions.push(`(${platformConditions.join(' OR ')})`);
      params.push(...platforms.map(p => `%"${p}"%`));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch content with folder info
    const content = await queryDatabase(
      `SELECT
        sc.id,
        sc.title,
        sc.status,
        sc.content_type,
        sc.scheduled_for,
        sc.scheduled_platforms,
        sc.platform_status,
        sc.upload_uid,
        sc.video_id,
        sc.thumbnail_url,
        sc.duration,
        sc.ai_performance_score,
        sc.ai_analyzed_at,
        sc.import_source,
        sc.folder_id,
        sf.name as folder_name,
        sf.slug as folder_slug
      FROM social_content sc
      LEFT JOIN social_folders sf ON sc.folder_id = sf.id
      ${whereClause}
      ORDER BY sc.scheduled_for ASC, sc.created_at DESC`,
      params
    );

    // Group content by date
    const groupedByDate: Record<string, any[]> = {};

    for (const item of content || []) {
      if (item.scheduled_for) {
        // Extract date part (YYYY-MM-DD)
        const dateKey = item.scheduled_for.split('T')[0];
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        // Safely parse JSON fields
        let scheduledPlatforms: string[] = [];
        let platformStatus: Record<string, string> = {};
        try {
          if (item.scheduled_platforms) {
            scheduledPlatforms = JSON.parse(item.scheduled_platforms);
          }
        } catch {
          // Invalid JSON, use empty array
        }
        try {
          if (item.platform_status) {
            platformStatus = JSON.parse(item.platform_status);
          }
        } catch {
          // Invalid JSON, use empty object
        }
        groupedByDate[dateKey].push({
          ...item,
          scheduled_platforms: scheduledPlatforms,
          platform_status: platformStatus,
        });
      }
    }

    // Also get unscheduled content for the sidebar/backlog
    const unscheduledContent = await queryDatabase(
      `SELECT
        sc.id,
        sc.title,
        sc.status,
        sc.content_type,
        sc.upload_uid,
        sc.video_id,
        sc.thumbnail_url,
        sc.duration,
        sc.ai_performance_score,
        sc.folder_id,
        sf.name as folder_name
      FROM social_content sc
      LEFT JOIN social_folders sf ON sc.folder_id = sf.id
      WHERE sc.scheduled_for IS NULL
        AND sc.status NOT IN ('posted', 'archived')
      ORDER BY sc.created_at DESC
      LIMIT 50`,
      []
    );

    // Get counts by status for the sidebar
    const statusCounts = await queryDatabase(
      `SELECT status, COUNT(*) as count
       FROM social_content
       GROUP BY status`,
      []
    );

    const statusCountMap: Record<string, number> = {};
    for (const row of statusCounts || []) {
      statusCountMap[row.status] = row.count;
    }

    return NextResponse.json({
      calendar: groupedByDate,
      unscheduled: unscheduledContent || [],
      statusCounts: statusCountMap,
      dateRange: { start, end },
    });
  } catch (e: any) {
    console.error('Calendar API error:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to fetch calendar data') },
      { status: 500 }
    );
  }
}

// PATCH: Reschedule content (drag-and-drop)
export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, scheduled_for, scheduled_platforms } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (scheduled_for !== undefined) {
      updates.push('scheduled_for = ?');
      params.push(scheduled_for);
    }

    if (scheduled_platforms !== undefined) {
      updates.push('scheduled_platforms = ?');
      params.push(JSON.stringify(scheduled_platforms));
    }

    // If scheduling, update status to 'scheduled' if currently draft/approved
    if (scheduled_for) {
      updates.push(`status = CASE
        WHEN status IN ('draft', 'approved', 'review') THEN 'scheduled'
        ELSE status
      END`);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await queryDatabase(
      `UPDATE social_content SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated content
    const updated = await queryDatabase(
      `SELECT * FROM social_content WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      content: updated?.[0] || null,
    });
  } catch (e: any) {
    console.error('Calendar reschedule error:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to reschedule') },
      { status: 500 }
    );
  }
}
