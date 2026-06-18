import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET — List integrations linked to this project
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const integrations = await queryDatabase(
      `SELECT pi.*, i.name as integration_name, i.icon as integration_icon, i.color as integration_color, i.platform_type as integration_platform_type
       FROM ark_project_integrations pi
       JOIN ark_integrations i ON pi.integration_id = i.id
       WHERE pi.project_id = ?
       ORDER BY i.name ASC`,
      [projectId]
    );
    return NextResponse.json({ success: true, integrations: integrations || [] });
  } catch (error) {
    console.error('Ark project integrations error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch project integrations' }, { status: 500 });
  }
}

// POST — Link an integration to this project
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const { integration_id, access_url, config, notes } = body;

    if (!integration_id) {
      return NextResponse.json({ success: false, error: 'integration_id is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeQuery(
      `INSERT INTO ark_project_integrations (id, project_id, integration_id, access_url, config, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      [id, projectId, integration_id, access_url || null, config ? JSON.stringify(config) : null, notes || null, now]
    );

    return NextResponse.json({ success: true, project_integration: { id } }, { status: 201 });
  } catch (error) {
    console.error('Ark link integration error:', error);
    return NextResponse.json({ success: false, error: 'Failed to link integration' }, { status: 500 });
  }
}

// DELETE — Unlink an integration from this project (by integration_id in body)
export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const url = new URL(req.url);
    const integrationId = url.searchParams.get('integration_id');
    const linkId = url.searchParams.get('id');

    if (linkId) {
      await executeQuery('DELETE FROM ark_project_integrations WHERE id = ?', [linkId]);
    } else if (integrationId) {
      await executeQuery('DELETE FROM ark_project_integrations WHERE project_id = ? AND integration_id = ?', [projectId, integrationId]);
    } else {
      return NextResponse.json({ success: false, error: 'id or integration_id required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark unlink integration error:', error);
    return NextResponse.json({ success: false, error: 'Failed to unlink integration' }, { status: 500 });
  }
}
