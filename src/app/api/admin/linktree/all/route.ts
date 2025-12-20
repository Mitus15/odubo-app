import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import type { LinkTreeItem } from '@/types/linktree';

/**
 * GET /api/admin/linktree/all
 * Fetch ALL links (including inactive) for admin management
 */
export async function GET() {
  try {
    const links = await queryDatabase<LinkTreeItem>(`
      SELECT * FROM linktree
      ORDER BY 
        category ASC,
        display_order ASC,
        title ASC
    `);

    return NextResponse.json({ links });
  } catch (error) {
    console.error('Error fetching all links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    );
  }
}
