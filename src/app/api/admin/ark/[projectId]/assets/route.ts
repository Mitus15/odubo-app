import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const integrationId = url.searchParams.get('integration');

    let sql = `
      SELECT a.*, i.name as integration_name, i.icon as integration_icon, i.color as integration_color
      FROM ark_assets a
      LEFT JOIN ark_integrations i ON a.integration_id = i.id
      WHERE a.project_id = ?
    `;
    const queryParams: string[] = [projectId];

    if (category) { sql += ' AND a.category = ?'; queryParams.push(category); }
    if (integrationId) { sql += ' AND a.integration_id = ?'; queryParams.push(integrationId); }

    sql += ' ORDER BY a.sort_order ASC, a.created_at DESC';
    const assets = await queryDatabase(sql, queryParams);
    return NextResponse.json({ success: true, assets: assets || [] });
  } catch (error) {
    console.error('Ark assets list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const { title, asset_type, url: assetUrl, r2_key, description, category, integration_id, metadata, sort_order } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeQuery(
      `INSERT INTO ark_assets (id, project_id, title, asset_type, url, r2_key, description, category, integration_id, metadata, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, title, asset_type || null, assetUrl || null, r2_key || null, description || null, category || null, integration_id || null, metadata ? JSON.stringify(metadata) : null, sort_order ?? 0, now, now]
    );

    return NextResponse.json({ success: true, asset: { id, title } }, { status: 201 });
  } catch (error) {
    console.error('Ark create asset error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create asset' }, { status: 500 });
  }
}
