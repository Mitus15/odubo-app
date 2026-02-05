import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface Activity {
  type: string;
  action: string;
  item: string;
  time: string;
  timestamp: string;
  icon: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

export async function GET() {
  try {
    const activities: Activity[] = [];

    // Fetch recent video uploads
    const recentVideos = await queryDatabase(`
      SELECT id, title, created_at, 'video' as type
      FROM videos
      ORDER BY created_at DESC
      LIMIT 10
    `);

    for (const video of recentVideos) {
      const v = video as any;
      activities.push({
        type: 'video',
        action: 'Video uploaded',
        item: v.title || 'Untitled video',
        time: formatRelativeTime(v.created_at),
        timestamp: v.created_at,
        icon: '🎬'
      });
    }

    // Fetch recent gallery creates
    const recentGalleries = await queryDatabase(`
      SELECT id, title, created_at, 'gallery' as type
      FROM galleries
      ORDER BY created_at DESC
      LIMIT 10
    `);

    for (const gallery of recentGalleries) {
      const g = gallery as any;
      activities.push({
        type: 'gallery',
        action: 'Gallery created',
        item: g.title || 'Untitled gallery',
        time: formatRelativeTime(g.created_at),
        timestamp: g.created_at,
        icon: '📸'
      });
    }

    // Fetch recent user signups
    const recentUsers = await queryDatabase(`
      SELECT id, email, created_at, 'user' as type
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);

    for (const user of recentUsers) {
      const u = user as any;
      activities.push({
        type: 'user',
        action: 'New user signup',
        item: u.email || 'User',
        time: formatRelativeTime(u.created_at),
        timestamp: u.created_at,
        icon: '👤'
      });
    }

    // Fetch recent orders
    const recentOrders = await queryDatabase(`
      SELECT id, total_amount, shopify_created_at as created_at, 'order' as type
      FROM shopify_orders
      ORDER BY shopify_created_at DESC
      LIMIT 10
    `);

    for (const order of recentOrders) {
      const o = order as any;
      activities.push({
        type: 'order',
        action: 'Order placed',
        item: `$${parseFloat(o.total_amount || '0').toFixed(2)}`,
        time: formatRelativeTime(o.created_at),
        timestamp: o.created_at,
        icon: '📦'
      });
    }

    // Check if products table has updated_at column
    try {
      const recentProducts = await queryDatabase(`
        SELECT id, title, updated_at, 'product' as type
        FROM products
        WHERE updated_at IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 10
      `);

      for (const product of recentProducts) {
        const p = product as any;
        activities.push({
          type: 'product',
          action: 'Product updated',
          item: p.title || 'Product',
          time: formatRelativeTime(p.updated_at),
          timestamp: p.updated_at,
          icon: '🛍️'
        });
      }
    } catch (e) {
      // Products table might not have updated_at column, skip silently
      console.log('Products table query skipped:', e);
    }

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Return top 20
    const topActivities = activities.slice(0, 20);

    return NextResponse.json({
      success: true,
      activities: topActivities
    });

  } catch (error) {
    console.error('Failed to fetch recent activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recent activity',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
