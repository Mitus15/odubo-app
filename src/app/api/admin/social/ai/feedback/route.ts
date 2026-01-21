import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { executeQuery, queryDatabase } from '@/lib/db';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const generatedText = typeof body.generated_text === 'string' ? body.generated_text : undefined;
    const platform = typeof body.platform === 'string' ? body.platform : undefined;
    const rating = typeof body.rating === 'number' ? body.rating : undefined;
    const source = typeof body.source === 'string' ? body.source : undefined;

    if (!generatedText || typeof rating !== 'number') {
      return NextResponse.json({ error: 'generated_text and rating required' }, { status: 400 });
    }

    const profiles = await queryDatabase(
      `SELECT id FROM ai_voice_profiles WHERE is_active = 1 LIMIT 1`,
      []
    );
    const profileId = profiles?.[0]?.id || null;

    await executeQuery(
      `INSERT INTO ai_generation_feedback (
        profile_id,
        generated_text,
        platform,
        rating,
        feedback_notes
      ) VALUES (?, ?, ?, ?, ?)` ,
      [
        profileId,
        generatedText,
        platform || null,
        rating,
        source || null,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[AI Feedback] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
