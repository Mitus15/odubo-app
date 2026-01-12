import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthorizationUrl,
  generateOAuthState,
  isPlatformConfigured,
  platformConfigs,
  type Platform,
} from '@/lib/platform-oauth';

export const runtime = 'edge';

/**
 * Initiate OAuth Connection
 *
 * POST /api/connections/connect
 * Body: { platform: 'youtube' | 'instagram' | ... }
 *
 * Returns the OAuth authorization URL to redirect the user to.
 */
export async function POST(request: NextRequest) {
  try {
    const body: { platform?: string; returnUrl?: string } = await request.json();
    const platform = body.platform as Platform;

    // Validate platform
    if (!platform || !platformConfigs[platform]) {
      return NextResponse.json(
        { error: 'Invalid platform specified' },
        { status: 400 }
      );
    }

    // Check if platform is configured
    if (!isPlatformConfigured(platform)) {
      return NextResponse.json(
        {
          error: `${platformConfigs[platform].displayName} is not configured. Please add API credentials.`,
          configured: false,
        },
        { status: 400 }
      );
    }

    // Check if platform requires approval
    if (platformConfigs[platform].requiresApproval && !platformConfigs[platform].available) {
      return NextResponse.json(
        {
          error: `${platformConfigs[platform].displayName} requires platform approval before connecting.`,
          requiresApproval: true,
        },
        { status: 400 }
      );
    }

    // Generate callback URL
    const baseUrl = new URL(request.url).origin;
    const redirectUri = `${baseUrl}/api/connections/callback`;

    // Generate state for CSRF protection
    const returnUrl = body?.returnUrl || '/admin?tab=intel-connections';
    const state = generateOAuthState(platform, returnUrl);

    // Get authorization URL
    const authUrl = getAuthorizationUrl(platform, redirectUri, state);

    return NextResponse.json({
      success: true,
      authUrl,
      platform,
    });
  } catch (error) {
    console.error('[Connect API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
