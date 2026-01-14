import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

// GET: Fetch training examples for a profile
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profile_id');
    const platform = searchParams.get('platform');
    const rating = searchParams.get('rating');

    let query = `SELECT * FROM ai_training_examples WHERE 1=1`;
    const params: any[] = [];

    if (profileId) {
      query += ` AND profile_id = ?`;
      params.push(profileId);
    }

    if (platform) {
      query += ` AND (platform = ? OR platform IS NULL)`;
      params.push(platform);
    }

    if (rating) {
      query += ` AND rating = ?`;
      params.push(rating);
    }

    query += ` ORDER BY rating ASC, created_at DESC`;

    const examples = await queryDatabase(query, params);

    return NextResponse.json({
      examples: examples || [],
    });
  } catch (e: any) {
    console.error('Error fetching AI examples:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to fetch examples') },
      { status: 500 }
    );
  }
}

// POST: Create new example
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      profile_id,
      content,
      platform,
      rating = 'perfect',
      source = 'user_written',
      notes,
    } = body;

    if (!profile_id || !content) {
      return NextResponse.json({ error: 'profile_id and content required' }, { status: 400 });
    }

    const result = await executeQuery(
      `INSERT INTO ai_training_examples (profile_id, content, platform, rating, source, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [profile_id, content, platform || null, rating, source, notes || null]
    );

    return NextResponse.json({
      success: true,
      id: result.lastRowId,
    });
  } catch (e: any) {
    console.error('Error creating AI example:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to create example') },
      { status: 500 }
    );
  }
}

// PATCH: Update example
export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, content, platform, rating, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Example ID required' }, { status: 400 });
    }

    const setClauses: string[] = [];
    const params: any[] = [];

    if (content !== undefined) {
      setClauses.push('content = ?');
      params.push(content);
    }
    if (platform !== undefined) {
      setClauses.push('platform = ?');
      params.push(platform);
    }
    if (rating !== undefined) {
      setClauses.push('rating = ?');
      params.push(rating);
    }
    if (notes !== undefined) {
      setClauses.push('notes = ?');
      params.push(notes);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);

    await executeQuery(
      `UPDATE ai_training_examples SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error updating AI example:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to update example') },
      { status: 500 }
    );
  }
}

// DELETE: Delete example
export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Example ID required' }, { status: 400 });
    }

    await executeQuery(`DELETE FROM ai_training_examples WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error deleting AI example:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to delete example') },
      { status: 500 }
    );
  }
}
