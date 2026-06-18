import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/admin/ark/review?week_start=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const weekStart = url.searchParams.get('week_start');

    if (weekStart) {
      // Get specific review
      const reviews = await queryDatabase('SELECT * FROM ark_reviews WHERE week_start = ? LIMIT 1', [weekStart]);
      return NextResponse.json({ success: true, review: reviews?.[0] || null });
    }

    // Calculate this week's boundaries
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const start = monday.toISOString().split('T')[0];
    const end = sunday.toISOString().split('T')[0];

    // Fetch week's data
    const [completedTasks, milestonesReached, overdueTasks, blockedTasks, staleProjects, pastReviews] = await Promise.all([
      // Tasks completed this week
      queryDatabase(
        `SELECT t.title, t.completed_date, p.title as project_title, p.icon as project_icon
         FROM ark_tasks t
         JOIN ark_projects p ON t.project_id = p.id
         JOIN ark_statuses s ON t.status_id = s.id
         WHERE s.is_closed = 1 AND t.completed_date >= ? AND t.completed_date <= ?
         ORDER BY t.completed_date DESC`,
        [start, end + 'T23:59:59']
      ),
      // Milestones reached this week
      queryDatabase(
        `SELECT m.title, m.completed_date, p.title as project_title, p.icon as project_icon
         FROM ark_milestones m
         JOIN ark_projects p ON m.project_id = p.id
         JOIN ark_statuses s ON m.status_id = s.id
         WHERE s.is_closed = 1 AND m.completed_date >= ? AND m.completed_date <= ?`,
        [start, end + 'T23:59:59']
      ),
      // Overdue tasks
      queryDatabase(
        `SELECT t.id, t.title, t.due_date, t.project_id, p.title as project_title, p.icon as project_icon
         FROM ark_tasks t
         JOIN ark_projects p ON t.project_id = p.id
         LEFT JOIN ark_statuses s ON t.status_id = s.id
         WHERE p.archived_at IS NULL AND t.due_date < ? AND (s.is_closed = 0 OR s.is_closed IS NULL)
         ORDER BY t.due_date ASC LIMIT 15`,
        [start]
      ),
      // Blocked tasks
      queryDatabase(
        `SELECT t.id, t.title, t.project_id, p.title as project_title, p.icon as project_icon
         FROM ark_tasks t
         JOIN ark_projects p ON t.project_id = p.id
         JOIN ark_statuses s ON t.status_id = s.id
         WHERE p.archived_at IS NULL AND s.name = 'Blocked'
         LIMIT 10`,
        []
      ),
      // Projects with no activity this week
      queryDatabase(
        `SELECT p.id, p.title, p.icon,
          (SELECT MAX(created_at) FROM ark_timeline WHERE project_id = p.id) as last_activity
         FROM ark_projects p
         LEFT JOIN ark_statuses s ON p.status_id = s.id
         WHERE p.archived_at IS NULL AND s.is_closed = 0
           AND (SELECT MAX(created_at) FROM ark_timeline WHERE project_id = p.id) < ?
         ORDER BY last_activity ASC NULLS FIRST LIMIT 5`,
        [start]
      ),
      // Past reviews
      queryDatabase('SELECT id, week_start, week_end, mood, created_at FROM ark_reviews ORDER BY week_start DESC LIMIT 10', []),
    ]);

    return NextResponse.json({
      success: true,
      week: { start, end },
      data: {
        completed_tasks: completedTasks || [],
        milestones_reached: milestonesReached || [],
        overdue_tasks: overdueTasks || [],
        blocked_tasks: blockedTasks || [],
        stale_projects: staleProjects || [],
      },
      past_reviews: pastReviews || [],
    });
  } catch (error) {
    console.error('Ark review GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch review data' }, { status: 500 });
  }
}

// POST /api/admin/ark/review — Save a review
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { week_start, week_end, accomplishments, blockers, reflections, next_week_focus, mood, ai_summary } = body;

    if (!week_start || !week_end) {
      return NextResponse.json({ success: false, error: 'week_start and week_end required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Delete existing review for this week (overwrite)
    await executeQuery('DELETE FROM ark_reviews WHERE week_start = ?', [week_start]);

    await executeQuery(
      `INSERT INTO ark_reviews (id, week_start, week_end, accomplishments, blockers, reflections, next_week_focus, mood, ai_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, week_start, week_end,
        accomplishments ? JSON.stringify(accomplishments) : null,
        blockers ? JSON.stringify(blockers) : null,
        reflections || null,
        next_week_focus ? JSON.stringify(next_week_focus) : null,
        mood || null,
        ai_summary || null,
        now,
      ]
    );

    return NextResponse.json({ success: true, review: { id } }, { status: 201 });
  } catch (error) {
    console.error('Ark review POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save review' }, { status: 500 });
  }
}
