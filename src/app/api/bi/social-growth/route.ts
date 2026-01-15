import { queryDatabase, executeQuery } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { SocialSnapshotInput, SocialPlatform } from '@/types/bi';

export const runtime = 'nodejs';

// GET /api/bi/social-growth - Get social metrics with growth calculations
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const platform = url.searchParams.get('platform') as SocialPlatform | null;
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');
    const limit = parseInt(url.searchParams.get('limit') || '30');

    // Get snapshots
    let sql = 'SELECT * FROM bi_social_snapshots WHERE 1=1';
    const params: (string | number)[] = [];

    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }
    if (startDate) {
      sql += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY date DESC, platform LIMIT ?';
    params.push(limit);

    const snapshots = await queryDatabase(sql, params);

    // Get latest snapshot per platform for growth calculations
    const latestByPlatform = await queryDatabase(`
      SELECT s1.*
      FROM bi_social_snapshots s1
      INNER JOIN (
        SELECT platform, MAX(date) as max_date
        FROM bi_social_snapshots
        GROUP BY platform
      ) s2 ON s1.platform = s2.platform AND s1.date = s2.max_date
    `, []);

    // Get previous snapshots for growth comparison (7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const compareDate = sevenDaysAgo.toISOString().split('T')[0];

    const previousByPlatform = await queryDatabase(`
      SELECT s1.*
      FROM bi_social_snapshots s1
      INNER JOIN (
        SELECT platform, MAX(date) as max_date
        FROM bi_social_snapshots
        WHERE date <= ?
        GROUP BY platform
      ) s2 ON s1.platform = s2.platform AND s1.date = s2.max_date
    `, [compareDate]);

    // Calculate growth per platform
    type GrowthData = {
      platform: SocialPlatform;
      currentFollowers: number;
      previousFollowers: number;
      growth: number;
      growthPercent: number;
      trend: 'up' | 'down' | 'neutral';
      latestDate: string;
      engagement: {
        likes: number;
        comments: number;
        shares: number;
        views: number;
      };
    };

    const growth: GrowthData[] = (latestByPlatform || []).map((latest: Record<string, unknown>) => {
      const previous = (previousByPlatform || []).find((p: Record<string, unknown>) => p.platform === latest.platform) as Record<string, unknown> | undefined;
      const currentFollowers = (latest.followers as number) || 0;
      const previousFollowers = previous ? ((previous.followers as number) || 0) : currentFollowers;
      const diff = currentFollowers - previousFollowers;
      const percent = previousFollowers > 0 ? (diff / previousFollowers) * 100 : 0;

      return {
        platform: latest.platform as SocialPlatform,
        currentFollowers,
        previousFollowers,
        growth: diff,
        growthPercent: percent,
        trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
        latestDate: latest.date as string,
        engagement: {
          likes: (latest.likes_count as number) || 0,
          comments: (latest.comments_count as number) || 0,
          shares: (latest.shares_count as number) || 0,
          views: (latest.views_count as number) || 0,
        },
      };
    });

    // Total followers across all platforms
    const totalFollowers = growth.reduce((sum, g) => sum + g.currentFollowers, 0);
    const totalGrowth = growth.reduce((sum, g) => sum + g.growth, 0);

    return NextResponse.json({
      success: true,
      snapshots,
      growth,
      totals: {
        followers: totalFollowers,
        growth: totalGrowth,
        growthPercent: totalFollowers - totalGrowth > 0
          ? (totalGrowth / (totalFollowers - totalGrowth)) * 100
          : 0,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/bi/social-growth - Add social snapshot
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SocialSnapshotInput;

    if (!body.platform || !body.date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: platform, date' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    // Upsert (replace if exists for same platform+date)
    await executeQuery(`
      INSERT INTO bi_social_snapshots (
        id, platform, date, followers, following,
        posts_count, likes_count, comments_count, shares_count, views_count,
        platform_data, entry_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, date) DO UPDATE SET
        followers = excluded.followers,
        following = excluded.following,
        posts_count = excluded.posts_count,
        likes_count = excluded.likes_count,
        comments_count = excluded.comments_count,
        shares_count = excluded.shares_count,
        views_count = excluded.views_count,
        platform_data = excluded.platform_data
    `, [
      id,
      body.platform,
      body.date,
      body.followers || 0,
      body.following || 0,
      body.posts_count || 0,
      body.likes_count || 0,
      body.comments_count || 0,
      body.shares_count || 0,
      body.views_count || 0,
      body.platform_data ? JSON.stringify(body.platform_data) : null,
      body.entry_type || 'manual'
    ]);

    const snapshot = await queryDatabase(
      'SELECT * FROM bi_social_snapshots WHERE platform = ? AND date = ?',
      [body.platform, body.date]
    );

    return NextResponse.json({ success: true, snapshot: snapshot[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
