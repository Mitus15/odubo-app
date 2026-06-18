import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/admin/ark/stats — Dashboard aggregates
export async function GET() {
  try {
    const [projectStats, taskStats, recentTimeline, urgentTasks] = await Promise.all([
      queryDatabase(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) as archived
        FROM ark_projects`,
        []
      ),
      queryDatabase(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN s.is_closed = 1 THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN s.is_closed = 0 THEN 1 ELSE 0 END) as open
        FROM ark_tasks t
        LEFT JOIN ark_statuses s ON t.status_id = s.id
        JOIN ark_projects p ON t.project_id = p.id
        WHERE p.archived_at IS NULL`,
        []
      ),
      queryDatabase(
        `SELECT tl.*, p.title as project_title
         FROM ark_timeline tl
         JOIN ark_projects p ON tl.project_id = p.id
         WHERE p.archived_at IS NULL
         ORDER BY tl.created_at DESC LIMIT 5`,
        []
      ),
      queryDatabase(
        `SELECT t.*, p.title as project_title, s.name as status_name, s.color as status_color
         FROM ark_tasks t
         JOIN ark_projects p ON t.project_id = p.id
         LEFT JOIN ark_statuses s ON t.status_id = s.id
         WHERE p.archived_at IS NULL AND (s.is_closed = 0 OR s.is_closed IS NULL) AND t.due_date IS NOT NULL
         ORDER BY t.due_date ASC LIMIT 5`,
        []
      ),
    ]);

    // Category breakdown
    const categoryBreakdown = await queryDatabase(
      `SELECT c.id, c.name, c.color, c.icon, COUNT(p.id) as count
       FROM ark_categories c
       LEFT JOIN ark_projects p ON p.category_id = c.id AND p.archived_at IS NULL
       GROUP BY c.id
       ORDER BY count DESC`,
      []
    );

    return NextResponse.json({
      success: true,
      stats: {
        projects: projectStats?.[0] || { total: 0, active: 0, archived: 0 },
        tasks: taskStats?.[0] || { total: 0, done: 0, open: 0 },
        categories: categoryBreakdown || [],
        recent_timeline: recentTimeline || [],
        urgent_tasks: urgentTasks || [],
      },
    });
  } catch (error) {
    console.error('Ark stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
