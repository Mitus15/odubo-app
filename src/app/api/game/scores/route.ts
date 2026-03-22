import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import type { GameScore, ScoreSubmission } from '@/types/game';

/**
 * GET /api/game/scores
 * Fetch leaderboard (top scores)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const scores = await queryDatabase(`
      SELECT id, email, instagram_handle, display_name, score, level,
             lines_cleared, game_duration_seconds, device_type, created_at
      FROM game_scores
      ORDER BY score DESC
      LIMIT ?
    `, [limit]) as GameScore[];

    // Add rank
    const ranked = scores.map((s, i) => ({ ...s, rank: i + 1 }));

    const countResult = await queryDatabase(`SELECT COUNT(*) as total FROM game_scores`) as { total: number }[];
    const total = countResult[0]?.total ?? 0;

    return NextResponse.json({ scores: ranked, total });
  } catch (error) {
    console.error('Error fetching game scores:', error);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}

/**
 * POST /api/game/scores
 * Submit a new score
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ScoreSubmission;
    const { email, instagram_handle, score, level, lines_cleared, game_duration_seconds } = body;

    // Validate
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ error: 'Valid score is required' }, { status: 400 });
    }

    // Determine display name
    const displayName = instagram_handle
      ? (instagram_handle.startsWith('@') ? instagram_handle : `@${instagram_handle}`)
      : email.split('@')[0];

    // Detect device type from user-agent
    const ua = request.headers.get('user-agent') || '';
    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    const deviceType = isMobile ? 'mobile' : 'desktop';

    // Try to link to existing fan profile
    let fanId: string | null = null;
    try {
      const existing = await queryDatabase(
        `SELECT id FROM fan_profiles WHERE email = ? LIMIT 1`,
        [email.trim().toLowerCase()]
      ) as { id: string }[];
      if (existing.length > 0) {
        fanId = existing[0].id;
      }
    } catch {
      // Non-critical — proceed without fan link
    }

    // Insert score
    const id = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    await executeQuery(`
      INSERT INTO game_scores (id, fan_id, email, instagram_handle, display_name, score, level, lines_cleared, game_duration_seconds, device_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      fanId,
      email.trim().toLowerCase(),
      instagram_handle?.trim() || null,
      displayName,
      score,
      level || 1,
      lines_cleared || 0,
      game_duration_seconds || null,
      deviceType,
    ]);

    // Get the rank of this new score
    const rankResult = await queryDatabase(
      `SELECT COUNT(*) as rank FROM game_scores WHERE score > ?`,
      [score]
    ) as { rank: number }[];
    const rank = (rankResult[0]?.rank ?? 0) + 1;

    const totalResult = await queryDatabase(`SELECT COUNT(*) as total FROM game_scores`) as { total: number }[];
    const total = totalResult[0]?.total ?? 0;

    return NextResponse.json({ success: true, rank, total });
  } catch (error) {
    console.error('Error submitting game score:', error);
    return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 });
  }
}
