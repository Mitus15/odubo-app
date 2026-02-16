'use client';

/**
 * Arsenal Tab - Content Orchestration Hub
 * "Magazine & Bullets" - Upload → Deploy → Backfeed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as tus from 'tus-js-client';
import { VideoDetailModal } from './VideoDetailModal';
import { detectVideoFormat } from '@/lib/videoFormat';

// Types
interface Video {
  id: number;
  uid: string;
  title: string;
  description: string | null;
  original_filename: string | null;
  poster_url: string | null;
  duration: string | null;
  parent_video_id: number | null;
  clip_index: number | null;
  total_siblings: number | null;
  category: string | null;
  mood: string | null;
  type: string | null;
  artist_name: string | null;
  source_format: string | null;
  // Music relationships
  track_id: string | null;
  album_id: string | null;
  track_title: string | null; // Joined from tracks table
  album_title: string | null; // Joined from albums table
  // Publication status
  is_public: number | null; // 1 = published, 0 = unpublished
  publication_status: string | null; // 'live' or 'archived'
  // Platform URLs
  youtube_url: string | null;
  youtube_shorts_url: string | null;
  tiktok_url: string | null;
  instagram_reels_url: string | null;
  postforme_post_id: string | null;
  postforme_status: string | null;
  // Social metadata
  social_description: string | null;
  social_hashtags: string | null; // JSON array
  social_first_comment: string | null;
  social_visibility: string | null;
  created_at: string;
  // Deployment tracking (from video_deployments table)
  deployment_count: number | null;
  deployment_details: string | null; // e.g., "youtube:published,tiktok:pending"
}

interface DeployMetadata {
  title: string;
  description: string;
  firstComment: string;
  hashtags: string[];
  visibility: 'public' | 'unlisted' | 'private';
  // Platform-specific settings
  youtube?: {
    madeForKids: boolean;
    category: string;
    asShort: boolean;
  };
  tiktok?: {
    allowDuet: boolean;
    allowStitch: boolean;
    allowComments: boolean;
  };
  instagram?: {
    shareToFeed: boolean;
  };
  // Include credits in description
  includeCredits: boolean;
}

// YouTube category mapping
const YOUTUBE_CATEGORIES = [
  { id: '10', name: 'Music' },
  { id: '24', name: 'Entertainment' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '27', name: 'Education' },
  { id: '26', name: 'Howto & Style' },
  { id: '1', name: 'Film & Animation' },
] as const;

// Character limits per platform
const CHAR_LIMITS = {
  youtube: { title: 100, description: 5000 },
  tiktok: { caption: 2200 },
  instagram: { caption: 2200, firstComment: 2200 },
} as const;

type ViewMode = 'library' | 'upload' | 'pipeline' | 'feed-order' | 'deploy' | 'sync' | 'posters';
type FilterMode = 'all' | 'published' | 'unpublished' | 'videos' | 'clips' | 'deployed' | 'not-deployed';

interface FeedClip {
  id: number;
  uid: string;
  title: string;
  poster_url: string | null;
  duration: string | null;
  feed_position: number | null;
  parent_video_id: number | null;
  artist_name: string | null;
  created_at: string;
}

// Icons
const Icons = {
  library: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  deploy: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  sync: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  youtube: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  tiktok: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
    </svg>
  ),
  instagram: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  pending: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  minus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  ),
  expand: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
  collapse: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  drag: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h.01M8 15h.01M16 9h.01M16 15h.01" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  feedOrder: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  ),
  pipeline: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
    </svg>
  ),
  globe: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  eyeOff: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  rocket: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
  moreVertical: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  play: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  poster: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  ),
};

// Video Preview Modal
function VideoPreviewModal({
  video,
  onClose,
}: {
  video: Video;
  onClose: () => void;
}) {
  // Build the video URL - either HLS or iframe embed
  const videoUrl = video.uid
    ? `https://customer-tpkm273r1u0s40no.cloudflarestream.com/${video.uid}/manifest/video.m3u8`
    : null;
  const iframeUrl = video.uid
    ? `https://iframe.videodelivery.net/${video.uid}?autoplay=true`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-full sm:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
        >
          {Icons.close}
        </button>

        {/* Video container */}
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
          {iframeUrl ? (
            <iframe
              src={iframeUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[#726d6c]">
              No video available
            </div>
          )}
        </div>

        {/* Video info */}
        <div className="mt-4 p-3 sm:p-4 bg-[#1a1816] rounded-xl">
          <h3 className="text-base sm:text-lg font-medium text-[#ede8df]">{video.title}</h3>
          {video.description && (
            <p className="mt-2 text-xs sm:text-sm text-[#726d6c] line-clamp-2">{video.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-[#726d6c]">
            {video.duration && <span>Duration: {video.duration}</span>}
            {video.type && <span className="capitalize">{video.type}</span>}
            {video.artist_name && <span>{video.artist_name}</span>}
          </div>
          {/* Linked music */}
          {(video.track_title || video.album_title) && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-[#726d6c]">🎵</span>
              {video.track_title && (
                <span className="text-[#ede8df]">{video.track_title}</span>
              )}
              {video.track_title && video.album_title && (
                <span className="text-[#726d6c]">•</span>
              )}
              {video.album_title && (
                <span className="text-[#726d6c]">{video.album_title}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to parse deployment details from video
function parseDeploymentDetails(deploymentDetails: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!deploymentDetails) return map;

  const entries = deploymentDetails.split(',');
  for (const entry of entries) {
    const [platform, status] = entry.split(':');
    if (platform && status) {
      map.set(platform.toLowerCase(), status);
    }
  }
  return map;
}

// Platform status indicator
function PlatformStatus({
  platform,
  deploymentStatus,
  platformUrl,
  icon
}: {
  platform: string;
  deploymentStatus?: string;
  platformUrl?: string | null;
  icon: React.ReactNode;
}) {
  const isPublished = deploymentStatus === 'published' && !!platformUrl;
  const isPending = deploymentStatus === 'pending' || deploymentStatus === 'scheduled';
  const isFailed = deploymentStatus === 'failed';

  return (
    <a
      href={platformUrl || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
        isPublished
          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 ring-2 ring-green-500/50'
          : isPending
          ? 'bg-yellow-500/20 text-yellow-400'
          : isFailed
          ? 'bg-red-500/20 text-red-400'
          : 'bg-white/5 text-[#726d6c]'
      }`}
      title={`${platform}: ${isPublished ? 'Published' : isPending ? 'Pending' : isFailed ? 'Failed' : 'Not posted'}`}
      onClick={(e) => !platformUrl && e.preventDefault()}
    >
      {icon}
    </a>
  );
}

// Video card component
function VideoCard({
  video,
  children,
  isExpanded,
  onToggleExpand,
  onSelect,
  isSelected,
  editingId,
  editTitle,
  onStartEdit,
  onEditChange,
  onSaveTitle,
  onTogglePublish,
  isTogglingPublish,
  onDelete,
  onDeploy,
  onOpenModal,
}: {
  video: Video;
  children?: Video[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSelect?: (id: number) => void;
  isSelected?: boolean;
  editingId?: number | null;
  editTitle?: string;
  onStartEdit?: (id: number, title: string) => void;
  onEditChange?: (value: string) => void;
  onSaveTitle?: (id: number) => void;
  onTogglePublish?: (id: number, currentlyPublished: boolean) => void;
  isTogglingPublish?: boolean;
  onDelete?: (id: number) => void;
  onDeploy?: (id: number) => void;
  onOpenModal?: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const hasChildren = children && children.length > 0;
  const isClip = video.parent_video_id !== null;
  const isPublished = video.is_public === 1 || video.publication_status === 'live';
  // Use deployment_count from video_deployments table, fall back to old flat columns
  const isDeployed = (video.deployment_count && video.deployment_count > 0) ||
    !!(video.youtube_url || video.youtube_shorts_url || video.tiktok_url || video.instagram_reels_url);

  return (
    <div className={`rounded-xl ${isClip ? 'ml-8' : ''}`}>
      <div className={`p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 ${
        isSelected ? 'bg-[#843c2d]/20' : 'bg-[#1a1816] hover:bg-[#1f1c1a]'
      } transition-colors`}>
        {/* Top row on mobile: checkbox, expand, thumbnail, and info */}
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          {/* Selection checkbox - disabled for already-deployed videos */}
          {onSelect && (
            <button
              onClick={() => !isDeployed && onSelect(video.id)}
              disabled={isDeployed}
              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                isDeployed
                  ? 'opacity-40 cursor-not-allowed border-[#502d26]/30'
                  : isSelected
                    ? 'bg-[#843c2d] border-[#843c2d] text-white'
                    : 'border-[#502d26]/50 hover:border-[#843c2d]'
              }`}
              title={isDeployed ? 'Already deployed - cannot select' : undefined}
            >
              {isSelected && Icons.check}
            </button>
          )}

          {/* Expand/collapse for parents */}
          {hasChildren ? (
            <button
              onClick={onToggleExpand}
              className="w-6 h-6 flex items-center justify-center text-[#726d6c] hover:text-[#ede8df] transition-colors flex-shrink-0"
            >
              {isExpanded ? Icons.expand : Icons.collapse}
            </button>
          ) : (
            <div className="w-6 flex-shrink-0" />
          )}

          {/* Thumbnail */}
          <div className="w-12 h-9 md:w-16 md:h-10 rounded-lg overflow-hidden bg-[#0d0c0a] flex-shrink-0">
            {video.poster_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.poster_url}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#502d26]/30 via-[#502d26]/10 to-[#0d0c0a] border border-[#502d26]/20">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-[#502d26]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <div className="absolute bottom-0.5 right-0.5 text-[8px] md:text-[9px] text-[#726d6c] leading-none">
                  ...
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
              {editingId === video.id ? (
                <input
                  type="text"
                  value={editTitle || ''}
                  onChange={(e) => onEditChange?.(e.target.value)}
                  onBlur={() => onSaveTitle?.(video.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveTitle?.(video.id);
                    if (e.key === 'Escape') onSaveTitle?.(video.id);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-b border-[#843c2d] text-sm text-[#ede8df] outline-none w-full max-w-[200px] md:max-w-none"
                />
              ) : (
                <h3
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit?.(video.id, video.title || '');
                  }}
                  className="text-sm font-medium text-[#ede8df] truncate cursor-pointer hover:text-[#b2a491] transition-colors"
                  title="Click to edit title"
                >
                  {video.title || 'Untitled'}
                </h3>
              )}
              {isClip && video.clip_index && video.total_siblings && (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#502d26]/30 text-[#b2a491] flex-shrink-0">
                  Clip {video.clip_index} of {video.total_siblings}
                </span>
              )}
            </div>
            {video.original_filename && (
              <p className="text-xs text-[#726d6c] truncate mt-0.5">
                {video.original_filename}
              </p>
            )}
          </div>
        </div>

        {/* Bottom row on mobile: actions and status */}
        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-3">
          {/* Status indicators - stack vertically on mobile */}
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
            {/* Publish toggle - only for parent videos */}
            {!isClip && onTogglePublish && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePublish(video.id, isPublished);
                }}
                disabled={isTogglingPublish}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isPublished
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-white/5 text-[#726d6c] hover:bg-white/10 hover:text-[#b2a491]'
                } ${isTogglingPublish ? 'opacity-50' : ''}`}
                title={isPublished ? 'Published - Click to unpublish' : 'Unpublished - Click to publish'}
              >
                {isPublished ? Icons.globe : Icons.eyeOff}
                <span className="hidden sm:inline">{isPublished ? 'Live' : 'Draft'}</span>
              </button>
            )}

            {/* Clip publication status badge (inherits from parent) */}
            {isClip && (
              <span className={`px-2 py-1 rounded-lg text-xs ${
                isPublished
                  ? 'bg-green-500/10 text-green-400/70'
                  : 'bg-white/5 text-[#726d6c]'
              }`}>
                {isPublished ? 'Live' : 'Draft'}
              </span>
            )}

            {/* Format badge - show video source format */}
            {video.source_format === 'mp4' ? (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/20 border border-green-500/30">
                <svg className="w-3 h-3 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-[10px] md:text-xs text-green-400 font-medium">Native MP4</span>
              </div>
            ) : video.source_format ? (
              <div className="px-2 py-1 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                <span className="text-[10px] md:text-xs text-yellow-400 font-medium">{video.source_format.toUpperCase()}</span>
              </div>
            ) : null}

            {/* Deploy button - only for published content */}
            {isPublished && onDeploy && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeploy(video.id);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isDeployed
                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    : 'bg-[#843c2d]/20 text-[#b2a491] hover:bg-[#843c2d]/30'
                }`}
                title={isDeployed ? 'Deployed - Click to manage' : 'Click to deploy to socials'}
              >
                {Icons.rocket}
                <span className="hidden sm:inline">{isDeployed ? 'Deployed' : 'Deploy'}</span>
              </button>
            )}
          </div>

          {/* Platform statuses and actions */}
          <div className="flex items-center gap-1 md:gap-1">
            <div className="flex items-center gap-1">
              {(() => {
                const deployments = parseDeploymentDetails(video.deployment_details || null);
                return (
                  <>
                    <PlatformStatus
                      platform="YouTube"
                      deploymentStatus={deployments.get('youtube')}
                      platformUrl={isClip ? video.youtube_shorts_url : video.youtube_url}
                      icon={Icons.youtube}
                    />
                    <PlatformStatus
                      platform="TikTok"
                      deploymentStatus={deployments.get('tiktok')}
                      platformUrl={video.tiktok_url}
                      icon={Icons.tiktok}
                    />
                    <PlatformStatus
                      platform="Instagram"
                      deploymentStatus={deployments.get('instagram')}
                      platformUrl={video.instagram_reels_url}
                      icon={Icons.instagram}
                    />
                  </>
                );
              })()}
            </div>

            {/* Actions menu */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(!showActions);
                }}
                className="p-2 rounded-lg bg-white/5 text-[#726d6c] hover:bg-white/10 hover:text-[#ede8df] transition-colors"
              >
                {Icons.moreVertical}
              </button>
              {showActions && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowActions(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-[100] bg-[#1a1816] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartEdit?.(video.id, video.title || '');
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#ede8df] hover:bg-white/5 transition-colors"
                    >
                      {Icons.edit}
                      <span>Edit Title</span>
                    </button>
                    {onOpenModal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenModal();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#ede8df] hover:bg-white/5 transition-colors"
                      >
                        {Icons.image}
                        <span>Edit Details & Thumbnail</span>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${video.title}"? This cannot be undone.`)) {
                            onDelete(video.id);
                          }
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        {Icons.trash}
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Library View
function LibraryView({
  videos,
  loading,
  onRefresh,
  selectedIds,
  onSelect,
  onStartDeploy,
  onVideoClick,
}: {
  videos: Video[];
  loading: boolean;
  onRefresh: () => void;
  selectedIds: number[];
  onSelect: (id: number) => void;
  onStartDeploy: (videoId: number) => void;
  onVideoClick?: (video: Video) => void;
}) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [togglingPublishId, setTogglingPublishId] = useState<number | null>(null);
  const [reorderingParentId, setReorderingParentId] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Handle publish toggle
  const handleTogglePublish = async (videoId: number, currentlyPublished: boolean) => {
    setTogglingPublishId(videoId);
    try {
      await fetch(`/api/videos/${videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: !currentlyPublished }),
      });
      onRefresh(); // Refresh to show updated status (includes clips)
    } catch (error) {
      console.error('Failed to toggle publish status:', error);
    } finally {
      setTogglingPublishId(null);
    }
  };

  // Handle delete
  const handleDelete = async (videoId: number) => {
    try {
      const res = await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json() as { error?: string };
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete video:', error);
      alert('Failed to delete video');
    }
  };

  // Handle sync from Cloudflare Stream
  const handleSyncFromStream = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/arsenal/sync-from-stream', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.synced > 0) {
        setSyncMessage(`✓ Synced ${data.synced} video${data.synced !== 1 ? 's' : ''} from Cloudflare Stream`);
        onRefresh();
      } else if (data.error) {
        setSyncMessage(`✗ Error: ${data.error}`);
      } else {
        setSyncMessage('✓ All videos already synced');
      }
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (error) {
      console.error('Failed to sync from Stream:', error);
      setSyncMessage('✗ Failed to sync. Check console for details.');
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setSyncing(false);
    }
  };

  // Handle clip reorder within parent video
  const handleReorderClip = async (parentId: number, clips: Video[], fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= clips.length) return;

    setReorderingParentId(parentId);

    // Create new order
    const newClips = [...clips];
    [newClips[fromIndex], newClips[toIndex]] = [newClips[toIndex], newClips[fromIndex]];
    const clipIds = newClips.map(c => c.id);

    try {
      await fetch('/api/arsenal/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, clipIds }),
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to reorder clips:', error);
    } finally {
      setReorderingParentId(null);
    }
  };

  // Inline title editing handlers
  const handleStartEdit = (id: number, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveTitle = async (videoId: number) => {
    if (editingId === null) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditingId(null);
      return;
    }

    try {
      await fetch('/api/arsenal/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, title: trimmedTitle }),
      });
      onRefresh(); // Refresh list to show updated title
    } catch (error) {
      console.error('Failed to update title:', error);
    }
    setEditingId(null);
  };

  // Organize videos into hierarchy
  const parentVideos = videos.filter(v => !v.parent_video_id);
  const allClips = videos.filter(v => v.parent_video_id !== null);
  const childrenByParent = videos.reduce((acc, v) => {
    if (v.parent_video_id) {
      if (!acc[v.parent_video_id]) acc[v.parent_video_id] = [];
      acc[v.parent_video_id].push(v);
    }
    return acc;
  }, {} as Record<number, Video[]>);

  // Sort children by clip_index
  Object.values(childrenByParent).forEach(children => {
    children.sort((a, b) => (a.clip_index || 0) - (b.clip_index || 0));
  });

  // Apply filter - special handling for 'clips' filter
  const isClipsFilter = filter === 'clips';
  const baseVideos = isClipsFilter ? allClips : parentVideos;

  const filteredVideos = baseVideos.filter(v => {
    const isPublished = v.is_public === 1 || v.publication_status === 'live';
    if (filter === 'all') return true;
    if (filter === 'videos') return true; // Already filtered to parents
    if (filter === 'clips') return true; // Already filtered to clips
    if (filter === 'published') return isPublished;
    if (filter === 'unpublished') return !isPublished;
    if (filter === 'deployed') return v.youtube_url || v.youtube_shorts_url || v.tiktok_url || v.instagram_reels_url;
    if (filter === 'not-deployed') return !v.youtube_url && !v.youtube_shorts_url && !v.tiktok_url && !v.instagram_reels_url;
    return true;
  });

  // Get IDs of all visible items for Select All
  const visibleIds = filteredVideos.map(v => v.id);

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/videos/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        // Clear selection after delete
        selectedIds.forEach(id => onSelect(id)); // Toggle off each selected
        onRefresh();
      } else {
        const data = await res.json() as { error?: string };
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Failed to delete videos');
    } finally {
      setBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  // Select all visible items
  const handleSelectAll = () => {
    visibleIds.forEach(id => {
      if (!selectedIds.includes(id)) {
        onSelect(id);
      }
    });
  };

  // Clear all selections
  const handleClearSelection = () => {
    selectedIds.forEach(id => onSelect(id));
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Filters row - stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'videos', 'clips', 'published', 'unpublished', 'deployed', 'not-deployed'] as FilterMode[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-xs rounded-lg transition-colors ${
                  filter === f
                    ? 'bg-[#843c2d]/30 text-[#ede8df]'
                    : 'bg-white/5 text-[#726d6c] hover:bg-white/10'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleSyncFromStream}
              disabled={syncing || loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#843c2d]/20 text-[#ede8df] hover:bg-[#843c2d]/30 transition-colors disabled:opacity-50"
              title="Sync videos from Cloudflare Stream"
            >
              {syncing ? '⟳ Syncing...' : '⟳ Sync Stream'}
            </button>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-[#726d6c] hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Sync Message */}
        {syncMessage && (
          <div className={`px-3 py-2 text-xs rounded-lg ${
            syncMessage.startsWith('✓') 
              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {syncMessage}
          </div>
        )}

        {/* Selection actions row - stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSelectAll}
              disabled={visibleIds.length === 0}
              className="px-2.5 py-1.5 md:px-3 md:py-1.5 text-xs rounded-lg bg-white/5 text-[#726d6c] hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Select All ({visibleIds.length})
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 md:px-3 md:py-1.5 text-xs rounded-lg bg-white/5 text-[#726d6c] hover:bg-white/10 transition-colors"
              >
                Clear
              </button>
            )}
            {selectedIds.length > 0 && (
              <span className="text-xs text-[#726d6c] ml-2">
                {selectedIds.length} selected
              </span>
            )}
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkDeleting}
              className="px-2.5 py-1.5 md:px-3 md:py-1.5 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-auto"
            >
              {Icons.trash}
              Delete Selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1816] rounded-xl p-4 sm:p-6 w-full sm:max-w-md border border-white/10">
            <h3 className="text-lg font-medium text-[#ede8df] mb-2">Delete {selectedIds.length} items?</h3>
            <p className="text-sm text-[#726d6c] mb-6">
              This will permanently delete the selected {filter === 'clips' ? 'clips' : 'videos'} from your library and Cloudflare Stream. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm rounded-lg bg-white/5 text-[#ede8df] hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.length} items`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-12 text-[#726d6c]">
            No videos found. Upload content to get started.
          </div>
        ) : (
          filteredVideos.map(video => (
            <div key={video.id}>
              <VideoCard
                video={video}
                children={isClipsFilter ? undefined : childrenByParent[video.id]}
                isExpanded={!isClipsFilter && expandedIds.includes(video.id)}
                onToggleExpand={isClipsFilter ? undefined : () => toggleExpand(video.id)}
                onSelect={onSelect}
                isSelected={selectedIds.includes(video.id)}
                editingId={editingId}
                editTitle={editTitle}
                onStartEdit={handleStartEdit}
                onEditChange={setEditTitle}
                onSaveTitle={handleSaveTitle}
                onTogglePublish={handleTogglePublish}
                isTogglingPublish={togglingPublishId === video.id}
                onDelete={handleDelete}
                onDeploy={onStartDeploy}
                onOpenModal={() => onVideoClick?.(video)}
              />
              {/* Child clips with reorder controls - only show when not in clips filter */}
              {!isClipsFilter && expandedIds.includes(video.id) && childrenByParent[video.id]?.map((child, index) => {
                const siblings = childrenByParent[video.id];
                const isReordering = reorderingParentId === video.id;
                return (
                  <div key={child.id} className="flex items-center gap-1">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5 ml-8">
                      <button
                        onClick={() => handleReorderClip(video.id, siblings, index, 'up')}
                        disabled={index === 0 || isReordering}
                        className="p-1 rounded bg-white/5 text-[#726d6c] hover:text-[#ede8df] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move clip up"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleReorderClip(video.id, siblings, index, 'down')}
                        disabled={index === siblings.length - 1 || isReordering}
                        className="p-1 rounded bg-white/5 text-[#726d6c] hover:text-[#ede8df] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move clip down"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1">
                      <VideoCard
                        video={child}
                        onSelect={onSelect}
                        isSelected={selectedIds.includes(child.id)}
                        editingId={editingId}
                        editTitle={editTitle}
                        onStartEdit={handleStartEdit}
                        onEditChange={setEditTitle}
                        onSaveTitle={handleSaveTitle}
                        onDelete={handleDelete}
                        onDeploy={onStartDeploy}
                        onOpenModal={() => onVideoClick?.(child)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Generate hashtags from video metadata
function generateHashtags(video: Video): string[] {
  const tags: string[] = [];

  if (video.category) {
    tags.push(video.category.toLowerCase().replace(/\s+/g, ''));
  }
  if (video.mood) {
    tags.push(video.mood.toLowerCase().replace(/\s+/g, ''));
  }
  if (video.type) {
    tags.push(video.type.toLowerCase().replace(/\s+/g, ''));
  }
  if (video.artist_name) {
    tags.push(video.artist_name.toLowerCase().replace(/\s+/g, ''));
  }

  // Common music tags
  tags.push('music', 'newmusic');

  return [...new Set(tags)]; // Dedupe
}

// Character count indicator
function CharCount({ current, max, label }: { current: number; max: number; label?: string }) {
  const percentage = (current / max) * 100;
  const isOver = current > max;
  const isNear = percentage > 80;

  return (
    <span className={`text-xs ${
      isOver ? 'text-red-400' : isNear ? 'text-yellow-400' : 'text-[#726d6c]'
    }`}>
      {label && `${label}: `}{current}/{max}
    </span>
  );
}

// Collapsible platform settings section
function PlatformSettingsSection({
  platform,
  icon,
  isSelected,
  isExpanded,
  onToggle,
  children,
}: {
  platform: string;
  icon: React.ReactNode;
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (!isSelected) return null;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-[#ede8df]">{platform} Settings</span>
        </div>
        <svg
          className={`w-4 h-4 text-[#726d6c] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="p-4 space-y-4 bg-white/[0.02]">
          {children}
        </div>
      )}
    </div>
  );
}

// Deploy View
function DeployView({
  videos,
  selectedIds,
  onDeploy,
  deploying,
}: {
  videos: Video[];
  selectedIds: number[];
  onDeploy: (platforms: string[], scheduleAt?: string, metadata?: DeployMetadata, wodaGenerationId?: number | null) => void;
  deploying: boolean;
}) {
  const [platforms, setPlatforms] = useState<string[]>(['youtube', 'tiktok', 'instagram']);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Metadata state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [includeCredits, setIncludeCredits] = useState(true);

  // Platform-specific settings
  const [youtubeSettings, setYoutubeSettings] = useState({
    madeForKids: false,
    category: '10', // Music
    asShort: false,
  });
  const [tiktokSettings, setTiktokSettings] = useState({
    allowDuet: true,
    allowStitch: true,
    allowComments: true,
  });
  const [instagramSettings, setInstagramSettings] = useState({
    shareToFeed: true,
  });

  // Track which platform sections are expanded
  const [expandedPlatforms, setExpandedPlatforms] = useState<string[]>([]);

  // Video preview state
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);

  // Woda AI state
  const [wodaLoading, setWodaLoading] = useState(false);
  const [wodaGenerationId, setWodaGenerationId] = useState<number | null>(null);

  const selectedVideos = videos.filter(v => selectedIds.includes(v.id));
  const isClip = selectedVideos.some(v => v.parent_video_id !== null);

  // Toggle platform settings expansion
  const togglePlatformExpand = (platform: string) => {
    setExpandedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  // Ask Woda to generate metadata
  const askWoda = async () => {
    if (selectedVideos.length === 0) return;

    setWodaLoading(true);
    try {
      const firstVideo = selectedVideos[0];
      const videoIsClip = firstVideo.parent_video_id !== null;

      const res = await fetch('/api/arsenal/woda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: firstVideo.id,
          platforms,
          contentType: videoIsClip ? 'clip' : 'video',
        }),
      });

      if (res.ok) {
        const data = await res.json() as {
          title?: string;
          description?: string;
          hashtags?: string[];
          firstComment?: string;
          generationId?: number;
        };
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.hashtags) setHashtags(data.hashtags);
        if (data.firstComment) setFirstComment(data.firstComment);
        if (data.generationId) setWodaGenerationId(data.generationId);
      }
    } catch (error) {
      console.error('Woda generation failed:', error);
    } finally {
      setWodaLoading(false);
    }
  };

  // Pre-populate metadata when selection changes
  useEffect(() => {
    if (selectedVideos.length > 0) {
      const firstVideo = selectedVideos[0];
      const videoIsClip = firstVideo.parent_video_id !== null;

      // Use saved social metadata or fall back to video metadata
      setTitle(firstVideo.title || '');
      setDescription(firstVideo.social_description || firstVideo.description || '');
      setFirstComment(firstVideo.social_first_comment || '');
      setVisibility((firstVideo.social_visibility as 'public' | 'unlisted' | 'private') || 'public');

      // Parse saved hashtags or generate new ones
      if (firstVideo.social_hashtags) {
        try {
          setHashtags(JSON.parse(firstVideo.social_hashtags));
        } catch {
          setHashtags(generateHashtags(firstVideo));
        }
      } else {
        setHashtags(generateHashtags(firstVideo));
      }

      // Auto-set YouTube Shorts based on clip status
      setYoutubeSettings(prev => ({
        ...prev,
        asShort: videoIsClip,
      }));
    }
  }, [selectedIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlatform = (platform: string) => {
    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags(prev => [...prev, tag]);
      setHashtagInput('');
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(prev => prev.filter(t => t !== tag));
  };

  const handleDeploy = () => {
    // Convert schedule date/time to ISO string (browser local timezone)
    let scheduleAt: string | undefined = undefined;
    if (scheduleDate && scheduleTime) {
      // Construct ISO datetime string from local date/time inputs
      const localDateTime = `${scheduleDate}T${scheduleTime}:00`;
      const dateObj = new Date(localDateTime);
      
      // Validate that the date is valid and in the future
      if (isNaN(dateObj.getTime())) {
        console.error('[Arsenal] Invalid schedule date/time:', scheduleDate, scheduleTime);
        alert('Invalid schedule date or time. Please check your input.');
        return;
      }
      
      const now = new Date();
      if (dateObj <= now) {
        console.warn('[Arsenal] Schedule date is in the past, will post immediately');
        // Allow it, but log warning
      }
      
      scheduleAt = dateObj.toISOString();
      console.log('[Arsenal] Schedule:', {
        localInput: localDateTime,
        isoString: scheduleAt,
        browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    const metadata: DeployMetadata = {
      title,
      description,
      firstComment,
      hashtags,
      visibility,
      includeCredits,
      // Only include platform settings if that platform is selected
      ...(platforms.includes('youtube') && { youtube: youtubeSettings }),
      ...(platforms.includes('tiktok') && { tiktok: tiktokSettings }),
      ...(platforms.includes('instagram') && { instagram: instagramSettings }),
    };

    onDeploy(platforms, scheduleAt, metadata, wodaGenerationId);
  };

  return (
    <div className="space-y-6">
      {/* Selected content */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">
          Selected Content ({selectedVideos.length})
          {isClip && <span className="text-[#726d6c] ml-2">(Clips)</span>}
        </h3>
        {selectedVideos.length === 0 ? (
          <div className="p-4 rounded-xl bg-white/5 text-center text-[#726d6c] text-sm">
            Select content from the Library to deploy
          </div>
        ) : (
          <div className="space-y-2">
            {/* Collapsible video preview */}
            {previewVideo && (
              <div className="rounded-xl bg-[#0d0c0a] overflow-hidden">
                <div className="aspect-video relative">
                  <iframe
                    src={`https://iframe.videodelivery.net/${previewVideo.uid}?autoplay=true`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-3 flex items-center justify-between bg-white/5">
                  <span className="text-sm text-[#ede8df] truncate">{previewVideo.title}</span>
                  <button
                    onClick={() => setPreviewVideo(null)}
                    className="text-xs text-[#726d6c] hover:text-[#ede8df] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Video list */}
            <div className={`space-y-1 ${previewVideo ? 'max-h-24' : 'max-h-32'} overflow-y-auto`}>
              {selectedVideos.map(v => (
                <button
                  key={v.id}
                  onClick={() => setPreviewVideo(previewVideo?.id === v.id ? null : v)}
                  className={`w-full p-2 rounded-lg flex items-center gap-3 transition-colors ${
                    previewVideo?.id === v.id
                      ? 'bg-[#843c2d]/20'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="w-10 h-6 rounded bg-[#0d0c0a] overflow-hidden flex-shrink-0">
                    {v.poster_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.poster_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <span className="text-sm text-[#ede8df] truncate flex-1 text-left">{v.title}</span>
                  {v.clip_index && (
                    <span className="text-xs text-[#726d6c]">#{v.clip_index}</span>
                  )}
                  <svg
                    className={`w-3 h-3 text-[#726d6c] transition-transform ${
                      previewVideo?.id === v.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Platform selection */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Deploy to Platforms</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { id: 'youtube', name: 'YouTube', icon: Icons.youtube },
            { id: 'tiktok', name: 'TikTok', icon: Icons.tiktok },
            { id: 'instagram', name: 'Instagram', icon: Icons.instagram },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                platforms.includes(p.id)
                  ? 'bg-[#843c2d]/30 text-[#ede8df] border border-[#843c2d]/50'
                  : 'bg-white/5 text-[#726d6c] border border-transparent hover:bg-white/10'
              }`}
            >
              {p.icon}
              <span className="text-sm">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Metadata Section */}
      {selectedVideos.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#ede8df]">Post Details</h3>
            <button
              onClick={askWoda}
              disabled={wodaLoading || selectedVideos.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-[#502d26] to-[#843c2d] text-[#ede8df] hover:opacity-90 transition-all disabled:opacity-50"
            >
              {wodaLoading ? (
                <>
                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-4 9a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"/>
                  </svg>
                  Ask Woda
                </>
              )}
            </button>
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[#726d6c]">Title</label>
              {platforms.includes('youtube') && (
                <CharCount current={title.length} max={CHAR_LIMITS.youtube.title} label="YT" />
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[#726d6c]">Description / Caption</label>
              <div className="flex gap-3">
                {platforms.includes('youtube') && (
                  <CharCount current={description.length} max={CHAR_LIMITS.youtube.description} label="YT" />
                )}
                {(platforms.includes('tiktok') || platforms.includes('instagram')) && (
                  <CharCount
                    current={description.length + (hashtags.length > 0 ? ' ' + hashtags.map(t => `#${t}`).join(' ') : '').length}
                    max={CHAR_LIMITS.tiktok.caption}
                    label="TT/IG"
                  />
                )}
              </div>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers about your video..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 resize-none"
            />
          </div>

          {/* First Comment */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[#726d6c]">First Comment (links, credits)</label>
              {platforms.includes('instagram') && (
                <CharCount current={firstComment.length} max={CHAR_LIMITS.instagram.firstComment} label="IG" />
              )}
            </div>
            <textarea
              value={firstComment}
              onChange={(e) => setFirstComment(e.target.value)}
              placeholder="🛒 Shop: https://odubo.studio/store&#10;🎵 Stream: https://..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 resize-none"
            />
          </div>

          {/* Hashtags (for clips/shorts) */}
          {isClip && (
            <div>
              <label className="text-xs text-[#726d6c] mb-1 block">Hashtags (Shorts/Reels/TikTok)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {hashtags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs rounded-lg bg-[#843c2d]/20 text-[#ede8df] flex items-center gap-1"
                  >
                    #{tag}
                    <button
                      onClick={() => removeHashtag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
                  placeholder="Add hashtag..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
                />
                <button
                  onClick={addHashtag}
                  className="px-3 py-2 rounded-xl bg-white/5 text-[#726d6c] hover:bg-white/10 transition-colors text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Include Credits Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm text-[#ede8df]">Include Credits</label>
              <p className="text-xs text-[#726d6c]">Append video credits to description</p>
            </div>
            <button
              onClick={() => setIncludeCredits(!includeCredits)}
              className={`w-12 h-6 rounded-full transition-colors ${
                includeCredits ? 'bg-[#843c2d]' : 'bg-white/10'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                includeCredits ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-xs text-[#726d6c] mb-2 block">Visibility</label>
            <div className="flex gap-3">
              {(['public', 'unlisted', 'private'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    visibility === v
                      ? 'bg-[#843c2d]/30 text-[#ede8df]'
                      : 'bg-white/5 text-[#726d6c] hover:bg-white/10'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Platform-Specific Settings */}
          {platforms.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h4 className="text-xs text-[#726d6c] uppercase tracking-wider">Platform Settings</h4>

              {/* YouTube Settings */}
              <PlatformSettingsSection
                platform="YouTube"
                icon={Icons.youtube}
                isSelected={platforms.includes('youtube')}
                isExpanded={expandedPlatforms.includes('youtube')}
                onToggle={() => togglePlatformExpand('youtube')}
              >
                {/* Made for Kids */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm text-[#ede8df]">Made for Kids</label>
                    <p className="text-xs text-[#726d6c]">Required by YouTube (COPPA)</p>
                  </div>
                  <button
                    onClick={() => setYoutubeSettings(prev => ({ ...prev, madeForKids: !prev.madeForKids }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      youtubeSettings.madeForKids ? 'bg-[#843c2d]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      youtubeSettings.madeForKids ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs text-[#726d6c] mb-1 block">Category</label>
                  <select
                    value={youtubeSettings.category}
                    onChange={(e) => setYoutubeSettings(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
                  >
                    {YOUTUBE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Upload as Short */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm text-[#ede8df]">Upload as Short</label>
                    <p className="text-xs text-[#726d6c]">
                      {isClip ? 'Recommended for clips (≤60s, vertical)' : 'For vertical videos ≤60 seconds'}
                    </p>
                  </div>
                  <button
                    onClick={() => setYoutubeSettings(prev => ({ ...prev, asShort: !prev.asShort }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      youtubeSettings.asShort ? 'bg-[#843c2d]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      youtubeSettings.asShort ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </PlatformSettingsSection>

              {/* TikTok Settings */}
              <PlatformSettingsSection
                platform="TikTok"
                icon={Icons.tiktok}
                isSelected={platforms.includes('tiktok')}
                isExpanded={expandedPlatforms.includes('tiktok')}
                onToggle={() => togglePlatformExpand('tiktok')}
              >
                {/* Allow Duet */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-[#ede8df]">Allow Duet</label>
                  <button
                    onClick={() => setTiktokSettings(prev => ({ ...prev, allowDuet: !prev.allowDuet }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      tiktokSettings.allowDuet ? 'bg-[#843c2d]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      tiktokSettings.allowDuet ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Allow Stitch */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-[#ede8df]">Allow Stitch</label>
                  <button
                    onClick={() => setTiktokSettings(prev => ({ ...prev, allowStitch: !prev.allowStitch }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      tiktokSettings.allowStitch ? 'bg-[#843c2d]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      tiktokSettings.allowStitch ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Allow Comments */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-[#ede8df]">Allow Comments</label>
                  <button
                    onClick={() => setTiktokSettings(prev => ({ ...prev, allowComments: !prev.allowComments }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      tiktokSettings.allowComments ? 'bg-[#843c2d]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      tiktokSettings.allowComments ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </PlatformSettingsSection>

              {/* Instagram Settings */}
              <PlatformSettingsSection
                platform="Instagram"
                icon={Icons.instagram}
                isSelected={platforms.includes('instagram')}
                isExpanded={expandedPlatforms.includes('instagram')}
                onToggle={() => togglePlatformExpand('instagram')}
              >
                {/* Share to Feed */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm text-[#ede8df]">Share to Feed</label>
                    <p className="text-xs text-[#726d6c]">Also show Reel in your main feed grid</p>
                  </div>
                  <button
                    onClick={() => setInstagramSettings(prev => ({ ...prev, shareToFeed: !prev.shareToFeed }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      instagramSettings.shareToFeed ? 'bg-[#843c2d]' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      instagramSettings.shareToFeed ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </PlatformSettingsSection>
            </div>
          )}
        </div>
      )}

      {/* Schedule */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Schedule (Optional)</h3>
        <div className="flex gap-3">
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
            min={new Date().toISOString().split('T')[0]}
          />
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50"
          />
        </div>
        <p className="text-xs text-[#726d6c] mt-2">
          {scheduleDate && scheduleTime ? (
            <>Scheduled for {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</>
          ) : (
            <>Leave empty to queue for immediate posting via Post for Me</>
          )}
        </p>
      </div>

      {/* Deploy button */}
      <button
        onClick={handleDeploy}
        disabled={selectedVideos.length === 0 || platforms.length === 0 || deploying}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      >
        {deploying ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Deploying...
          </span>
        ) : (
          `Load Magazine (${selectedVideos.length} items)`
        )}
      </button>

    </div>
  );
}

// Sync View
// Poster Upload View
function PostersView({ videos }: { videos: Video[] }) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetVideoRef = useRef<number | null>(null);

  // Parent videos only
  const parentVideos = videos
    .filter(v => v.parent_video_id === null)
    .sort((a, b) => a.id - b.id);

  const handleUpload = async (videoId: number) => {
    targetVideoRef.current = videoId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const videoId = targetVideoRef.current;
    if (!file || !videoId) return;

    // Reset input
    e.target.value = '';

    setUploading(videoId);
    setMessage(null);

    try {
      // Step 1: Get presigned URL
      const urlRes = await fetch('/api/arsenal/upload-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, fileName: file.name }),
      });

      if (!urlRes.ok) {
        const err = await urlRes.json() as { error?: string };
        throw new Error(err.error || 'Failed to get upload URL');
      }

      const { uploadUrl, publicUrl } = await urlRes.json() as { uploadUrl: string; publicUrl: string };

      // Step 2: Upload file to R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'image/jpeg' },
      });

      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`);
      }

      // Step 3: Confirm upload
      const confirmRes = await fetch('/api/arsenal/upload-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, publicUrl, confirm: true }),
      });

      if (!confirmRes.ok) {
        throw new Error('Failed to save poster URL');
      }

      setMessage(`Poster uploaded for video ${videoId}`);

      // Update local video data
      const video = parentVideos.find(v => v.id === videoId);
      if (video) video.poster_url = publicUrl;
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[#ede8df]">Poster Images</h3>
        <span className="text-xs text-[#726d6c]">
          {parentVideos.filter(v => v.poster_url).length}/{parentVideos.length} uploaded
        </span>
      </div>

      {message && (
        <div className={`px-3 py-2 rounded-lg text-xs ${
          message.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {parentVideos.map(video => (
          <div
            key={video.id}
            className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
          >
            {/* Poster preview */}
            <div className="aspect-[2/3] bg-black/30 relative">
              {video.poster_url ? (
                <img
                  src={video.poster_url}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#726d6c]">
                  <span className="text-xs">No poster</span>
                </div>
              )}
            </div>

            {/* Info + upload button */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#ede8df] truncate">{video.title}</p>
                <p className="text-[10px] text-[#726d6c]">
                  ID {video.id} {video.poster_url ? '(has poster)' : ''}
                </p>
              </div>
              <button
                onClick={() => handleUpload(video.id)}
                disabled={uploading === video.id}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-white/5 text-[#b2a491] hover:bg-white/10 disabled:opacity-50"
              >
                {uploading === video.id ? 'Uploading...' : video.poster_url ? 'Replace' : 'Upload'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncView({
  onSync,
  syncing,
  lastSyncTime,
  syncLog,
}: {
  onSync: () => void;
  syncing: boolean;
  lastSyncTime: string | null;
  syncLog: string[];
}) {
  return (
    <div className="space-y-6">
      {/* Sync status */}
      <div className="p-4 rounded-xl bg-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#ede8df]">Auto-Backfeed URLs</h3>
          <button
            onClick={onSync}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium transition-all disabled:opacity-50 hover:bg-[#6d3224]"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
        <p className="text-xs text-[#726d6c]">
          Fetches platform URLs from Post for Me for published content.
          {lastSyncTime && (
            <span className="block mt-1">
              Last sync: {new Date(lastSyncTime).toLocaleString()}
            </span>
          )}
        </p>
      </div>

      {/* Sync log */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Sync Log</h3>
        <div className="p-4 rounded-xl bg-[#0d0c0a] font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
          {syncLog.length === 0 ? (
            <span className="text-[#726d6c]">No sync activity yet</span>
          ) : (
            syncLog.map((log, i) => (
              <div key={i} className={`${
                log.includes('ERROR') ? 'text-red-400' :
                log.includes('SUCCESS') ? 'text-green-400' :
                'text-[#b2a491]'
              }`}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual URL entry */}
      <div className="p-4 rounded-xl bg-white/5">
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Manual URL Entry</h3>
        <p className="text-xs text-[#726d6c] mb-3">
          For edge cases where auto-sync doesn&apos;t capture the URL
        </p>
        <div className="text-center text-sm text-[#726d6c] py-4">
          Coming soon - edit URLs directly from Library view
        </div>
      </div>
    </div>
  );
}

// Upload View
function UploadView({
  onUploadComplete,
  videos,
}: {
  onUploadComplete: () => void;
  videos: Video[];
}) {
  const [uploadType, setUploadType] = useState<'video' | 'clip'>('clip');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadFailed, setUploadFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [parentVideoId, setParentVideoId] = useState<number | null>(null);
  const dragFileIndex = useRef<number | null>(null);
  const previousUploadTypeRef = useRef<'video' | 'clip'>('clip');

  // Video metadata fields
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoCredits, setVideoCredits] = useState('');
  const [videoArtist, setVideoArtist] = useState('Mani Odubo');
  const [videoCategory, setVideoCategory] = useState('');
  const [videoMood, setVideoMood] = useState('');
  const [videoType, setVideoType] = useState('music-video');
  
  // Scheduling fields (optional)
  const [uploadScheduleDate, setUploadScheduleDate] = useState('');
  const [uploadScheduleTime, setUploadScheduleTime] = useState('');
  
  // Music linking
  const [linkedTrackId, setLinkedTrackId] = useState<string>('');
  const [linkedAlbumId, setLinkedAlbumId] = useState<string>('');
  const [availableTracks, setAvailableTracks] = useState<Array<{ id: string; title: string; album_id: string }>>([]);
  const [availableAlbums, setAvailableAlbums] = useState<Array<{ id: string; title: string }>>([]);

  // Get parent videos (non-clips)
  const parentVideos = videos.filter(v => v.parent_video_id === null);
  
  // When parent video is selected for clips, fetch and inherit metadata
  useEffect(() => {
    if (uploadType === 'clip' && parentVideoId) {
      const parent = parentVideos.find(v => v.id === parentVideoId);
      if (parent) {
        // Inherit parent metadata
        setVideoTitle(parent.title || '');
        setVideoDescription(parent.description || '');
        setVideoCredits(parent.credits || '');
        setVideoArtist(parent.artist_name || 'ODUBO');
        setVideoCategory(parent.category || '');
        setVideoMood(parent.mood || '');
        setLinkedTrackId(parent.track_id?.toString() || '');
        setLinkedAlbumId(parent.album_id?.toString() || '');
        
        console.log('[Arsenal] Inherited metadata from parent video:', {
          parentId: parent.id,
          title: parent.title,
          description: parent.description,
          trackId: parent.track_id,
          albumId: parent.album_id,
        });
      }
    } else if (uploadType === 'video' && previousUploadTypeRef.current !== 'video') {
      // Reset metadata ONLY when switching from clip to video mode (not on every render)
      setVideoTitle('');
      setVideoDescription('');
      setVideoCredits('');
      setLinkedTrackId('');
      setLinkedAlbumId('');
    }
    
    // Update the ref to track current upload type
    previousUploadTypeRef.current = uploadType;
  }, [uploadType, parentVideoId, videos]);
  
  // Fetch tracks and albums for linking
  useEffect(() => {
    const fetchMusicData = async () => {
      try {
        // Fetch albums
        const albumsRes = await fetch('/api/albums');
        if (albumsRes.ok) {
          const albumsData = await albumsRes.json();
          setAvailableAlbums(albumsData.albums || []);
        }
        
        // Fetch tracks
        const tracksRes = await fetch('/api/tracks');
        if (tracksRes.ok) {
          const tracksData = await tracksRes.json();
          setAvailableTracks(tracksData.tracks || []);
        }
      } catch (error) {
        console.error('Failed to fetch music data:', error);
      }
    };
    fetchMusicData();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      // Auto-populate title from first file name for videos (only if title is empty)
      if (uploadType === 'video' && files.length === 1 && !videoTitle) {
        setVideoTitle(files[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...selectedFiles];
    if (direction === 'up' && index > 0) {
      [newFiles[index], newFiles[index - 1]] = [newFiles[index - 1], newFiles[index]];
    } else if (direction === 'down' && index < newFiles.length - 1) {
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
    }
    setSelectedFiles(newFiles);
  };

  const reorderFiles = (from: number, to: number) => {
    if (from === null || to === null || from === to) return;
    const newFiles = [...selectedFiles];
    const [moved] = newFiles.splice(from, 1);
    newFiles.splice(to, 0, moved);
    setSelectedFiles(newFiles);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (uploadType === 'clip' && !parentVideoId) {
      alert('Please select a parent video for clips');
      return;
    }
    if (uploadType === 'video' && !videoTitle.trim()) {
      alert('Please enter a title for the video');
      return;
    }

    setUploading(true);
    setUploadProgress('Starting upload...');
    setUploadFailed(false);

    try {
      // Get parent video metadata for clips
      let parentArtist = '';
      let parentCategory = '';
      let parentMood = '';
      if (uploadType === 'clip' && parentVideoId) {
        const parent = parentVideos.find(v => v.id === parentVideoId);
        parentArtist = parent?.artist_name || '';
        parentCategory = parent?.category || '';
        parentMood = parent?.mood || '';
      }

      // Track uploaded UIDs for thumbnail generation
      const uploadedUids: string[] = [];
      const uploadedFileSizes: number[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        uploadedFileSizes.push(file.size);

        // Detect video format
        const formatInfo = detectVideoFormat(file);
        console.log('[Arsenal Upload] File format detected:', {
          filename: file.name,
          format: formatInfo.format,
          isMP4: formatInfo.isMP4,
          requiresTranscoding: formatInfo.requiresTranscoding,
        });

        // For clips: use filename. For videos: use entered title (or filename if multiple)
        const title = uploadType === 'clip'
          ? file.name.replace(/\.[^/.]+$/, '')
          : (selectedFiles.length === 1 ? videoTitle : file.name.replace(/\.[^/.]+$/, ''));

        setUploadProgress(`Uploading ${i + 1}/${selectedFiles.length}: ${title}`);

        // 1. Start multipart upload to R2
        const startRes = await fetch('/api/arsenal/multipart-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            filename: file.name,
            contentType: file.type,
          }),
        });

        if (!startRes.ok) {
          const error = await startRes.json();
          throw new Error(`Failed to start upload: ${error.error || 'Unknown error'}`);
        }

        const { uploadId, key } = await startRes.json();

        // 2. Chunk file into 50MB parts
        const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
        const totalParts = Math.ceil(file.size / CHUNK_SIZE);
        const chunks: Blob[] = [];

        for (let partNum = 0; partNum < totalParts; partNum++) {
          const start = partNum * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          chunks.push(file.slice(start, end));
        }

        // 3. Get presigned URLs for all parts
        setUploadProgress(`Preparing ${i + 1}/${selectedFiles.length}: ${title} (${totalParts} parts)`);

        const urlsRes = await fetch('/api/arsenal/multipart-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get-urls',
            uploadId,
            key,
            parts: totalParts,
          }),
        });

        if (!urlsRes.ok) {
          const error = await urlsRes.json();
          throw new Error(`Failed to get upload URLs: ${error.error || 'Unknown error'}`);
        }

        const { urls } = await urlsRes.json();

        // 4. Upload all parts in parallel with progress tracking
        let completedParts = 0;
        const uploadedParts: Array<{ PartNumber: number; ETag: string }> = [];

        const uploadPromises = chunks.map(async (chunk, index) => {
          const partNumber = index + 1;
          const url = urls[index];

          const response = await fetch(url, {
            method: 'PUT',
            body: chunk,
            headers: {
              'Content-Type': file.type,
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to upload part ${partNumber}`);
          }

          const etag = response.headers.get('ETag');
          if (!etag) {
            throw new Error(`No ETag returned for part ${partNumber}`);
          }

          uploadedParts[index] = {
            PartNumber: partNumber,
            ETag: etag.replace(/"/g, ''), // Remove quotes from ETag
          };

          completedParts++;
          const percentage = ((completedParts / totalParts) * 100).toFixed(1);
          setUploadProgress(`Uploading ${i + 1}/${selectedFiles.length}: ${title} (${percentage}%)`);
        });

        await Promise.all(uploadPromises);

        // 5. Complete multipart upload (also copies to Stream)
        setUploadProgress(`Processing ${i + 1}/${selectedFiles.length}: ${title} - finalizing...`);

        const completeRes = await fetch('/api/arsenal/multipart-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            uploadId,
            key,
            parts: uploadedParts,
            filename: file.name,
            source_format: formatInfo.format,
          }),
        });

        if (!completeRes.ok) {
          const error = await completeRes.json();
          // Abort multipart upload on failure
          await fetch('/api/arsenal/multipart-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'abort', uploadId, key }),
          }).catch(console.error);
          throw new Error(`Failed to complete upload: ${error.error || 'Unknown error'}`);
        }

        const { uid, mp4_url, source_format } = await completeRes.json();

        if (!uid || !mp4_url) {
          throw new Error('Failed to get uid and mp4_url from upload');
        }

        // Track UID for thumbnail generation
        uploadedUids.push(uid);

        // 2. Create video/clip record
        // Construct Cloudflare Stream embed URL
        const embedUrl = `https://iframe.videodelivery.net/${uid}`;
        
        // NOTE: Don't set poster_url/thumbnail - let API auto-generate from UID
        // Custom thumbnails will be generated later via polling:
        // - Clips: Random frame extraction (10-90% of duration) → uploaded to R2
        // - Parent videos: AI-powered frame analysis → best shot selected

        if (uploadType === 'clip') {
          // Clips inherit publication status and metadata from parent
          // Thumbnail will be auto-generated when video is ready
          const clipRes = await fetch(`/api/videos/${parentVideoId}/clips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid,
              stream_video_id: uid, // Set both for consistency
              title,
              url: embedUrl,
              mp4_url, // Stream MP4 download URL for PostForMe deployment
              source_format, // Original video format (tracked for reference)
              // Omit poster_url/thumbnail - API will auto-generate from UID
              // Include inherited metadata
              description: videoDescription,
              credits: videoCredits,
              category: videoCategory,
              mood: videoMood,
            })
          });
          
          if (!clipRes.ok) {
            const errorText = await clipRes.text();
            console.error('[Arsenal Upload] Clip creation failed:', errorText);
            throw new Error(`Failed to create clip: ${errorText}`);
          }

          // Capture clip ID
          const createdClip = await clipRes.json();
          console.log('[Arsenal Upload] Clip created:', createdClip);
        } else {
          // Create parent video as unpublished (draft) by default
          // User will explicitly publish when ready
          // Thumbnail will be auto-generated by webhook using AI frame analysis
          
          // Build scheduled_for if date/time provided
          let scheduled_for: string | null = null;
          if (uploadScheduleDate && uploadScheduleTime) {
            const localDateTime = `${uploadScheduleDate}T${uploadScheduleTime}:00`;
            const dateObj = new Date(localDateTime);
            if (!isNaN(dateObj.getTime())) {
              scheduled_for = dateObj.toISOString();
              console.log('[Arsenal Upload] Schedule set:', {
                localInput: localDateTime,
                isoString: scheduled_for,
              });
            }
          }
          
          const createRes = await fetch('/api/videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid,
              stream_video_id: uid, // Set both for consistency
              title,
              url: embedUrl,
              mp4_url, // Stream MP4 download URL for PostForMe deployment
              source_format, // Original video format (tracked for reference)
              // Omit poster_url/thumbnail - API will auto-generate from UID
              description: videoDescription,
              credits: videoCredits,
              artist_name: videoArtist,
              category: videoCategory, // Required for AI thumbnail context
              mood: videoMood,         // Required for AI thumbnail context
              type: videoType,
              track_id: linkedTrackId || null,
              album_id: linkedAlbumId || null,
              scheduled_for,
              is_public: false,
              publication_status: 'archived',
            })
          });
          
          if (!createRes.ok) {
            const errorText = await createRes.text();
            console.error('[Arsenal Upload] Video creation failed:', errorText);
            throw new Error(`Failed to create video: ${errorText}`);
          }

          // Capture video ID
          const createdVideo = await createRes.json();
          console.log('[Arsenal Upload] Video created:', createdVideo);
        }
      }

      // Check if we uploaded a large file (>5GB)
      const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024 * 1024; // 5GB
      const hasLargeFile = uploadedFileSizes.some(size => size > LARGE_FILE_THRESHOLD);

      if (hasLargeFile) {
        // For large files, skip immediate polling and let background job handle it
        const largeFileSizeGB = (Math.max(...uploadedFileSizes) / 1024 / 1024 / 1024).toFixed(1);
        setUploadProgress(`✓ Upload complete! Large file (${largeFileSizeGB}GB) processing in background. You can close this and continue working - video will appear in Arsenal when ready (may take 30+ minutes).`);
        console.log('[Arsenal Upload] Large file detected, skipping immediate thumbnail polling');

        // Refresh Arsenal after a short delay to show the video in "processing" state
        setTimeout(() => {
          onUploadComplete();
        }, 3000);
      } else {
        // For smaller files, use the existing thumbnail polling logic
        setUploadProgress('✓ Upload complete! Stream is processing your video...');

        if (uploadedUids.length > 0) {
          const lastUid = uploadedUids[uploadedUids.length - 1];

          setTimeout(async () => {
            try {
              let attempts = 0;
              const maxAttempts = 12; // 12 attempts × 10s = 2 minutes max

              const pollForReadiness = async () => {
                attempts++;
                console.log(`[Arsenal Upload] Polling video ${lastUid} readiness (attempt ${attempts}/${maxAttempts})...`);

                const pollRes = await fetch('/api/videos/poll-ready', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ uid: lastUid })
                });

              if (!pollRes.ok) {
                console.error('[Arsenal Upload] Poll failed:', await pollRes.text());
                if (attempts < maxAttempts) {
                  setTimeout(pollForReadiness, 10000);
                } else {
                  setUploadProgress('✓ Upload complete! (Video still processing - refresh Arsenal to retry thumbnail)');
                }
                return;
              }

              const pollData = await pollRes.json();

              if (pollData.ready && pollData.thumbnailGenerated) {
                console.log(`[Arsenal Upload] Thumbnail generated successfully for ${lastUid}`);
                setUploadProgress('✓ Upload complete! Custom thumbnail generated successfully.');
                // Refresh video list to show new thumbnail
                // Refresh will happen via onUploadComplete
                setTimeout(() => onUploadComplete(), 2000);
              } else if (pollData.ready && !pollData.thumbnailGenerated) {
                console.warn(`[Arsenal Upload] Video ready but thumbnail failed:`, pollData.error);
                setUploadProgress('✓ Upload complete! (Thumbnail generation failed - you can regenerate from Arsenal)');
                onUploadComplete(); // Refresh to show video even without thumbnail
              } else if (attempts < maxAttempts) {
                // Not ready yet, poll again
                setTimeout(pollForReadiness, 10000);
              } else {
                console.warn(`[Arsenal Upload] Video ${lastUid} not ready after ${maxAttempts} attempts`);
                setUploadProgress('✓ Upload complete! (Video still processing - thumbnail will appear shortly)');
                onUploadComplete(); // Refresh library anyway
              }
            };

            // Start polling after 30 seconds (give Cloudflare a head start)
            setTimeout(pollForReadiness, 30000);

          } catch (pollError) {
            console.error('[Arsenal Upload] Error in thumbnail polling:', pollError);
            setUploadProgress('✓ Upload complete! (Thumbnail generation pending - refresh Arsenal)');
          }
        }, 1000);
        }
      }
      
      setSelectedFiles([]);
      // Reset form
      setVideoTitle('');
      setVideoDescription('');
      setVideoCredits('');
      setLinkedTrackId('');
      setLinkedAlbumId('');
      onUploadComplete();
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setUploadFailed(true);
    } finally {
      setUploading(false);
    }
  };

  const handleSyncFromStream = async () => {
    setSyncing(true);
    setUploadProgress('Syncing from Cloudflare Stream...');
    
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];
      
      const res = await fetch('/api/arsenal/sync-from-stream', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Sync failed: ${res.status}`);
      }
      
      const data = await res.json();
      setUploadProgress(`✓ Sync complete! Found ${data.synced || 0} videos in Stream. Refreshing...`);
      setUploadFailed(false);
      
      // Refresh video list
      setTimeout(() => {
        onUploadComplete();
        setUploadProgress('');
      }, 2000);
      
    } catch (error) {
      console.error('Sync failed:', error);
      setUploadProgress(`✗ Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearStream = async () => {
    if (!confirm('⚠️ Delete ALL videos from Cloudflare Stream? This cannot be undone!')) {
      return;
    }

    setSyncing(true);
    setUploadProgress('Deleting all videos from Cloudflare Stream...');
    
    try {
      const res = await fetch('/api/admin/stream/clear-all', {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        throw new Error(`Clear failed: ${res.status}`);
      }
      
      const data = await res.json();
      setUploadProgress(`✓ Cleared! Deleted ${data.successful || 0} videos from Stream.`);
      setUploadFailed(false);
      
      setTimeout(() => {
        setUploadProgress('');
      }, 3000);
      
    } catch (error) {
      console.error('Clear failed:', error);
      setUploadProgress(`✗ Clear failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload type selector */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">What are you uploading?</h3>
        <div className="flex gap-3">
          {[
            { id: 'clip' as const, label: 'Clips', desc: 'Short clips for the feed' },
            { id: 'video' as const, label: 'Video', desc: 'Parent/long-form video' },
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setUploadType(type.id)}
              className={`flex-1 p-4 rounded-xl text-left transition-colors ${
                uploadType === type.id
                  ? 'bg-[#843c2d]/20 border border-[#843c2d]/50'
                  : 'bg-white/5 border border-transparent hover:bg-white/10'
              }`}
            >
              <div className="text-sm font-medium text-[#ede8df]">{type.label}</div>
              <div className="text-xs text-[#726d6c] mt-1">{type.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Parent video selector (for clips) */}
      {uploadType === 'clip' && (
        <div>
          <h3 className="text-sm font-medium text-[#ede8df] mb-3">Parent Video</h3>
          <select
            value={parentVideoId || ''}
            onChange={(e) => setParentVideoId(e.target.value ? Number(e.target.value) : null)}
            disabled={uploading}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ pointerEvents: 'auto' }}
          >
            <option value="">Select parent video...</option>
            {parentVideos.map(v => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
          {parentVideoId ? (
            <p className="text-xs text-[#9ba89e] mt-2">
              ✅ Metadata inherited from parent. Edit below if needed.
            </p>
          ) : (
            <p className="text-xs text-[#726d6c] mt-2">
              Clips will use their filename as the title
            </p>
          )}
        </div>
      )}

      {/* File selector */}
      <div>
        <h3 className="text-sm font-medium text-[#ede8df] mb-3">Select Files</h3>
        <input
          type="file"
          multiple
          accept="video/*"
          onChange={handleFileSelect}
          className="block w-full text-sm text-[#726d6c] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#843c2d]/20 file:text-[#ede8df] hover:file:bg-[#843c2d]/30"
        />
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[#ede8df] mb-3">
            {uploadType === 'clip' ? 'Order (drag to reorder)' : 'Selected File'}
          </h3>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-xl bg-white/5 ${uploadType === 'clip' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                draggable={uploadType === 'clip'}
                onDragStart={(e) => { 
                  if (uploadType === 'clip') dragFileIndex.current = index; 
                }}
                onDragOver={(e) => { 
                  if (uploadType === 'clip') e.preventDefault(); 
                }}
                onDrop={(e) => {
                  if (uploadType === 'clip') {
                    e.preventDefault();
                    const from = dragFileIndex.current;
                    dragFileIndex.current = null;
                    if (from !== null) reorderFiles(from, index);
                  }
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-[#726d6c] text-sm w-6">{index + 1}.</span>
                  <span className="text-sm text-[#ede8df] truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {uploadType === 'clip' && (
                    <>
                      <button
                        onClick={() => moveFile(index, 'up')}
                        disabled={index === 0}
                        className="p-2 rounded-lg bg-white/5 text-[#726d6c] hover:text-[#ede8df] disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveFile(index, 'down')}
                        disabled={index === selectedFiles.length - 1}
                        className="p-2 rounded-lg bg-white/5 text-[#726d6c] hover:text-[#ede8df] disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== index))}
                    className="p-2 rounded-lg bg-white/5 text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video metadata fields (for videos only) */}
      {uploadType === 'video' && selectedFiles.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <h3 className="text-sm font-medium text-[#ede8df]">Video Details</h3>

          {/* Title */}
          <div>
            <label className="text-xs text-[#726d6c] mb-1 block">Title *</label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Video title"
              disabled={uploading}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ userSelect: 'text', pointerEvents: 'auto' }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-[#726d6c] mb-1 block">Description</label>
            <textarea
              value={videoDescription}
              onChange={(e) => setVideoDescription(e.target.value)}
              placeholder="Video description for YouTube..."
              rows={3}
              disabled={uploading}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ userSelect: 'text', pointerEvents: 'auto' }}
            />
          </div>

          {/* Credits */}
          <div>
            <label className="text-xs text-[#726d6c] mb-1 block">Credits</label>
            <textarea
              value={videoCredits}
              onChange={(e) => setVideoCredits(e.target.value)}
              placeholder="Director: ...&#10;Producer: ...&#10;Cinematography: ..."
              rows={4}
              disabled={uploading}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ userSelect: 'text', pointerEvents: 'auto' }}
            />
          </div>

          {/* Artist Name */}
          <div>
            <label className="text-xs text-[#726d6c] mb-1 block">Artist Name</label>
            <input
              type="text"
              value={videoArtist}
              onChange={(e) => setVideoArtist(e.target.value)}
              placeholder="ODUBO"
              disabled={uploading}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ userSelect: 'text', pointerEvents: 'auto' }}
            />
          </div>

          {/* Type, Category, Mood in a row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Type */}
            <div>
              <label className="text-xs text-[#726d6c] mb-1 block">Type</label>
              <select
                value={videoType}
                onChange={(e) => setVideoType(e.target.value)}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ pointerEvents: 'auto' }}
              >
                <option value="music-video">Music Video</option>
                <option value="performance">Performance</option>
                <option value="behind-the-scenes">Behind The Scenes</option>
                <option value="documentary">Documentary</option>
                <option value="interview">Interview</option>
                <option value="lyric-video">Lyric Video</option>
                <option value="visualizer">Visualizer</option>
                <option value="vlog">Vlog</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-[#726d6c] mb-1 block">Category</label>
              <select
                value={videoCategory}
                onChange={(e) => setVideoCategory(e.target.value)}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ pointerEvents: 'auto' }}
              >
                <option value="">Select...</option>
                <option value="music">Music</option>
                <option value="entertainment">Entertainment</option>
                <option value="education">Education</option>
                <option value="howto">How-to & Style</option>
                <option value="people">People & Blogs</option>
                <option value="film">Film & Animation</option>
              </select>
            </div>

            {/* Mood */}
            <div>
              <label className="text-xs text-[#726d6c] mb-1 block">Mood</label>
              <select
                value={videoMood}
                onChange={(e) => setVideoMood(e.target.value)}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ pointerEvents: 'auto' }}
              >
                <option value="">Select...</option>
                <option value="energetic">Energetic</option>
                <option value="chill">Chill</option>
                <option value="emotional">Emotional</option>
                <option value="dark">Dark</option>
                <option value="uplifting">Uplifting</option>
                <option value="aggressive">Aggressive</option>
                <option value="romantic">Romantic</option>
                <option value="melancholic">Melancholic</option>
              </select>
            </div>
          </div>

          {/* Music Linking (Track & Album) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-white/10">
            <div>
              <label className="text-xs text-[#726d6c] mb-1 block">Link to Track (Optional)</label>
              <select
                value={linkedTrackId}
                onChange={(e) => {
                  setLinkedTrackId(e.target.value);
                  // Auto-populate album if track selected
                  const track = availableTracks.find(t => t.id === e.target.value);
                  if (track?.album_id) {
                    setLinkedAlbumId(track.album_id);
                  }
                }}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ pointerEvents: 'auto' }}
              >
                <option value="">None</option>
                {availableTracks.map(track => (
                  <option key={track.id} value={track.id}>{track.title}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-xs text-[#726d6c] mb-1 block">Link to Album (Optional)</label>
              <select
                value={linkedAlbumId}
                onChange={(e) => setLinkedAlbumId(e.target.value)}
                disabled={uploading}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ pointerEvents: 'auto' }}
              >
                <option value="">None</option>
                {availableAlbums.map(album => (
                  <option key={album.id} value={album.id}>{album.title}</option>
                ))}
              </select>
            </div>

            {/* Upload Progress & Recovery UI */}
            {(uploading || uploadProgress) && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[#843c2d]/10 text-[#ede8df] text-sm">
                  {uploadProgress}
                </div>
                
                {/* Recovery button if upload failed */}
                {uploadFailed && !uploading && (
                  <div className="p-4 rounded-xl bg-[#6d3224]/20 border border-[#843c2d]/30 space-y-3">
                    <p className="text-xs text-[#ede8df]/70">
                      💡 <strong>Upload failed - video may be orphaned in Cloudflare Stream</strong>
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSyncFromStream}
                        disabled={syncing}
                        className="flex-1 py-2.5 rounded-lg bg-[#843c2d] hover:bg-[#9b4633] text-white text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {syncing ? 'Syncing...' : '🔄 Sync & Recover'}
                      </button>
                      <button
                        onClick={handleClearStream}
                        disabled={syncing}
                        className="flex-1 py-2.5 rounded-lg bg-red-900/50 hover:bg-red-900/70 text-white text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {syncing ? 'Clearing...' : '🗑️ Clear Stream & Retry'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <h3 className="text-sm font-medium text-[#ede8df] mb-2">Schedule Deployment (Optional)</h3>
            <p className="text-xs text-[#726d6c] mb-3">
              Set when this video should be deployed to platforms. You can also set/change this later in the Deploy view.
            </p>
            <div className="flex gap-3">
              <input
                type="date"
                value={uploadScheduleDate}
                onChange={(e) => setUploadScheduleDate(e.target.value)}
                disabled={uploading}
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ pointerEvents: 'auto' }}
                min={new Date().toISOString().split('T')[0]}
              />
              <input
                type="time"
                value={uploadScheduleTime}
                onChange={(e) => setUploadScheduleTime(e.target.value)}
                disabled={uploading}
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ pointerEvents: 'auto' }}
              />
            </div>
            {uploadScheduleDate && uploadScheduleTime && (
              <p className="text-xs text-[#9ba89e] mt-2">
                📅 Scheduled for {new Date(`${uploadScheduleDate}T${uploadScheduleTime}`).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="p-4 rounded-xl bg-[#843c2d]/10 text-[#ede8df] text-sm">
          {uploadProgress}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={uploading || selectedFiles.length === 0 || (uploadType === 'clip' && !parentVideoId)}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      >
        {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} ${uploadType === 'clip' ? 'Clips' : 'Videos'}`}
      </button>
    </div>
  );
}

// Pipeline Types
interface PipelineParent {
  id: number;
  uid: string;
  title: string;
  poster_url: string | null;
  duration: string | null;
  release_order: number | null;
  created_at: string;
  artist_name: string | null;
  clip_count: number;
  deployed_count: number;
}

interface PipelineClip {
  id: number;
  uid: string;
  title: string;
  poster_url: string | null;
  duration: string | null;
  parent_video_id: number;
  clip_index: number | null;
  youtube_url: string | null;
  youtube_shorts_url: string | null;
  tiktok_url: string | null;
  instagram_reels_url: string | null;
  postforme_status: string | null;
  created_at: string;
}

// Pipeline View - Deployment queue with "river" flow
function PipelineView({ onDeployClip }: { onDeployClip: (clipId: number) => void }) {
  const [parents, setParents] = useState<PipelineParent[]>([]);
  const [clipsByParent, setClipsByParent] = useState<Record<number, PipelineClip[]>>({});
  const [nextToDeployId, setNextToDeployId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedClip, setSelectedClip] = useState<PipelineClip | null>(null);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/arsenal/release-order');
      const data = await res.json() as {
        parents: PipelineParent[];
        clipsByParent: Record<number, PipelineClip[]>;
        nextToDeployId: number | null;
      };
      setParents(data.parents || []);
      setClipsByParent(data.clipsByParent || {});
      setNextToDeployId(data.nextToDeployId);

      // Auto-expand parent of next clip (in progress videos only)
      if (data.nextToDeployId) {
        const parentId = Object.entries(data.clipsByParent || {}).find(
          ([, clips]) => clips.some(c => c.id === data.nextToDeployId)
        )?.[0];
        if (parentId) setExpandedIds([parseInt(parentId)]);
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const moveParent = async (index: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    if (toIndex < 0 || toIndex >= parents.length) return;

    const newParents = [...parents];
    [newParents[index], newParents[toIndex]] = [newParents[toIndex], newParents[index]];
    setParents(newParents);

    try {
      await fetch('/api/arsenal/release-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: newParents.map((p, i) => ({ id: p.id, order: i + 1 }))
        }),
      });
    } catch (error) {
      console.error('Failed to reorder:', error);
      fetchPipeline(); // Revert on error
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const isClipDeployed = (clip: PipelineClip) =>
    !!(clip.youtube_url || clip.tiktok_url || clip.instagram_reels_url);

  const getParentStatus = (parent: PipelineParent) => {
    if (parent.deployed_count === 0) return 'queued';
    if (parent.deployed_count >= parent.clip_count) return 'complete';
    return 'in-progress';
  };

  // Get next clip for hero card
  const nextClip = nextToDeployId ? 
    Object.values(clipsByParent).flat().find(c => c.id === nextToDeployId) : null;
  const nextClipParent = nextClip ? 
    parents.find(p => p.id === nextClip.parent_video_id) : null;

  // Split parents into active and completed
  const activeParents = parents.filter(p => getParentStatus(p) !== 'complete');
  const completedParents = parents.filter(p => getParentStatus(p) === 'complete');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[#ede8df]">Deployment Pipeline</h3>
          <p className="text-xs text-[#726d6c] mt-1">
            Deploy clips in order - the river flows from top to bottom
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeParents.length > 0 && (
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-[#b2a491] hover:bg-white/10 transition-all"
            >
              {editMode ? 'Done Editing' : 'Reorder'}
            </button>
          )}
        </div>
      </div>

      {/* Next Up Hero Card */}
      {nextClip && nextClipParent && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-[#843c2d]/20 to-[#6d3224]/10 border border-[#843c2d]/30">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-[#843c2d] animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="8" />
            </svg>
            <span className="text-xs font-bold text-[#843c2d] uppercase tracking-wide">Next Up</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Large thumbnail */}
            <div className="w-32 h-20 rounded-lg overflow-hidden bg-[#0d0c0a] flex-shrink-0 border border-white/10">
              {nextClip.poster_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={nextClip.poster_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#726d6c] mb-1">
                {nextClipParent.title} • Part {nextClip.clip_index}/{nextClipParent.clip_count}
              </div>
              <div className="text-lg font-medium text-[#ede8df] truncate mb-2">
                {nextClip.title}
              </div>
              <button
                onClick={() => onDeployClip(nextClip.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white font-medium transition-all hover:opacity-90"
              >
                {Icons.rocket}
                <span>Deploy Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Videos Pipeline */}
      {activeParents.length === 0 ? (
        <div className="text-center py-12 text-[#726d6c]">
          {completedParents.length > 0 ? 
            'All videos deployed! 🎉' : 
            'No videos in pipeline. Upload content to get started.'
          }
        </div>
      ) : (
        <div className="space-y-3">
          {activeParents.map((parent, index) => {
            const status = getParentStatus(parent);
            const clips = clipsByParent[parent.id] || [];
            const isExpanded = expandedIds.includes(parent.id);
            const progress = parent.clip_count > 0 ? (parent.deployed_count / parent.clip_count) * 100 : 0;

            return (
              <div key={parent.id} className="rounded-xl overflow-hidden border border-white/5 bg-[#1a1816]">
                {/* Parent header */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleExpand(parent.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Reorder controls (only in edit mode) */}
                    {editMode && (
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveParent(index, 'up'); }}
                          disabled={index === 0}
                          className="p-1 rounded bg-white/5 text-[#726d6c] hover:text-[#ede8df] hover:bg-white/10 disabled:opacity-30"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveParent(index, 'down'); }}
                          disabled={index === activeParents.length - 1}
                          className="p-1 rounded bg-white/5 text-[#726d6c] hover:text-[#ede8df] hover:bg-white/10 disabled:opacity-30"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Position badge */}
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold text-[#ede8df]">
                      {index + 1}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-20 h-12 rounded-lg overflow-hidden bg-[#0d0c0a] flex-shrink-0">
                      {parent.poster_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={parent.poster_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#ede8df] truncate">{parent.title}</div>
                      <div className="text-xs text-[#726d6c] mt-1">
                        {parent.deployed_count} of {parent.clip_count} clips deployed
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#843c2d] to-[#6d3224] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <svg
                      className={`w-5 h-5 text-[#726d6c] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Clips progress indicator */}
                {isExpanded && clips.length > 0 && (
                  <div className="border-t border-white/5 bg-black/20 p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {clips.map((clip, idx) => {
                        const deployed = isClipDeployed(clip);
                        const isNext = clip.id === nextToDeployId;

                        return (
                          <button
                            key={clip.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isNext || deployed) {
                                setSelectedClip(clip);
                              } else {
                                onDeployClip(clip.id);
                              }
                            }}
                            className={`relative group ${
                              isNext
                                ? 'w-10 h-10 rounded-full bg-gradient-to-r from-[#843c2d] to-[#6d3224] flex items-center justify-center text-white font-bold text-sm ring-2 ring-[#843c2d]/50 animate-pulse'
                                : deployed
                                ? 'w-8 h-8 rounded-full bg-green-500/30 flex items-center justify-center'
                                : 'w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center text-[#726d6c] hover:border-[#843c2d]/50 hover:text-[#ede8df] transition-all'
                            }`}
                          >
                            {deployed ? (
                              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-xs">{idx + 1}</span>
                            )}
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#0d0c0a] text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                              {clip.title}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Section */}
      {completedParents.length > 0 && (
        <div className="pt-4 border-t border-white/5">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-[#726d6c] hover:text-[#ede8df] transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>Completed ({completedParents.length})</span>
          </button>

          {showCompleted && (
            <div className="mt-3 space-y-2">
              {completedParents.map((parent) => (
                <div key={parent.id} className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#ede8df] truncate">{parent.title}</div>
                    <div className="text-xs text-green-400/70">{parent.clip_count} clips deployed</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clip Detail Modal */}
      {selectedClip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedClip(null)}
        >
          <div
            className="bg-[#1a1816] rounded-xl p-4 sm:p-6 w-full sm:max-w-md border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-[#ede8df]">Clip Details</h3>
              <button
                onClick={() => setSelectedClip(null)}
                className="text-[#726d6c] hover:text-[#ede8df] transition-colors"
              >
                {Icons.close}
              </button>
            </div>

            <div className="space-y-4">
              {/* Thumbnail */}
              <div className="w-full aspect-video rounded-lg overflow-hidden bg-[#0d0c0a]">
                {selectedClip.poster_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedClip.poster_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>

              {/* Info */}
              <div>
                <div className="text-sm font-medium text-[#ede8df] mb-1">{selectedClip.title}</div>
                <div className="text-xs text-[#726d6c]">Part {selectedClip.clip_index}</div>
              </div>

              {/* Deployment status */}
              {isClipDeployed(selectedClip) && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-xs font-medium text-green-400 mb-2">Deployed to:</div>
                  <div className="space-y-1">
                    {selectedClip.youtube_url && (
                      <a href={selectedClip.youtube_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#b2a491] hover:text-[#ede8df]">
                        → YouTube
                      </a>
                    )}
                    {selectedClip.tiktok_url && (
                      <a href={selectedClip.tiktok_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#b2a491] hover:text-[#ede8df]">
                        → TikTok
                      </a>
                    )}
                    {selectedClip.instagram_reels_url && (
                      <a href={selectedClip.instagram_reels_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#b2a491] hover:text-[#ede8df]">
                        → Instagram
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Feed Order View
function FeedOrderView() {
  const [clips, setClips] = useState<FeedClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const dragIndex = { current: null as number | null };

  const fetchClips = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/arsenal/feed-order');
      const data = await res.json() as { clips: FeedClip[] };
      setClips(data.clips || []);
    } catch (error) {
      console.error('Failed to fetch clips:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  const moveClip = (index: number, direction: 'up' | 'down') => {
    const newClips = [...clips];
    if (direction === 'up' && index > 0) {
      [newClips[index], newClips[index - 1]] = [newClips[index - 1], newClips[index]];
    } else if (direction === 'down' && index < newClips.length - 1) {
      [newClips[index], newClips[index + 1]] = [newClips[index + 1], newClips[index]];
    } else {
      return;
    }
    setClips(newClips);
    setHasChanges(true);
  };

  const reorderClips = (from: number, to: number) => {
    if (from === to) return;
    const newClips = [...clips];
    const [moved] = newClips.splice(from, 1);
    newClips.splice(to, 0, moved);
    setClips(newClips);
    setHasChanges(true);
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const payload = clips.map((clip, idx) => ({ id: clip.id, position: idx + 1 }));
      await fetch('/api/arsenal/feed-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: payload })
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save order:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[#ede8df]">Manual Order (Special Use Only)</h3>
          <p className="text-xs text-[#726d6c] mt-1">
            For curated playlists or featured sections. Default public feed is always randomized.
          </p>
        </div>
        <button
          onClick={saveOrder}
          disabled={!hasChanges || saving}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            hasChanges
              ? 'bg-[#843c2d] text-white hover:bg-[#6d3224]'
              : 'bg-white/5 text-[#726d6c]'
          } disabled:opacity-50`}
        >
          {saving ? 'Saving...' : hasChanges ? 'Save Order' : 'No Changes'}
        </button>
      </div>

      {/* Clips list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
        </div>
      ) : clips.length === 0 ? (
        <div className="text-center py-12 text-[#726d6c]">
          No clips found in the feed.
        </div>
      ) : (
        <div className="space-y-2">
          {clips.map((clip, index) => (
            <div
              key={clip.id}
              draggable
              onDragStart={() => { dragIndex.current = index; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragIndex.current;
                dragIndex.current = null;
                if (from !== null) reorderClips(from, index);
              }}
              className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-move transition-colors"
            >
              {/* Position number */}
              <div className="w-8 h-8 rounded-lg bg-[#843c2d]/20 flex items-center justify-center text-sm font-medium text-[#ede8df]">
                {index + 1}
              </div>

              {/* Thumbnail */}
              <div className="w-16 h-9 rounded-lg bg-[#0d0c0a] overflow-hidden flex-shrink-0">
                {clip.poster_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clip.poster_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#ede8df] truncate">{clip.title}</div>
                <div className="text-xs text-[#726d6c]">
                  {clip.artist_name && `${clip.artist_name} • `}
                  {clip.duration || 'Processing...'}
                </div>
              </div>

              {/* Move buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveClip(index, 'up')}
                  disabled={index === 0}
                  className="p-2 rounded-lg bg-white/5 text-[#726d6c] hover:text-[#ede8df] disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveClip(index, 'down')}
                  disabled={index === clips.length - 1}
                  className="p-2 rounded-lg bg-white/5 text-[#726d6c] hover:text-[#ede8df] disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main Arsenal Tab
export default function ArsenalTab() {
  const [view, setView] = useState<ViewMode>('library');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Homepage mode toggle
  const [homepageMode, setHomepageMode] = useState<'auto' | 'clips' | 'music'>('auto');
  const [clipCount, setClipCount] = useState(0);
  const [homepageModeLoading, setHomepageModeLoading] = useState(false);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/arsenal/videos');
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json() as { videos: Video[] };
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch homepage mode
  const fetchHomepageMode = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/homepage-mode');
      if (res.ok) {
        const data = await res.json() as { mode: string; clipCount: number };
        setHomepageMode(data.mode as 'auto' | 'clips' | 'music');
        setClipCount(data.clipCount || 0);
      }
    } catch (error) {
      console.error('Error fetching homepage mode:', error);
    }
  }, []);

  // Toggle homepage mode
  const handleHomepageModeChange = async (newMode: 'auto' | 'clips' | 'music') => {
    setHomepageModeLoading(true);
    try {
      const res = await fetch('/api/admin/homepage-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        setHomepageMode(newMode);
      }
    } catch (error) {
      console.error('Error setting homepage mode:', error);
    } finally {
      setHomepageModeLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchHomepageMode();
  }, [fetchVideos, fetchHomepageMode]);

  // Toggle selection
  const handleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Deploy
  const handleDeploy = async (platforms: string[], scheduleAt?: string, metadata?: DeployMetadata, wodaGenerationId?: number | null) => {
    setDeploying(true);
    try {
      const res = await fetch('/api/arsenal/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoIds: selectedIds,
          platforms,
          scheduleAt,
          metadata,
          wodaGenerationId,
        }),
        credentials: 'include', // Important: send httpOnly cookies
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Deploy failed');
      }

      const data = await res.json();
      const successCount = data.summary?.successful || data.results?.filter((r: any) => r.success).length || 0;
      const failCount = data.summary?.failed || data.results?.filter((r: any) => !r.success).length || 0;
      const platformCount = data.summary?.platformsDeployed || platforms.length;

      // Show success message
      const message = failCount > 0
        ? `Deployed ${successCount} video(s) to ${platformCount} platform(s). ${failCount} failed.`
        : `Successfully deployed ${successCount} video(s) to ${platforms.join(', ')}`;
      alert(message);

      // Clear selection and refresh
      setSelectedIds([]);
      await fetchVideos();
      setView('library');
    } catch (error) {
      console.error('Deploy error:', error);
      alert(`Deploy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeploying(false);
    }
  };

  // Sync
  const handleSync = async () => {
    setSyncing(true);
    setSyncLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Starting sync...`]);

    try {
      const res = await fetch('/api/arsenal/sync', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json() as { updated: number; errors: string[] };

      setSyncLog(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Updated ${data.updated} videos`,
        ...(data.errors || []).map((e: string) => `[${new Date().toLocaleTimeString()}] ERROR: ${e}`),
      ]);
      setLastSyncTime(new Date().toISOString());
      fetchVideos();
    } catch (error) {
      setSyncLog(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ]);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-full md:max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#ede8df]">Content Arsenal</h1>
            <p className="text-xs md:text-sm text-[#726d6c] mt-1">
              Magazine & Bullets - Your digital kingdom command center
            </p>
          </div>

          {/* Homepage Mode Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 bg-white/5 rounded-xl p-3 sm:px-4 sm:py-2.5 border border-white/10">
            <span className="text-xs text-[#726d6c] uppercase tracking-wider">Homepage:</span>
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {(['auto', 'clips', 'music'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleHomepageModeChange(mode)}
                  disabled={homepageModeLoading}
                  className={`px-3 py-1.5 sm:py-1 text-xs font-medium rounded-lg transition-colors min-h-[44px] sm:min-h-0 ${
                    homepageMode === mode
                      ? 'bg-[#843c2d] text-white'
                      : 'bg-white/5 text-[#726d6c] hover:bg-white/10 hover:text-[#ede8df]'
                  } ${homepageModeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {mode === 'auto' ? `Auto (${clipCount > 0 ? 'Clips' : 'Music'})` : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 sm:pb-0">
        {[
          { id: 'library' as ViewMode, label: 'Library', icon: Icons.library },
          { id: 'pipeline' as ViewMode, label: 'Pipeline', icon: Icons.pipeline },
          { id: 'upload' as ViewMode, label: 'Upload', icon: Icons.upload },
          { id: 'feed-order' as ViewMode, label: 'Manual Order', icon: Icons.feedOrder },
          { id: 'deploy' as ViewMode, label: 'Deploy', icon: Icons.deploy },
          { id: 'posters' as ViewMode, label: 'Posters', icon: Icons.poster },
          { id: 'sync' as ViewMode, label: 'Sync', icon: Icons.sync },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl transition-colors whitespace-nowrap ${
              view === tab.id
                ? 'bg-[#843c2d]/20 text-[#ede8df]'
                : 'bg-white/5 text-[#726d6c] hover:bg-white/10'
            }`}
          >
            {tab.icon}
            <span className="text-xs sm:text-sm font-medium">{tab.label}</span>
            {tab.id === 'deploy' && selectedIds.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#843c2d] text-white">
                {selectedIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-[#1a1816] rounded-2xl p-3 sm:p-4 md:p-6 border border-white/5">
        {view === 'library' && (
          <LibraryView
            videos={videos}
            loading={loading}
            onRefresh={fetchVideos}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onStartDeploy={(videoId) => {
              // Select the video and switch to deploy view
              setSelectedIds([videoId]);
              setView('deploy');
            }}
            onVideoClick={(video) => setSelectedVideo(video)}
          />
        )}
        {view === 'pipeline' && (
          <PipelineView
            onDeployClip={(clipId) => {
              setSelectedIds([clipId]);
              setView('deploy');
            }}
          />
        )}
        {view === 'upload' && (
          <UploadView
            videos={videos}
            onUploadComplete={() => {
              fetchVideos();
              setView('library');
            }}
          />
        )}
        {view === 'feed-order' && (
          <FeedOrderView />
        )}
        {view === 'deploy' && (
          <DeployView
            videos={videos}
            selectedIds={selectedIds}
            onDeploy={handleDeploy}
            deploying={deploying}
          />
        )}
        {view === 'posters' && (
          <PostersView videos={videos} />
        )}
        {view === 'sync' && (
          <SyncView
            onSync={handleSync}
            syncing={syncing}
            lastSyncTime={lastSyncTime}
            syncLog={syncLog}
          />
        )}
      </div>

      {/* Video Detail Modal */}
      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onUpdate={fetchVideos}
        />
      )}
    </div>
  );
}
