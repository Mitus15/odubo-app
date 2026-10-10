import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { setupLikesSystem } from '@/lib/setupLikes';
import { requireAdmin } from '@/lib/api/requireAdmin';

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;

  try {
    const result = await setupLikesSystem();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in setup endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to setup likes system'
    }, { status: 500 });
  }
}
