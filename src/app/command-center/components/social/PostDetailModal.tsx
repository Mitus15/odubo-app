'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Hls from 'hls.js';

// =============================================================================
// TYPES
// =============================================================================

type PostStatus = 'draft' | 'pending_approval' | 'scheduled' | 'publishing' | 'published' | 'failed';

interface Post {
  id: string;
  status: PostStatus;
  account_ids?: string[];
  title?: string;
  caption?: string;
  hashtags?: string[];
  media_type: 'video' | 'image' | 'carousel';
  media_url: string;
  thumbnail_url?: string;
  platforms: string[];
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
  updated_at?: string;
  requires_approval: boolean;
  error_message?: string;
  platform_post_ids?: string; // JSON string with postforme_id and external URLs
  platform_status?: string;
}

interface PostAnalytics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
}

interface PostDetailModalProps {
  postId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

// Platform config
const PLATFORM_CONFIG: Record<string, { icon: string; color: string; name: string }> = {
  tiktok: { icon: '📱', color: '#00f2ea', name: 'TikTok' },
  instagram: { icon: '📷', color: '#E4405F', name: 'Instagram' },
  youtube: { icon: '▶️', color: '#FF0000', name: 'YouTube' },
  facebook: { icon: '👤', color: '#1877F2', name: 'Facebook' },
  threads: { icon: '🧵', color: '#000000', name: 'Threads' },
};

// Stream customer ID
const STREAM_CUSTOMER = 'customer-tpkm273r1u0s40no';

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  x: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  externalLink: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  ),
  retry: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
};

// =============================================================================
// HELPERS
// =============================================================================

function getStatusBadge(status: PostStatus): { label: string; className: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', className: 'bg-[#302927] text-[#726d6c]' };
    case 'pending_approval':
      return { label: 'Pending Approval', className: 'bg-amber-900/30 text-amber-400' };
    case 'scheduled':
      return { label: 'Scheduled', className: 'bg-blue-900/30 text-blue-400' };
    case 'publishing':
      return { label: 'Publishing...', className: 'bg-purple-900/30 text-purple-400' };
    case 'published':
      return { label: 'Published', className: 'bg-green-900/30 text-green-400' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-900/30 text-red-400' };
    default:
      return { label: status, className: 'bg-[#302927] text-[#726d6c]' };
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// =============================================================================
// VIDEO PREVIEW COMPONENT
// =============================================================================

function VideoPreview({ url, poster }: { url: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if it's an HLS stream
    const isHls = url.includes('.m3u8') || url.includes('cloudflarestream.com');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else {
      video.src = url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      poster={poster}
      className="w-full max-h-[400px] rounded-xl bg-black object-contain"
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PostDetailModal({ postId, isOpen, onClose, onRefresh }: PostDetailModalProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [analytics, setAnalytics] = useState<PostAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch post data
  const fetchPost = useCallback(async () => {
    if (!postId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/social/posts/${postId}`);
      if (res.ok) {
        const data = (await res.json()) as { post?: Post };
        setPost(data.post || null);
      }
    } catch (err) {
      console.error('[PostDetailModal] Failed to fetch post:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    if (!postId) return;

    try {
      const res = await fetch(`/api/social/posts/${postId}/analytics`);
      if (res.ok) {
        const data = (await res.json()) as { analytics?: PostAnalytics };
        setAnalytics(data.analytics || null);
      }
    } catch (err) {
      console.error('[PostDetailModal] Failed to fetch analytics:', err);
    }
  }, [postId]);

  // Sync post status from Post for Me
  const syncPost = async () => {
    if (!postId) return;

    setSyncing(true);
    try {
      const res = await fetch(`/api/social/posts/${postId}/sync`, { method: 'POST' });
      if (res.ok) {
        await fetchPost();
        await fetchAnalytics();
      }
    } catch (err) {
      console.error('[PostDetailModal] Failed to sync post:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Retry failed post
  const retryPost = async () => {
    if (!postId) return;

    setRetrying(true);
    try {
      const res = await fetch('/api/social/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, publish_now: true }),
      });

      if (res.ok) {
        await fetchPost();
        onRefresh();
      } else {
        const error = (await res.json()) as { error?: string };
        alert(`Retry failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[PostDetailModal] Failed to retry post:', err);
    } finally {
      setRetrying(false);
    }
  };

  // Delete post
  const deletePost = async () => {
    if (!postId || !confirm('Are you sure you want to delete this post?')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/social/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        onClose();
        onRefresh();
      }
    } catch (err) {
      console.error('[PostDetailModal] Failed to delete post:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Fetch data when post ID changes
  useEffect(() => {
    if (postId && isOpen) {
      fetchPost();
      fetchAnalytics();
    } else {
      setPost(null);
      setAnalytics(null);
    }
  }, [postId, isOpen, fetchPost, fetchAnalytics]);

  if (!isOpen) return null;

  // Parse platform post IDs
  let platformData: Record<string, string> = {};
  if (post?.platform_post_ids) {
    try {
      platformData = JSON.parse(post.platform_post_ids);
    } catch {
      // Ignore parse errors
    }
  }

  // Get video URL - handle Cloudflare Stream URLs
  let videoUrl = post?.media_url || '';
  if (videoUrl && videoUrl.includes('cloudflarestream.com') && !videoUrl.includes('.m3u8')) {
    // Extract UID and create HLS URL
    const uidMatch = videoUrl.match(/cloudflarestream\.com\/([a-f0-9]{32})/i);
    if (uidMatch) {
      videoUrl = `https://${STREAM_CUSTOMER}.cloudflarestream.com/${uidMatch[1]}/manifest/video.m3u8`;
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[90vh] bg-[#0d0c0a] rounded-2xl border border-[#502d26]/40 shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#502d26]/20">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#ede8df]">Post Details</h2>
            {post && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusBadge(post.status).className}`}>
                {getStatusBadge(post.status).label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={syncPost}
              disabled={syncing || !post}
              className="p-2 rounded-lg text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927] transition-colors disabled:opacity-50"
              title="Sync from Post for Me"
            >
              <span className={syncing ? 'animate-spin inline-block' : ''}>{Icons.refresh}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927] transition-colors"
            >
              {Icons.x}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#843c2d] border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-[#726d6c]">Loading post...</p>
            </div>
          ) : !post ? (
            <div className="py-12 text-center">
              <p className="text-[#726d6c]">Post not found</p>
            </div>
          ) : (
            <>
              {/* Media Preview */}
              <div className="rounded-xl overflow-hidden bg-[#171616]">
                {post.media_type === 'video' ? (
                  <VideoPreview url={videoUrl} poster={post.thumbnail_url} />
                ) : post.thumbnail_url || post.media_url ? (
                  <img
                    src={post.thumbnail_url || post.media_url}
                    alt=""
                    className="w-full max-h-[400px] object-contain"
                  />
                ) : (
                  <div className="aspect-video flex items-center justify-center text-4xl">
                    {post.media_type === 'video' ? '🎬' : '📷'}
                  </div>
                )}
              </div>

              {/* Title */}
              {post.title && (
                <div>
                  <h3 className="text-lg font-medium text-[#ede8df]">{post.title}</h3>
                </div>
              )}

              {/* Caption */}
              {post.caption && (
                <div className="p-4 rounded-xl bg-[#171616] border border-[#502d26]/20">
                  <p className="text-xs text-[#726d6c] mb-2">Caption</p>
                  <p className="text-sm text-[#ede8df] whitespace-pre-wrap">{post.caption}</p>
                  {post.hashtags && post.hashtags.length > 0 && (
                    <p className="text-sm text-[#843c2d] mt-2">
                      {post.hashtags.map((h: string) => `#${h}`).join(' ')}
                    </p>
                  )}
                </div>
              )}

              {/* Platform Cards */}
              <div className="space-y-3">
                <p className="text-xs text-[#726d6c]">Platforms</p>
                {post.platforms.map((platform) => {
                  const config = PLATFORM_CONFIG[platform] || { icon: '📱', name: platform, color: '#666' };
                  const externalUrl = platformData.external_url || platformData[`${platform}_url`];

                  return (
                    <div
                      key={platform}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#171616] border border-[#502d26]/20"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{config.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-[#ede8df]">{config.name}</p>
                          <p className="text-xs text-[#726d6c]">
                            {post.status === 'published' ? 'Published' : post.status === 'scheduled' ? 'Scheduled' : post.status}
                          </p>
                        </div>
                      </div>
                      {externalUrl && (
                        <a
                          href={externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#302927] text-xs text-[#ede8df] hover:bg-[#3a3533] transition-colors"
                        >
                          View on {config.name}
                          {Icons.externalLink}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Analytics */}
              {post.status === 'published' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#726d6c]">Analytics</p>
                  {analytics ? (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/20 text-center">
                        <p className="text-lg font-semibold text-[#ede8df]">{formatNumber(analytics.views)}</p>
                        <p className="text-xs text-[#726d6c]">Views</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/20 text-center">
                        <p className="text-lg font-semibold text-[#ede8df]">{formatNumber(analytics.likes)}</p>
                        <p className="text-xs text-[#726d6c]">Likes</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/20 text-center">
                        <p className="text-lg font-semibold text-[#ede8df]">{formatNumber(analytics.comments)}</p>
                        <p className="text-xs text-[#726d6c]">Comments</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/20 text-center">
                        <p className="text-lg font-semibold text-[#ede8df]">{formatNumber(analytics.shares)}</p>
                        <p className="text-xs text-[#726d6c]">Shares</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/20 text-center">
                        <p className="text-lg font-semibold text-[#ede8df]">{formatNumber(analytics.saves)}</p>
                        <p className="text-xs text-[#726d6c]">Saves</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#171616] border border-[#502d26]/20 text-center">
                        <p className="text-lg font-semibold text-[#ede8df]">{analytics.engagement_rate.toFixed(1)}%</p>
                        <p className="text-xs text-[#726d6c]">Engagement</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#171616] border border-[#502d26]/20 text-center">
                      <p className="text-sm text-[#726d6c]">No analytics available yet</p>
                      <button
                        onClick={syncPost}
                        disabled={syncing}
                        className="mt-2 text-xs text-[#843c2d] hover:text-[#9a4a3a]"
                      >
                        Sync to fetch metrics
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="p-4 rounded-xl bg-[#171616] border border-[#502d26]/20 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#726d6c]">Created</span>
                  <span className="text-[#ede8df]">{formatDate(post.created_at)}</span>
                </div>
                {post.scheduled_at && (
                  <div className="flex justify-between">
                    <span className="text-[#726d6c]">Scheduled for</span>
                    <span className="text-[#ede8df]">{formatDate(post.scheduled_at)}</span>
                  </div>
                )}
                {post.published_at && (
                  <div className="flex justify-between">
                    <span className="text-[#726d6c]">Published</span>
                    <span className="text-[#ede8df]">{formatDate(post.published_at)}</span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {post.status === 'failed' && post.error_message && (
                <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50">
                  <p className="text-xs text-red-400/70 mb-1">Error</p>
                  <p className="text-sm text-red-400">{post.error_message}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {post && (
          <div className="flex items-center justify-between p-4 border-t border-[#502d26]/20 bg-[#0d0c0a]">
            <button
              onClick={deletePost}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {Icons.trash}
              <span className="text-sm">{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>

            <div className="flex items-center gap-2">
              {post.status === 'failed' && (
                <button
                  onClick={retryPost}
                  disabled={retrying}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] transition-colors disabled:opacity-50"
                >
                  {Icons.retry}
                  <span>{retrying ? 'Retrying...' : 'Retry Now'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default PostDetailModal;
