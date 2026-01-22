import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Announcement {
  id: string;
  title: string;
  message: string;
  link_url?: string;
  link_text?: string;
  image_url?: string;
  target: string;
  priority: number;
  starts_at?: string;
  ends_at?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/announcements
 * Returns active announcements for display
 */
export async function GET() {
  try {
    const now = new Date().toISOString();

    // Fetch active announcements within date range
    const rows = await queryDatabase(
      `SELECT id, title, message, link_url, link_text, image_url, target, priority, starts_at, ends_at
       FROM announcements
       WHERE is_active = 1
         AND (starts_at IS NULL OR starts_at <= ?)
         AND (ends_at IS NULL OR ends_at >= ?)
       ORDER BY priority DESC, created_at DESC`,
      [now, now]
    );

    const announcements = (rows || []) as Announcement[];

    return NextResponse.json({ announcements });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Announcements API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/announcements (Admin only)
 * Create a new announcement
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, link_url, link_text, image_url, target, priority, starts_at, ends_at } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    // Generate ID
    const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');

    await executeQuery(
      `INSERT INTO announcements (id, title, message, link_url, link_text, image_url, target, priority, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title,
        message,
        link_url || null,
        link_text || null,
        image_url || null,
        target || 'store',
        priority || 0,
        starts_at || null,
        ends_at || null,
      ]
    );

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Create announcement error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/announcements?id=xxx (Admin only)
 * Delete an announcement
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await executeQuery('DELETE FROM announcements WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Delete announcement error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
