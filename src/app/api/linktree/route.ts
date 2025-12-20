import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import type { LinkTreeItem } from '@/types/linktree';

/**
 * GET /api/linktree
 * Fetch all active links for user-facing display
 */
export async function GET() {
  try {
    const links = await queryDatabase<LinkTreeItem>(`
      SELECT * FROM linktree
      WHERE is_active = 1
      ORDER BY 
        is_featured DESC,
        category ASC,
        display_order ASC,
        title ASC
    `);

    return NextResponse.json({ links });
  } catch (error) {
    console.error('Error fetching linktree:', error);
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/linktree
 * Create a new link (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      url,
      category,
      platform,
      icon_url,
      description,
      display_order = 0,
      is_active = 1,
      is_featured = 0,
      managed_by,
      notes,
    } = body;

    if (!title || !url || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: title, url, category' },
        { status: 400 }
      );
    }

    const result = await queryDatabase(`
      INSERT INTO linktree (
        title, url, category, platform, icon_url, description,
        display_order, is_active, is_featured, managed_by, notes,
        last_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      title, url, category, platform || null, icon_url || null,
      description || null, display_order, is_active, is_featured,
      managed_by || null, notes || null
    ]);

    return NextResponse.json({ 
      success: true,
      id: (result as any).lastID
    });
  } catch (error) {
    console.error('Error creating link:', error);
    return NextResponse.json(
      { error: 'Failed to create link' },
      { status: 500 }
    );
  }
}
