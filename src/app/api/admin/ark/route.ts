import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/admin/ark — List projects with filters
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const search = url.searchParams.get('search');
    const archived = url.searchParams.get('archived');
    const parent = url.searchParams.get('parent');

    let sql = `
      SELECT p.*,
        c.name as category_name, c.color as category_color, c.icon as category_icon,
        s.name as status_name, s.color as status_color,
        (SELECT COUNT(*) FROM ark_tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM ark_tasks t JOIN ark_statuses st ON t.status_id = st.id WHERE t.project_id = p.id AND st.is_closed = 1) as task_done_count
      FROM ark_projects p
      LEFT JOIN ark_categories c ON p.category_id = c.id
      LEFT JOIN ark_statuses s ON p.status_id = s.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (archived === 'true') {
      sql += ' AND p.archived_at IS NOT NULL';
    } else if (archived !== 'all') {
      sql += ' AND p.archived_at IS NULL';
    }

    if (category) {
      sql += ' AND p.category_id = ?';
      params.push(category);
    }
    if (status) {
      sql += ' AND p.status_id = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND p.priority = ?';
      params.push(priority);
    }
    if (parent) {
      sql += ' AND p.parent_project_id = ?';
      params.push(parent);
    }
    if (search) {
      sql += ' AND (p.title LIKE ? OR p.charter LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.updated_at DESC';

    const projects = await queryDatabase(sql, params);
    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error('Ark projects list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/admin/ark — Create project
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, category_id, status_id, priority, charter, objectives, success_criteria, start_date, target_date, color, icon, tags, metadata, parent_project_id, template_id } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // If no status_id provided, use the default
    let finalStatusId = status_id;
    if (!finalStatusId) {
      const defaults = await queryDatabase(
        "SELECT id FROM ark_statuses WHERE is_default = 1 AND (applies_to = 'all' OR applies_to = 'project') LIMIT 1",
        []
      );
      if (defaults && defaults.length > 0) {
        finalStatusId = defaults[0].id;
      }
    }

    await executeQuery(
      `INSERT INTO ark_projects (id, title, category_id, status_id, priority, charter, objectives, success_criteria, start_date, target_date, color, icon, tags, metadata, parent_project_id, template_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, title, category_id || null, finalStatusId || null, priority || 'medium',
        charter || null,
        objectives ? JSON.stringify(objectives) : null,
        success_criteria ? JSON.stringify(success_criteria) : null,
        start_date || null, target_date || null,
        color || null, icon || null,
        tags ? JSON.stringify(tags) : null,
        metadata ? JSON.stringify(metadata) : null,
        parent_project_id || null, template_id || null,
        now, now
      ]
    );

    // Create timeline entry
    await executeQuery(
      `INSERT INTO ark_timeline (id, project_id, entry_type, title, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, 'status_change', 'Project created', JSON.stringify({ action: 'created' }), now]
    );

    return NextResponse.json({ success: true, project: { id, title } }, { status: 201 });
  } catch (error) {
    console.error('Ark create project error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create project' }, { status: 500 });
  }
}
