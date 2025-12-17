export type ClipApiRow = {
  id: number;
  uid?: string; // Cloudflare Stream UID
  hls_url?: string | null;
  preview_url?: string | null;
  poster_url?: string | null;
  title?: string | null;
  artist_name?: string | null;
  duration_seconds?: number | null;
  created_at?: string | null;
  shopify_product_handle?: string | null;
  related_projects?: string | null;
  // Engagement fields (optional, only present when withEngagement=true)
  view_count?: number;
  completion_count?: number;
  share_count?: number;
  shop_click_count?: number;
  engagement_score?: number;
};

export type ClipItem = {
  id: number;
  hlsUrl: string;
  poster: string | null;
  title: string;
  artist: string;
  duration: number | null;
  createdAt: string | null;
  productHandle?: string | null;
  parentId?: number | null;
  // Engagement data (optional)
  engagementScore?: number;
  viewCount?: number;
  completionCount?: number;
};
