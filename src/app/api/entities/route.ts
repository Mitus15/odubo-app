import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

interface Entity {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  color?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/entities
 * List all entities (brands)
 */
export async function GET() {
  try {
    const entities = await queryDatabase(
      `SELECT * FROM entities WHERE is_active = 1 ORDER BY name ASC`,
      []
    ) as Entity[];

    return NextResponse.json({
      entities: entities || [],
    });
  } catch (error) {
    console.error('[Entities] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/entities
 * Create a new entity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, description, logo_url, color } = body as {
      name?: string;
      slug?: string;
      description?: string;
      logo_url?: string;
      color?: string;
    };

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate slug from name if not provided
    const entitySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Check if slug already exists
    const existing = await queryDatabase(
      `SELECT id FROM entities WHERE slug = ?`,
      [entitySlug]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'An entity with this slug already exists' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID().split('-')[0];

    await executeQuery(
      `INSERT INTO entities (id, name, slug, description, logo_url, color)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, entitySlug, description || null, logo_url || null, color || '#843c2d']
    );

    return NextResponse.json({ success: true, id, slug: entitySlug }, { status: 201 });
  } catch (error) {
    console.error('[Entities] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
}
