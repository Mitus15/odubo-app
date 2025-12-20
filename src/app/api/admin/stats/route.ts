import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get counts from various tables
    const [
      albumsResult,
      tracksResult,
      videosResult,
      galleriesResult,
      productsResult,
      ordersResult,
      usersResult,
    ] = await Promise.all([
      queryDatabase('SELECT COUNT(*) as count FROM albums'),
      queryDatabase('SELECT COUNT(*) as count FROM tracks'),
      queryDatabase('SELECT COUNT(*) as count FROM videos'),
      queryDatabase('SELECT COUNT(*) as count FROM galleries'),
      queryDatabase('SELECT COUNT(*) as count FROM products'),
      queryDatabase('SELECT COUNT(*) as count FROM shopify_orders'),
      queryDatabase('SELECT COUNT(*) as count FROM users'),
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const recentActivity = await queryDatabase(`
      SELECT 
        type,
        COUNT(*) as count
      FROM (
        SELECT 'video' as type, created_at FROM videos WHERE created_at >= ?
        UNION ALL
        SELECT 'gallery' as type, created_at FROM galleries WHERE created_at >= ?
        UNION ALL
        SELECT 'order' as type, shopify_created_at as created_at FROM shopify_orders WHERE shopify_created_at >= ?
      )
      GROUP BY type
    `, [sevenDaysAgoISO, sevenDaysAgoISO, sevenDaysAgoISO]);

    // Calculate total revenue (from orders)
    const revenueResult = await queryDatabase(`
      SELECT 
        SUM(CAST(total_amount AS REAL)) as total,
        AVG(CAST(total_amount AS REAL)) as average
      FROM shopify_orders
      WHERE payment_status = 'paid'
    `);

    const stats = {
      content: {
        albums: (albumsResult[0] as any)?.count || 0,
        tracks: (tracksResult[0] as any)?.count || 0,
        videos: (videosResult[0] as any)?.count || 0,
        galleries: (galleriesResult[0] as any)?.count || 0,
      },
      commerce: {
        products: (productsResult[0] as any)?.count || 0,
        orders: (ordersResult[0] as any)?.count || 0,
        revenue: (revenueResult[0] as any)?.total || 0,
        averageOrderValue: (revenueResult[0] as any)?.average || 0,
      },
      users: {
        total: (usersResult[0] as any)?.count || 0,
      },
      activity: {
        recentVideos: (recentActivity.find((a: any) => a.type === 'video') as any)?.count || 0,
        recentGalleries: (recentActivity.find((a: any) => a.type === 'gallery') as any)?.count || 0,
        recentOrders: (recentActivity.find((a: any) => a.type === 'order') as any)?.count || 0,
      },
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error stack:', errorStack);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch admin stats', details: errorMessage },
      { status: 500 }
    );
  }
}
