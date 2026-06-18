import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    const weekStart = new Date(Date.now() - new Date().getDay() * 86400000).toISOString().split('T')[0];
    const isFriday = new Date().getDay() === 5;

    const [todayTasks, overdueTasks, upcomingTasks, upcomingMilestones, activeProjects, weeklyCompletedCount] = await Promise.all([
      // Today's scheduled tasks
      queryDatabase(
        `SELECT t.*, p.title as project_title, p.icon as project_icon, p.color as project_color,
          c.color as category_color, s.name as status_name, s.color as status_color, s.is_closed as status_is_closed
        FROM ark_tasks t
        JOIN ark_projects p ON t.project_id = p.id
        LEFT JOIN ark_categories c ON p.category_id = c.id
        LEFT JOIN ark_statuses s ON t.status_id = s.id
        WHERE p.archived_at IS NULL AND (t.scheduled_date = ? OR (t.scheduled_date IS NULL AND t.due_date = ?))
        ORDER BY CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
        [today, today]
      ),

      // Overdue tasks
      queryDatabase(
        `SELECT t.*, p.title as project_title, p.icon as project_icon, p.color as project_color,
          c.color as category_color, s.name as status_name, s.color as status_color
        FROM ark_tasks t
        JOIN ark_projects p ON t.project_id = p.id
        LEFT JOIN ark_categories c ON p.category_id = c.id
        LEFT JOIN ark_statuses s ON t.status_id = s.id
        WHERE p.archived_at IS NULL AND t.due_date < ? AND (s.is_closed = 0 OR s.is_closed IS NULL)
        ORDER BY t.due_date ASC LIMIT 10`,
        [today]
      ),

      // Upcoming tasks (next 3 days, excluding today)
      queryDatabase(
        `SELECT t.*, p.title as project_title, p.icon as project_icon, p.color as project_color,
          c.color as category_color, s.name as status_name, s.color as status_color
        FROM ark_tasks t
        JOIN ark_projects p ON t.project_id = p.id
        LEFT JOIN ark_categories c ON p.category_id = c.id
        LEFT JOIN ark_statuses s ON t.status_id = s.id
        WHERE p.archived_at IS NULL AND (s.is_closed = 0 OR s.is_closed IS NULL)
          AND (COALESCE(t.scheduled_date, t.due_date) > ? AND COALESCE(t.scheduled_date, t.due_date) <= ?)
        ORDER BY COALESCE(t.scheduled_date, t.due_date) ASC LIMIT 10`,
        [today, threeDaysOut]
      ),

      // Upcoming milestones
      queryDatabase(
        `SELECT m.*, p.title as project_title, p.icon as project_icon,
          s.is_closed as status_is_closed
        FROM ark_milestones m
        JOIN ark_projects p ON m.project_id = p.id
        LEFT JOIN ark_statuses s ON m.status_id = s.id
        WHERE p.archived_at IS NULL AND (s.is_closed = 0 OR s.is_closed IS NULL)
          AND m.target_date >= ? AND m.target_date <= ?
        ORDER BY m.target_date ASC LIMIT 5`,
        [today, threeDaysOut]
      ),

      // Active projects with stats
      queryDatabase(
        `SELECT p.id, p.title, p.icon, p.color, p.progress_percent,
          c.name as category_name, c.color as category_color,
          s.name as status_name, s.color as status_color,
          (SELECT COUNT(*) FROM ark_tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM ark_tasks t2 JOIN ark_statuses s2 ON t2.status_id = s2.id WHERE t2.project_id = p.id AND s2.is_closed = 1) as task_done_count,
          (SELECT title FROM ark_tasks t3 LEFT JOIN ark_statuses s3 ON t3.status_id = s3.id WHERE t3.project_id = p.id AND (s3.is_closed = 0 OR s3.is_closed IS NULL) AND t3.due_date IS NOT NULL ORDER BY t3.due_date ASC LIMIT 1) as next_due_task,
          (SELECT due_date FROM ark_tasks t4 LEFT JOIN ark_statuses s4 ON t4.status_id = s4.id WHERE t4.project_id = p.id AND (s4.is_closed = 0 OR s4.is_closed IS NULL) AND t4.due_date IS NOT NULL ORDER BY t4.due_date ASC LIMIT 1) as next_due_date,
          (SELECT created_at FROM ark_timeline WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1) as last_activity
        FROM ark_projects p
        LEFT JOIN ark_categories c ON p.category_id = c.id
        LEFT JOIN ark_statuses s ON p.status_id = s.id
        WHERE p.archived_at IS NULL AND s.is_closed = 0
        ORDER BY last_activity DESC NULLS LAST`,
        []
      ),

      // Tasks completed this week
      queryDatabase(
        `SELECT COUNT(*) as count FROM ark_timeline
        WHERE entry_type = 'task_completed' AND created_at >= ?`,
        [weekStart]
      ),
    ]);

    return NextResponse.json({
      success: true,
      briefing: {
        today_tasks: todayTasks || [],
        overdue_tasks: overdueTasks || [],
        upcoming_tasks: upcomingTasks || [],
        upcoming_milestones: upcomingMilestones || [],
        active_projects: activeProjects || [],
        week_completed: weeklyCompletedCount?.[0]?.count || 0,
        is_friday: isFriday,
      },
    });
  } catch (error) {
    console.error('Ark briefing error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch briefing' }, { status: 500 });
  }
}
