import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import {
  parseOAuthState,
  exchangeCodeForTokens,
  getAccountInfo,
  platformConfigs,
} from '@/lib/platform-oauth';

export const runtime = 'edge';

/**
 * OAuth Callback Handler
 *
 * GET /api/connections/callback
 * Handles OAuth redirect from platforms
 *
 * Query params:
 * - code: Authorization code from platform
 * - state: Encoded state for CSRF validation
 * - error: Error from platform (if any)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle error from platform
  if (error) {
    console.error('[OAuth Callback] Platform error:', error, errorDescription);
    return redirectWithError(
      request,
      `Connection failed: ${errorDescription || error}`
    );
  }

  // Validate required params
  if (!code || !stateParam) {
    return redirectWithError(request, 'Missing authorization code or state');
  }

  // Parse and validate state
  const state = parseOAuthState(stateParam);
  if (!state) {
    return redirectWithError(request, 'Invalid or expired state. Please try again.');
  }

  const { platform, returnUrl } = state;

  try {
    const { env } = getRequestContext();
    const db = env.DB;

    // Generate redirect URI (must match what was used in authorization)
    const baseUrl = new URL(request.url).origin;
    const redirectUri = `${baseUrl}/api/connections/callback`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(platform, code, redirectUri);

    // Get account info from platform
    const accountInfo = await getAccountInfo(platform, tokens.accessToken);

    // Calculate token expiry
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null;

    // Generate connection ID
    const connectionId = `conn_${platform}_${Date.now().toString(36)}`;

    // Check if connection already exists for this platform
    const existing = await db
      .prepare(
        `SELECT id FROM platform_connections WHERE platform = ? LIMIT 1`
      )
      .bind(platform)
      .first();

    if (existing) {
      // Update existing connection
      await db
        .prepare(
          `UPDATE platform_connections SET
             account_id = ?,
             account_name = ?,
             access_token = ?,
             refresh_token = ?,
             token_expires_at = ?,
             status = 'active',
             last_error = NULL,
             updated_at = datetime('now')
           WHERE platform = ?`
        )
        .bind(
          accountInfo.id,
          accountInfo.name,
          tokens.accessToken,
          tokens.refreshToken || null,
          expiresAt,
          platform
        )
        .run();
    } else {
      // Create new connection
      await db
        .prepare(
          `INSERT INTO platform_connections (
             id, platform, account_id, account_name,
             access_token, refresh_token, token_expires_at,
             status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
        )
        .bind(
          connectionId,
          platform,
          accountInfo.id,
          accountInfo.name,
          tokens.accessToken,
          tokens.refreshToken || null,
          expiresAt
        )
        .run();
    }

    // Log the connection
    await db
      .prepare(
        `INSERT INTO sync_logs (job_type, platform, status, completed_at)
         VALUES ('oauth_connect', ?, 'completed', datetime('now'))`
      )
      .bind(platform)
      .run();

    // Redirect back to admin with success
    const successUrl = new URL(returnUrl, request.url);
    successUrl.searchParams.set('connected', platform);
    successUrl.searchParams.set('account', accountInfo.name);

    return NextResponse.redirect(successUrl.toString());
  } catch (err) {
    console.error('[OAuth Callback] Error:', err);

    // Log the error
    try {
      const { env } = getRequestContext();
      await env.DB.prepare(
        `INSERT INTO sync_logs (job_type, platform, status, error_message, completed_at)
         VALUES ('oauth_connect', ?, 'failed', ?, datetime('now'))`
      )
        .bind(platform, err instanceof Error ? err.message : 'Unknown error')
        .run();
    } catch {
      // Ignore logging errors
    }

    return redirectWithError(
      request,
      err instanceof Error ? err.message : 'Connection failed'
    );
  }
}

/**
 * Redirect to admin with error message
 */
function redirectWithError(request: NextRequest, message: string): NextResponse {
  const errorUrl = new URL('/admin', request.url);
  errorUrl.searchParams.set('tab', 'intel-connections');
  errorUrl.searchParams.set('error', message);

  return NextResponse.redirect(errorUrl.toString());
}
