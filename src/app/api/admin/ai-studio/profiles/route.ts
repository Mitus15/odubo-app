import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

// GET: Fetch voice profiles
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const profiles = await queryDatabase(
      `SELECT * FROM ai_voice_profiles ORDER BY is_active DESC, created_at DESC`,
      []
    );

    // Get the active profile
    const active = profiles?.find((p: any) => p.is_active === 1) || profiles?.[0] || null;

    return NextResponse.json({
      profiles: profiles || [],
      activeProfile: active,
    });
  } catch (e: any) {
    console.error('Error fetching AI profiles:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to fetch profiles') },
      { status: 500 }
    );
  }
}

// POST: Create new profile
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name = 'New Profile',
      tone_description,
      custom_instructions,
      banned_words,
      required_patterns,
      instagram_style,
      tiktok_style,
      youtube_style,
      max_emojis = 1,
      max_hashtags = 7,
      prefer_lowercase = 1,
    } = body;

    const result = await executeQuery(
      `INSERT INTO ai_voice_profiles (
        name, tone_description, custom_instructions, banned_words, required_patterns,
        instagram_style, tiktok_style, youtube_style,
        max_emojis, max_hashtags, prefer_lowercase, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        name,
        tone_description || null,
        custom_instructions || null,
        banned_words ? JSON.stringify(banned_words) : null,
        required_patterns ? JSON.stringify(required_patterns) : null,
        instagram_style || null,
        tiktok_style || null,
        youtube_style || null,
        max_emojis,
        max_hashtags,
        prefer_lowercase,
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.lastRowId,
    });
  } catch (e: any) {
    console.error('Error creating AI profile:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to create profile') },
      { status: 500 }
    );
  }
}

// PATCH: Update profile
export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    }

    const allowedFields = [
      'name', 'tone_description', 'custom_instructions', 'banned_words', 'required_patterns',
      'instagram_style', 'tiktok_style', 'youtube_style',
      'max_emojis', 'max_hashtags', 'prefer_lowercase', 'is_active'
    ];

    const setClauses: string[] = [];
    const params: any[] = [];

    for (const field of allowedFields) {
      if (field in updates) {
        setClauses.push(`${field} = ?`);
        if (['banned_words', 'required_patterns'].includes(field) && Array.isArray(updates[field])) {
          params.push(JSON.stringify(updates[field]));
        } else {
          params.push(updates[field]);
        }
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // If setting this profile as active, deactivate others first
    if (updates.is_active === 1) {
      await executeQuery(`UPDATE ai_voice_profiles SET is_active = 0`, []);
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await executeQuery(
      `UPDATE ai_voice_profiles SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated profile
    const updated = await queryDatabase(
      `SELECT * FROM ai_voice_profiles WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      profile: updated?.[0] || null,
    });
  } catch (e: any) {
    console.error('Error updating AI profile:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to update profile') },
      { status: 500 }
    );
  }
}

// DELETE: Delete profile
export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    }

    // Check if this is the only profile
    const count = await queryDatabase(`SELECT COUNT(*) as count FROM ai_voice_profiles`, []);
    if (count?.[0]?.count <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last profile' }, { status: 400 });
    }

    await executeQuery(`DELETE FROM ai_voice_profiles WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error deleting AI profile:', e);
    return NextResponse.json(
      { error: String(e?.message || 'Failed to delete profile') },
      { status: 500 }
    );
  }
}
