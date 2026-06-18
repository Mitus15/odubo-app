import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const templates = await queryDatabase(
      `SELECT t.*, c.name as category_name
       FROM ark_templates t
       LEFT JOIN ark_categories c ON t.category_id = c.id
       WHERE t.is_active = 1
       ORDER BY t.name ASC`,
      []
    );
    return NextResponse.json({ success: true, templates: templates || [] });
  } catch (error) {
    console.error('Ark templates list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, category_id, description, icon, color, charter_template, default_objectives, default_milestones, default_tasks, default_integrations, default_tags } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeQuery(
      `INSERT INTO ark_templates (id, name, category_id, description, icon, color, charter_template, default_objectives, default_milestones, default_tasks, default_integrations, default_tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, name, category_id || null, description || null, icon || null, color || null,
        charter_template || null,
        default_objectives ? JSON.stringify(default_objectives) : null,
        default_milestones ? JSON.stringify(default_milestones) : null,
        default_tasks ? JSON.stringify(default_tasks) : null,
        default_integrations ? JSON.stringify(default_integrations) : null,
        default_tags ? JSON.stringify(default_tags) : null,
        now, now
      ]
    );

    return NextResponse.json({ success: true, template: { id, name } }, { status: 201 });
  } catch (error) {
    console.error('Ark create template error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create template' }, { status: 500 });
  }
}
