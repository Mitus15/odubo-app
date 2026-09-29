export type ClipApiRow = {
  id: number;
  uid?: string; // Cloudflare Stream UID
  hls_url?: string | null;
  mp4_url?: string | null; // Cloudflare Stream MP4 download URL
  preview_url?: string | null;
  poster_url?: string | null;
  title?: string | null;
  artist_name?: string | null;
  duration_seconds?: number | null;
  created_at?: string | null;
  shopify_product_handle?: string | null;
  related_projects?: string | null;
  parent_title?: string | null; // Parent video title for clips
  // Clip identity fields
  original_filename?: string | null;
  clip_index?: number | null;
  total_siblings?: number | null;
  // Platform URL backfeed
  youtube_url?: string | null;
  youtube_shorts_url?: string | null;
  tiktok_url?: string | null;
  instagram_reels_url?: string | null;
  // Loop Soul film (migration 168): the song, the chapter, and the approved card
  track_id?: string | null;
  film_chapter_id?: string | null;
  card_flip?: string | null;
  card_verse_ref?: string | null;
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
  mp4Url?: string | null; // Cloudflare Stream MP4 download URL
  poster: string | null;
  title: string;
  artist: string;
  duration: number | null;
  createdAt: string | null;
  productHandle?: string | null;
  parentId?: number | null;
  parentTitle?: string | null; // Parent video title for clips
  uid?: string; // Cloudflare Stream UID for URL generation
  // Clip identity (Magazine & Bullets)
  originalFilename?: string | null;   // e.g., "odubo_Teaser_v3_final.mp4"
  clipIndex?: number | null;          // Position within parent (1-based)
  totalSiblings?: number | null;      // Total clips in magazine → "Clip 3 of 7"
  // Platform URL backfeed
  youtubeUrl?: string | null;
  youtubeShortsUrl?: string | null;
  tiktokUrl?: string | null;
  instagramReelsUrl?: string | null;
  // Loop Soul film (migration 168). A film clip carries no product: its chapter
  // page does the selling, and the card's flip is the words on the clip.
  trackId?: string | null;
  filmChapter?: string | null;        // loop_film_chapters.slug, opens /loop/<slug>
  card?: ClipFilmCard | null;         // only an APPROVED card ever reaches a clip
  // Engagement data (optional)
  engagementScore?: number;
  viewCount?: number;
  completionCount?: number;
};

/** The scripture card a film clip was cut from: the owner's flip and the verse it flips. */
export type ClipFilmCard = {
  flip: string | null;
  verseRef: string;
};
