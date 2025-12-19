'use client';

/**
 * The Hub - Content Hub Overview
 * Central content management dashboard
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';

// =============================================================================
// TYPES
// =============================================================================

interface ContentStats {
  videos: number;
  clips: number;
  albums: number;
  tracks: number;
  galleries: number;
  photos: number;
}

// =============================================================================
// CONTENT CARD
// =============================================================================

interface ContentCardProps {
  title: string;
  description: string;
  count: number;
  href: string;
  icon: string;
  color: string;
}

function ContentCard({ title, description, count, href, icon, color }: ContentCardProps) {
  return (
    <Link href={href} className="hub-card p-5 group">
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ backgroundColor: `${color}20` }}
        >
          <ContentIcon name={icon} color={color} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--hub-text-primary)] group-hover:text-[var(--hub-accent-active)] transition-colors">
            {title}
          </h3>
          <p className="text-sm text-[var(--hub-text-muted)] mt-0.5">{description}</p>
          <p className="text-2xl font-bold text-[var(--hub-text-primary)] mt-2">
            {count.toLocaleString()}
          </p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-5 h-5 text-[var(--hub-text-muted)] group-hover:text-[var(--hub-accent-active)] group-hover:translate-x-1 transition-all"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

function ContentIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, JSX.Element> = {
    video: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
      />
    ),
    clip: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5"
      />
    ),
    music: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
      />
    ),
    gallery: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke={color}
      className="w-6 h-6"
    >
      {icons[name] || icons.video}
    </svg>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ContentHubPage() {
  const { canAccess } = useHubUser();
  const [stats, setStats] = useState<ContentStats>({
    videos: 0,
    clips: 0,
    albums: 0,
    tracks: 0,
    galleries: 0,
    photos: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch video count
        const videosRes = await fetch('/api/videos');
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          if (videosData.success) {
            setStats((prev) => ({
              ...prev,
              videos: videosData.data?.length || 0,
            }));
          }
        }

        // Fetch albums count
        const albumsRes = await fetch('/api/tracks');
        if (albumsRes.ok) {
          const albumsData = await albumsRes.json();
          if (albumsData.success) {
            setStats((prev) => ({
              ...prev,
              albums: albumsData.data?.length || 0,
            }));
          }
        }

        // Fetch galleries count
        const galleriesRes = await fetch('/api/moments/galleries');
        if (galleriesRes.ok) {
          const galleriesData = await galleriesRes.json();
          if (galleriesData.success) {
            setStats((prev) => ({
              ...prev,
              galleries: galleriesData.data?.length || 0,
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  const canWrite = canAccess('content', 'write');

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--hub-text-primary)]">
            Content Hub
          </h1>
          <p className="text-[var(--hub-text-muted)] mt-1">
            Manage all your media content in one place
          </p>
        </div>
        {canWrite && (
          <Link
            href="/admin-v2/content/videos"
            className="hub-btn hub-btn-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Content
          </Link>
        )}
      </div>

      {/* Content Categories */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ContentCard
          title="Videos"
          description="Full-length videos and music videos"
          count={isLoading ? 0 : stats.videos}
          href="/admin-v2/content/videos"
          icon="video"
          color="#3b82f6"
        />
        <ContentCard
          title="Clips"
          description="Short-form content for social media"
          count={isLoading ? 0 : stats.clips}
          href="/admin-v2/content/clips"
          icon="clip"
          color="#8b5cf6"
        />
        <ContentCard
          title="Music"
          description="Albums and tracks"
          count={isLoading ? 0 : stats.albums}
          href="/admin-v2/content/music"
          icon="music"
          color="#22c55e"
        />
        <ContentCard
          title="Moments"
          description="Event galleries and photos"
          count={isLoading ? 0 : stats.galleries}
          href="/admin-v2/content/moments"
          icon="gallery"
          color="#f59e0b"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-[var(--hub-text-secondary)] mb-3 uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="hub-card p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QuickActionButton
              label="Upload Video"
              href="/admin-v2/content/videos"
              icon="upload"
            />
            <QuickActionButton
              label="Create Gallery"
              href="/admin-v2/content/moments"
              icon="plus"
            />
            <QuickActionButton
              label="Add Album"
              href="/admin-v2/content/music"
              icon="music"
            />
            <QuickActionButton
              label="Generate Clips"
              href="/admin-v2/content/clips"
              icon="scissors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// QUICK ACTION BUTTON
// =============================================================================

function QuickActionButton({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: string;
}) {
  const icons: Record<string, JSX.Element> = {
    upload: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    ),
    plus: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    ),
    music: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
      />
    ),
    scissors: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 012.068-1.379l5.325-1.628a4.5 4.5 0 012.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.331 4.331 0 0010.607 12m3.736 0l7.794 4.5-.802.215a4.5 4.5 0 01-2.48-.043l-5.326-1.629a4.324 4.324 0 01-2.068-1.379M14.343 12l-2.882 1.664"
      />
    ),
  };

  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[var(--hub-bg-tertiary)] transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-[var(--hub-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--hub-accent-muted)] transition-colors">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5 text-[var(--hub-text-secondary)] group-hover:text-[var(--hub-accent-active)]"
        >
          {icons[icon] || icons.plus}
        </svg>
      </div>
      <span className="text-xs font-medium text-[var(--hub-text-secondary)] text-center">
        {label}
      </span>
    </Link>
  );
}
