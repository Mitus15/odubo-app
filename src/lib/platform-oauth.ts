/**
 * Platform OAuth Configuration and Utilities
 *
 * Supports multiple platforms with a unified interface.
 * Each platform has its own OAuth flow but stores tokens in the same table.
 */

// Supported platforms
export type Platform =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'spotify'
  | 'twitter';

// Platform configuration
export interface PlatformConfig {
  name: string;
  displayName: string;
  icon: string;
  color: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  available: boolean; // Whether API access is available
  requiresApproval: boolean; // Whether platform requires special approval
}

// OAuth state for CSRF protection
export interface OAuthState {
  platform: Platform;
  returnUrl: string;
  nonce: string;
  timestamp: number;
}

// Token response from OAuth
export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

// Platform configurations
export const platformConfigs: Record<Platform, PlatformConfig> = {
  youtube: {
    name: 'youtube',
    displayName: 'YouTube',
    icon: 'youtube',
    color: '#FF0000',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    clientIdEnv: 'YOUTUBE_CLIENT_ID',
    clientSecretEnv: 'YOUTUBE_CLIENT_SECRET',
    available: true,
    requiresApproval: false,
  },
  instagram: {
    name: 'instagram',
    displayName: 'Instagram',
    icon: 'instagram',
    color: '#E4405F',
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: ['user_profile', 'user_media'],
    clientIdEnv: 'INSTAGRAM_APP_ID',
    clientSecretEnv: 'INSTAGRAM_APP_SECRET',
    available: true,
    requiresApproval: false,
  },
  tiktok: {
    name: 'tiktok',
    displayName: 'TikTok',
    icon: 'tiktok',
    color: '#000000',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.list'],
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    available: false, // Requires business verification
    requiresApproval: true,
  },
  spotify: {
    name: 'spotify',
    displayName: 'Spotify for Artists',
    icon: 'spotify',
    color: '#1DB954',
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: ['user-read-private', 'user-read-email'],
    clientIdEnv: 'SPOTIFY_CLIENT_ID',
    clientSecretEnv: 'SPOTIFY_CLIENT_SECRET',
    available: false, // Requires artist verification
    requiresApproval: true,
  },
  twitter: {
    name: 'twitter',
    displayName: 'X (Twitter)',
    icon: 'twitter',
    color: '#1DA1F2',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    clientIdEnv: 'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
    available: true,
    requiresApproval: false,
  },
};

/**
 * Check if a platform is configured (has credentials)
 */
export function isPlatformConfigured(platform: Platform): boolean {
  const config = platformConfigs[platform];
  return !!(
    process.env[config.clientIdEnv] && process.env[config.clientSecretEnv]
  );
}

/**
 * Get OAuth authorization URL for a platform
 */
export function getAuthorizationUrl(
  platform: Platform,
  redirectUri: string,
  state: string
): string {
  const config = platformConfigs[platform];

  const params = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  // Platform-specific parameters
  if (platform === 'youtube') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  if (platform === 'tiktok') {
    params.delete('scope');
    params.set('scope', config.scopes.join(','));
  }

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  platform: Platform,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const config = platformConfigs[platform];

  const params = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] || '',
    client_secret: process.env[config.clientSecretEnv] || '',
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data: any = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  platform: Platform,
  refreshToken: string
): Promise<TokenResponse> {
  const config = platformConfigs[platform];

  const params = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] || '',
    client_secret: process.env[config.clientSecretEnv] || '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data: any = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Some platforms don't return new refresh token
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

/**
 * Generate a secure random state for OAuth
 */
export function generateOAuthState(platform: Platform, returnUrl: string): string {
  const state: OAuthState = {
    platform,
    returnUrl,
    nonce: generateNonce(),
    timestamp: Date.now(),
  };

  // Base64 encode the state
  return btoa(JSON.stringify(state));
}

/**
 * Parse and validate OAuth state
 */
export function parseOAuthState(stateString: string): OAuthState | null {
  try {
    const state = JSON.parse(atob(stateString)) as OAuthState;

    // Validate timestamp (state expires after 10 minutes)
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Generate a random nonce
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get account info from platform API
 */
export async function getAccountInfo(
  platform: Platform,
  accessToken: string
): Promise<{ id: string; name: string; username?: string }> {
  switch (platform) {
    case 'youtube': {
      const res = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data: any = await res.json();
      const channel = data.items?.[0];
      return {
        id: channel?.id || '',
        name: channel?.snippet?.title || 'Unknown',
        username: channel?.snippet?.customUrl,
      };
    }

    case 'instagram': {
      const res = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
      );
      const data: any = await res.json();
      return {
        id: data.id || '',
        name: data.username || 'Unknown',
        username: data.username,
      };
    }

    case 'spotify': {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data: any = await res.json();
      return {
        id: data.id || '',
        name: data.display_name || 'Unknown',
        username: data.id,
      };
    }

    case 'twitter': {
      const res = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data: any = await res.json();
      return {
        id: data.data?.id || '',
        name: data.data?.name || 'Unknown',
        username: data.data?.username,
      };
    }

    case 'tiktok': {
      const res = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data: any = await res.json();
      return {
        id: data.data?.user?.open_id || '',
        name: data.data?.user?.display_name || 'Unknown',
      };
    }

    default:
      return { id: '', name: 'Unknown' };
  }
}

/**
 * Get all available platforms with their configuration status
 */
export function getAvailablePlatforms(): Array<{
  platform: Platform;
  config: PlatformConfig;
  configured: boolean;
}> {
  return (Object.keys(platformConfigs) as Platform[]).map((platform) => ({
    platform,
    config: platformConfigs[platform],
    configured: isPlatformConfigured(platform),
  }));
}
