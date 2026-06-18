import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/admin/ark/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json({ success: false, error: 'start and end dates required' }, { status: 400 });
    }

    // Fetch tasks with scheduled_date or due_date in range
    const tasks = await queryDatabase(
      `SELECT t.*, p.title as project_title, p.color as project_color, p.icon as project_icon,
        c.name as category_name, c.color as category_color,
        s.name as status_name, s.color as status_color, s.is_closed as status_is_closed,
        m.title as milestone_title
      FROM ark_tasks t
      JOIN ark_projects p ON t.project_id = p.id
      LEFT JOIN ark_categories c ON p.category_id = c.id
      LEFT JOIN ark_statuses s ON t.status_id = s.id
      LEFT JOIN ark_milestones m ON t.milestone_id = m.id
      WHERE p.archived_at IS NULL
        AND (
          (t.scheduled_date >= ? AND t.scheduled_date <= ?)
          OR (t.due_date >= ? AND t.due_date <= ?)
        )
      ORDER BY COALESCE(t.scheduled_date, t.due_date) ASC`,
      [start, end, start, end]
    );

    // Fetch milestones with target_date in range
    const milestones = await queryDatabase(
      `SELECT m.*, p.title as project_title, p.color as project_color, p.icon as project_icon,
        c.name as category_name, c.color as category_color,
        s.name as status_name, s.color as status_color, s.is_closed as status_is_closed
      FROM ark_milestones m
      JOIN ark_projects p ON m.project_id = p.id
      LEFT JOIN ark_categories c ON p.category_id = c.id
      LEFT JOIN ark_statuses s ON m.status_id = s.id
      WHERE p.archived_at IS NULL
        AND m.target_date >= ? AND m.target_date <= ?
      ORDER BY m.target_date ASC`,
      [start, end]
    );

    // Fetch unscheduled tasks (backlog) - no scheduled_date, from active projects
    const backlog = await queryDatabase(
      `SELECT t.*, p.title as project_title, p.color as project_color, p.icon as project_icon,
        c.name as category_name, c.color as category_color,
        s.name as status_name, s.color as status_color, s.is_closed as status_is_closed
      FROM ark_tasks t
      JOIN ark_projects p ON t.project_id = p.id
      LEFT JOIN ark_categories c ON p.category_id = c.id
      LEFT JOIN ark_statuses s ON t.status_id = s.id
      WHERE p.archived_at IS NULL
        AND t.scheduled_date IS NULL
        AND (s.is_closed = 0 OR s.is_closed IS NULL)
      ORDER BY
        CASE t.priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT 50`,
      []
    );

    return NextResponse.json({
      success: true,
      tasks: tasks || [],
      milestones: milestones || [],
      backlog: backlog || [],
    });
  } catch (error) {
    console.error('Ark calendar error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch calendar data' }, { status: 500 });
  }
}

// PUT /api/admin/ark/calendar — Batch update scheduled_date (drag-drop)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { updates } = body; // Array of { task_id, scheduled_date }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ success: false, error: 'updates must be an array' }, { status: 400 });
    }

    const now = new Date().toISOString();
    for (const update of updates) {
      await executeQuery(
        'UPDATE ark_tasks SET scheduled_date = ?, updated_at = ? WHERE id = ?',
        [update.scheduled_date || null, now, update.task_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark calendar update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update schedule' }, { status: 500 });
  }
}
