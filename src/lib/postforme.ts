/**
 * Post for Me API Client
 * Unified social media API for posting and analytics
 * https://www.postforme.dev/
 */

// =============================================================================
// Types
// =============================================================================

export type SocialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'threads'
  | 'pinterest'
  | 'bluesky';

export interface SocialAccount {
  id: string;
  platform: SocialPlatform | string; // API may return 'tiktok_business' etc.
  username: string;
  profile_photo_url?: string;
  user_id?: string;
  status: 'connected' | 'disconnected' | 'expired';
}

// Wrapped API response format
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    offset: number;
    limit: number;
  };
}

export interface SocialPost {
  id: string;
  social_account_id: string;
  platform: SocialPlatform;
  type: 'image' | 'video' | 'carousel' | 'text' | 'reel' | 'story';
  caption?: string;
  media_urls: string[];
  external_url?: string;
  external_id?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
}

export interface PostAnalytics {
  post_id: string;
  views: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagement_rate: number;
  watch_time_seconds?: number;
  avg_watch_percent?: number;
  updated_at: string;
}

// Feed item from /social-account-feeds endpoint
export interface FeedItem {
  platform_account_id: string;
  platform_post_id: string;
  social_account_id: string;
  platform: string;
  platform_url: string;
  posted_at: string;
  caption?: string;
  media: Array<{
    url: string;
    thumbnail_url?: string;
  }>;
  metrics?: {
    // Instagram format
    views?: number;
    impressions?: number;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saved?: number;
    follows?: number;
    total_interactions?: number;
    ig_reels_avg_watch_time?: number;
    ig_reels_video_view_total_time?: number;
    profile_visits?: number;
    profile_activity?: number;
    // TikTok format (alternative field names)
    view_count?: number;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
    // YouTube format
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
  };
}

export interface CreatePostInput {
  caption?: string;
  social_accounts: string[]; // Account IDs
  media?: Array<{ url: string; type?: 'image' | 'video' }>;
  schedule_at?: string; // ISO date string
  first_comment?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// =============================================================================
// Client
// =============================================================================

const BASE_URL = 'https://api.postforme.dev/v1';

/**
 * Get the API key from environment
 */
function getApiKey(): string {
  // Try Cloudflare env first (edge runtime)
  if (typeof process !== 'undefined' && process.env.POSTFORME_API_KEY) {
    return process.env.POSTFORME_API_KEY;
  }
  throw new Error('POSTFORME_API_KEY environment variable is not set');
}

/**
 * Make authenticated request to Post for Me API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const apiKey = getApiKey();

  const url = `${BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = (await response.json()) as T & { error?: string; message?: string };

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    console.error('[PostForMe] API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Account Methods
// =============================================================================

/**
 * Get all connected social accounts
 */
export async function getAccounts(): Promise<ApiResponse<SocialAccount[]>> {
  const response = await apiRequest<PaginatedResponse<SocialAccount>>('/social-accounts');

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to fetch accounts',
    };
  }

  // Unwrap the data array from the paginated response
  return {
    success: true,
    data: response.data.data,
  };
}

/**
 * Get a specific account by ID
 */
export async function getAccount(accountId: string): Promise<ApiResponse<SocialAccount>> {
  return apiRequest<SocialAccount>(`/social-accounts/${accountId}`);
}

// =============================================================================
// Post Methods
// =============================================================================

/**
 * Get all posts, optionally filtered
 */
export async function getPosts(params?: {
  account_id?: string;
  platform?: SocialPlatform;
  status?: 'draft' | 'scheduled' | 'published';
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<SocialPost[]>> {
  const searchParams = new URLSearchParams();

  if (params?.account_id) searchParams.set('account_id', params.account_id);
  if (params?.platform) searchParams.set('platform', params.platform);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  const response = await apiRequest<PaginatedResponse<SocialPost>>(`/social-posts${query ? `?${query}` : ''}`);

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to fetch posts',
    };
  }

  // Unwrap the data array from the paginated response
  return {
    success: true,
    data: response.data.data,
  };
}

/**
 * Get a specific post by ID
 */
export async function getPost(postId: string): Promise<ApiResponse<SocialPost>> {
  return apiRequest<SocialPost>(`/social-posts/${postId}`);
}

/**
 * Create a new post (publish immediately or schedule)
 */
export async function createPost(input: CreatePostInput): Promise<ApiResponse<SocialPost>> {
  return apiRequest<SocialPost>('/social-posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update an existing post (only drafts/scheduled)
 */
export async function updatePost(
  postId: string,
  input: Partial<CreatePostInput>
): Promise<ApiResponse<SocialPost>> {
  return apiRequest<SocialPost>(`/social-posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Delete a post
 */
export async function deletePost(postId: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiRequest<{ deleted: boolean }>(`/social-posts/${postId}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// Analytics Methods
// =============================================================================

/**
 * Get analytics for a specific post
 */
export async function getPostAnalytics(postId: string): Promise<ApiResponse<PostAnalytics>> {
  return apiRequest<PostAnalytics>(`/social-posts/${postId}/analytics`);
}

/**
 * Get analytics for multiple posts
 */
export async function getBulkAnalytics(postIds: string[]): Promise<ApiResponse<PostAnalytics[]>> {
  return apiRequest<PostAnalytics[]>('/analytics', {
    method: 'POST',
    body: JSON.stringify({ post_ids: postIds }),
  });
}

/**
 * Get account-level analytics
 */
export async function getAccountAnalytics(
  accountId: string,
  params?: {
    start_date?: string;
    end_date?: string;
  }
): Promise<
  ApiResponse<{
    followers: number;
    follower_change: number;
    total_posts: number;
    total_engagement: number;
    avg_engagement_rate: number;
  }>
> {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.set('start_date', params.start_date);
  if (params?.end_date) searchParams.set('end_date', params.end_date);

  const query = searchParams.toString();
  return apiRequest(`/social-accounts/${accountId}/analytics${query ? `?${query}` : ''}`);
}

// =============================================================================
// Feed Methods
// =============================================================================

/**
 * Get feed posts from a connected account with metrics
 */
export async function getAccountFeed(
  accountId: string,
  params?: {
    limit?: number;
    expand?: boolean;
  }
): Promise<ApiResponse<FeedItem[]>> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.expand !== false) searchParams.set('expand', 'metrics');

  const query = searchParams.toString();
  const response = await apiRequest<PaginatedResponse<FeedItem>>(
    `/social-account-feeds/${accountId}${query ? `?${query}` : ''}`
  );

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to fetch feed',
    };
  }

  return {
    success: true,
    data: response.data.data,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Map Post for Me platform to our internal platform names
 */
export function mapPlatform(platform: string): SocialPlatform {
  const mapping: Record<string, SocialPlatform> = {
    instagram: 'instagram',
    ig: 'instagram',
    tiktok: 'tiktok',
    tiktok_business: 'tiktok',
    tt: 'tiktok',
    youtube: 'youtube',
    yt: 'youtube',
    twitter: 'twitter',
    x: 'twitter',
    facebook: 'facebook',
    fb: 'facebook',
    linkedin: 'linkedin',
    li: 'linkedin',
    threads: 'threads',
    pinterest: 'pinterest',
    pin: 'pinterest',
    bluesky: 'bluesky',
    bsky: 'bluesky',
  };
  return mapping[platform.toLowerCase()] || (platform as SocialPlatform);
}

/**
 * Map Post for Me content type to our internal content types
 */
export function mapContentType(
  type: string
): 'clip' | 'long_form' | 'story' | 'post' | 'live' | 'premiere' {
  const mapping: Record<string, 'clip' | 'long_form' | 'story' | 'post' | 'live' | 'premiere'> = {
    video: 'clip',
    reel: 'clip',
    short: 'clip',
    story: 'story',
    image: 'post',
    carousel: 'post',
    text: 'post',
    live: 'live',
    premiere: 'premiere',
    long_video: 'long_form',
  };
  return mapping[type.toLowerCase()] || 'post';
}

/**
 * Check if API key is configured
 */
export function isConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}
