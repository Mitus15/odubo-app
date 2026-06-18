import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const integrations = await queryDatabase(
      'SELECT * FROM ark_integrations ORDER BY name ASC',
      []
    );
    return NextResponse.json({ success: true, integrations: integrations || [] });
  } catch (error) {
    console.error('Ark integrations list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, platform_type, icon, color, base_url, description, default_metadata_schema } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await executeQuery(
      `INSERT INTO ark_integrations (id, name, platform_type, icon, color, base_url, description, default_metadata_schema, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, platform_type || null, icon || null, color || null, base_url || null, description || null, default_metadata_schema ? JSON.stringify(default_metadata_schema) : null, now, now]
    );

    return NextResponse.json({ success: true, integration: { id, name } }, { status: 201 });
  } catch (error) {
    console.error('Ark create integration error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create integration' }, { status: 500 });
  }
}
