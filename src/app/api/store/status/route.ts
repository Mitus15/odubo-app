import { NextRequest, NextResponse } from 'next/server';
import { isStorePublished } from '@/lib/storeSettings';
import { isRequestFromAdmin } from '@/lib/adminCheck';

/**
 * Public endpoint to check if store is accessible
 * Returns { published: boolean, accessGranted: boolean, isAdmin: boolean }
 */
export async function GET(request: NextRequest) {
  try {
    const published = await isStorePublished();
    const isAdmin = await isRequestFromAdmin(request);

    // Admins can always access, even when unpublished
    const accessGranted = published || isAdmin;

    return NextResponse.json({
      success: true,
      published,
      accessGranted,
      isAdmin, // Useful for client-side UI decisions
    });
  } catch (error) {
    console.error('Store status check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check store status' },
      { status: 500 }
    );
  }
}
