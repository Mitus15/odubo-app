'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Folder {
  id: number;
  name: string;
  slug: string;
  is_default: boolean;
  sort_order: number;
  content_count: number;
}

interface SocialContent {
  id: number;
  folder_id: number | null;
  source_type: 'upload' | 'clip';
  video_id: number | null;
  upload_uid: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  title: string;
  caption_instagram: string | null;
  caption_tiktok: string | null;
  caption_youtube: string | null;
  hashtags_instagram: string | null;
  hashtags_tiktok: string | null;
  hashtags_youtube: string | null;
  status: 'draft' | 'review' | 'approved' | 'scheduled' | 'posted' | 'archived';
  scheduled_for: string | null;
  scheduled_platforms: string | null;
  posted_at: string | null;
  posted_platforms: string | null;
  folder_name?: string;
  folder_slug?: string;
  linked_video_title?: string;
  linked_video_uid?: string;
  created_at: string;
  updated_at: string;
}

interface Clip {
  id: number;
  title: string;
  artist_name: string | null;
  description: string | null;
  uid: string;
  url: string | null;
  mp4_url: string | null;
  duration: number | null;
  duration_seconds: number | null;
  poster_url: string | null;
  thumbnail: string | null;
  shopify_product_handle: string | null;
  created_at: string;
  already_imported: number;
}

type ViewMode = 'library' | 'calendar' | 'analytics';
type StatusFilter = 'all' | 'draft' | 'review' | 'approved' | 'scheduled' | 'posted' | 'archived';

// Icons
const Icons = {
  folder: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  grid: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  play: (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  share: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  upload: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  instagram: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  tiktok: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
    </svg>
  ),
  youtube: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  sparkles: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  back: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  ),
  film: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-2.625 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
};

// Status badge colors
const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30' },
  review: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
  approved: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  scheduled: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  posted: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  archived: { bg: 'bg-gray-600/20', text: 'text-gray-400', border: 'border-gray-600/30' },
};

// Format duration
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function SocialCMSPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [content, setContent] = useState<SocialContent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingContent, setEditingContent] = useState<SocialContent | null>(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [preSelectedScheduleDate, setPreSelectedScheduleDate] = useState<Date | null>(null);

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/social/folders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  }, []);

  // Fetch content
  const fetchContent = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedFolder !== 'all') params.set('folder', selectedFolder);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/social?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || []);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFolder, statusFilter, searchQuery]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/social/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (res.ok) {
        setNewFolderName('');
        setShowNewFolderInput(false);
        fetchFolders();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  // Delete content
  const handleDeleteContent = async (id: number) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/social/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        fetchContent();
        fetchFolders();
      }
    } catch (error) {
      console.error('Error deleting content:', error);
    }
  };

  // Open editor
  const handleEditContent = (item: SocialContent) => {
    setEditingContent(item);
    setShowEditorModal(true);
  };

  // Create content from calendar (with pre-selected date)
  const handleCreateFromCalendar = (date: Date) => {
    setPreSelectedScheduleDate(date);
    setShowUploadModal(true);
  };

  return (
    <div className="min-h-screen bg-[#0d0b0a] text-[#ede8df]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0d0b0a]/95 backdrop-blur-sm border-b border-[#b2a491]/10">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 rounded-lg hover:bg-[#1a1614] transition-colors"
            >
              {Icons.back}
            </button>
            <h1 className="text-xl font-semibold">Social CMS</h1>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#0d0b0a] rounded-xl font-medium transition-colors"
          >
            {Icons.plus}
            <span className="hidden sm:inline">New Content</span>
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 px-4 pb-3 md:px-6">
          <button
            onClick={() => setViewMode('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'library'
                ? 'bg-[#b2a491]/20 text-[#b2a491]'
                : 'text-[#888] hover:text-[#ede8df] hover:bg-[#1a1614]'
            }`}
          >
            {Icons.grid}
            <span>Library</span>
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'calendar'
                ? 'bg-[#b2a491]/20 text-[#b2a491]'
                : 'text-[#888] hover:text-[#ede8df] hover:bg-[#1a1614]'
            }`}
          >
            {Icons.calendar}
            <span>Calendar</span>
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'analytics'
                ? 'bg-[#b2a491]/20 text-[#b2a491]'
                : 'text-[#888] hover:text-[#ede8df] hover:bg-[#1a1614]'
            }`}
          >
            {Icons.chart}
            <span>Analytics</span>
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row">
        {/* Sidebar - Folders */}
        <aside className="w-full md:w-56 lg:w-64 border-b md:border-b-0 md:border-r border-[#b2a491]/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider">Folders</h2>
            <button
              onClick={() => setShowNewFolderInput(true)}
              className="p-1 rounded hover:bg-[#1a1614] text-[#888] hover:text-[#ede8df] transition-colors"
              title="New Folder"
            >
              {Icons.plus}
            </button>
          </div>

          {/* New Folder Input */}
          {showNewFolderInput && (
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="Folder name..."
                className="flex-1 px-3 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-sm focus:outline-none focus:border-[#b2a491]/40"
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                className="px-3 py-2 bg-[#b2a491] text-[#0d0b0a] rounded-lg text-sm font-medium"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }}
                className="px-2 py-2 text-[#888] hover:text-[#ede8df]"
              >
                {Icons.close}
              </button>
            </div>
          )}

          {/* Folder List */}
          <nav className="space-y-1">
            <button
              onClick={() => setSelectedFolder('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                selectedFolder === 'all'
                  ? 'bg-[#b2a491]/20 text-[#b2a491]'
                  : 'text-[#ede8df] hover:bg-[#1a1614]'
              }`}
            >
              <span className="flex items-center gap-2">
                {Icons.folder}
                <span>All Content</span>
              </span>
              <span className="text-sm text-[#888]">{totalCount}</span>
            </button>

            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.slug)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  selectedFolder === folder.slug
                    ? 'bg-[#b2a491]/20 text-[#b2a491]'
                    : 'text-[#ede8df] hover:bg-[#1a1614]'
                }`}
              >
                <span className="flex items-center gap-2">
                  {Icons.folder}
                  <span>{folder.name}</span>
                </span>
                <span className="text-sm text-[#888]">{folder.content_count}</span>
              </button>
            ))}
          </nav>

          {/* Status Filter */}
          <div className="mt-6 pt-4 border-t border-[#b2a491]/10">
            <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-3">Status</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-3 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-sm focus:outline-none focus:border-[#b2a491]/40"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="posted">Posted</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6">
          {viewMode === 'library' && (
            <>
              {/* Search */}
              <div className="mb-6">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search content..."
                  className="w-full md:w-80 px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                />
              </div>

              {/* Content Grid */}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin" />
                </div>
              ) : content.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 mb-4 text-[#888]">{Icons.upload}</div>
                  <h3 className="text-lg font-medium mb-2">No content yet</h3>
                  <p className="text-[#888] mb-4">Upload your first piece of content to get started</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#0d0b0a] rounded-xl font-medium transition-colors"
                  >
                    Upload Content
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {content.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      onEdit={() => handleEditContent(item)}
                      onDelete={() => handleDeleteContent(item.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {viewMode === 'calendar' && (
            <CalendarView
              content={content}
              onEditContent={handleEditContent}
              onCreateContent={handleCreateFromCalendar}
            />
          )}

          {viewMode === 'analytics' && (
            <AnalyticsView content={content.filter((c) => c.status === 'posted')} />
          )}
        </main>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <UploadModal
            folders={folders}
            preSelectedScheduleDate={preSelectedScheduleDate}
            onClose={() => {
              setShowUploadModal(false);
              setPreSelectedScheduleDate(null);
            }}
            onSuccess={() => {
              setShowUploadModal(false);
              setPreSelectedScheduleDate(null);
              fetchContent();
              fetchFolders();
            }}
          />
        )}
      </AnimatePresence>

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditorModal && editingContent && (
          <ContentEditorModal
            content={editingContent}
            folders={folders}
            onClose={() => {
              setShowEditorModal(false);
              setEditingContent(null);
            }}
            onSave={() => {
              setShowEditorModal(false);
              setEditingContent(null);
              fetchContent();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Content Card Component
function ContentCard({
  item,
  onEdit,
  onDelete,
}: {
  item: SocialContent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const thumbnailUrl = item.thumbnail_url || (item.upload_uid ? `https://videodelivery.net/${item.upload_uid}/thumbnails/thumbnail.jpg` : null);
  const statusStyle = statusColors[item.status] || statusColors.draft;

  const hasCaptions = {
    instagram: !!item.caption_instagram,
    tiktok: !!item.caption_tiktok,
    youtube: !!item.caption_youtube,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative bg-[#1a1614] rounded-xl overflow-hidden border border-[#b2a491]/10 hover:border-[#b2a491]/30 transition-all"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-[#0d0b0a]">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#888]">
            {Icons.play}
          </div>
        )}

        {/* Duration overlay */}
        {item.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs">
            {formatDuration(item.duration)}
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            title="Edit"
          >
            {Icons.edit}
          </button>
          <button
            onClick={onDelete}
            className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-full transition-colors text-red-400"
            title="Delete"
          >
            {Icons.trash}
          </button>
        </div>
      </div>

      {/* Content info */}
      <div className="p-3">
        <h3 className="font-medium text-sm mb-2 line-clamp-2">{item.title}</h3>

        {/* Platform indicators */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`${hasCaptions.instagram ? 'text-pink-400' : 'text-[#555]'}`}>
            {Icons.instagram}
          </span>
          <span className={`${hasCaptions.tiktok ? 'text-white' : 'text-[#555]'}`}>
            {Icons.tiktok}
          </span>
          <span className={`${hasCaptions.youtube ? 'text-red-500' : 'text-[#555]'}`}>
            {Icons.youtube}
          </span>
        </div>

        {/* Status badge */}
        <div className="flex items-center justify-between">
          <span
            className={`px-2 py-0.5 text-xs rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
          >
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
          {item.scheduled_for && (
            <span className="text-xs text-[#888]">{formatDate(item.scheduled_for)}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Upload Modal Component
function UploadModal({
  folders,
  preSelectedScheduleDate,
  onClose,
  onSuccess,
}: {
  folders: Folder[];
  preSelectedScheduleDate?: Date | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  type ImportTab = 'upload' | 'clips' | 'assets' | 'moments' | 'media';
  const [activeTab, setActiveTab] = useState<ImportTab>('upload');
  const [scheduledFor, setScheduledFor] = useState<string>(
    preSelectedScheduleDate
      ? new Date(preSelectedScheduleDate.getTime() + 12 * 60 * 60 * 1000) // Default to noon
          .toISOString()
          .slice(0, 16)
      : ''
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clips import state
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [clipsSearch, setClipsSearch] = useState('');
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Brand Assets import state
  const [assets, setAssets] = useState<any[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsSearch, setAssetsSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // Moments import state
  const [moments, setMoments] = useState<any[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<any | null>(null);

  // Media Hub import state
  const [mediaVideos, setMediaVideos] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);

  // Load content when switching tabs
  useEffect(() => {
    if (activeTab === 'clips') loadClips();
    if (activeTab === 'assets') loadAssets();
    if (activeTab === 'moments') loadMoments();
    if (activeTab === 'media') loadMediaVideos();
  }, [activeTab]);

  const loadClips = async (search?: string) => {
    setClipsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '20');

      const res = await fetch(`/api/admin/social/clips?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setClips(data.clips || []);
      }
    } catch (e) {
      console.error('Failed to load clips:', e);
    } finally {
      setClipsLoading(false);
    }
  };

  const handleClipsSearch = () => {
    loadClips(clipsSearch);
  };

  const handleImportClip = async () => {
    if (!selectedClip) return;

    setIsImporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/social/clips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          video_id: selectedClip.id,
          folder_id: folderId,
          title: title.trim() || selectedClip.title,
          scheduled_for: scheduledFor || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to import clip');
      }

      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      alert(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Brand Assets functions
  const loadAssets = async (search?: string) => {
    setAssetsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '20');

      const res = await fetch(`/api/admin/social/import/brand-assets?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (e) {
      console.error('Failed to load assets:', e);
    } finally {
      setAssetsLoading(false);
    }
  };

  const handleImportAsset = async () => {
    if (!selectedAsset) return;

    setIsImporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/social/import/brand-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          asset_id: selectedAsset.id,
          folder_id: folderId,
          title: title.trim() || selectedAsset.title,
          scheduled_for: scheduledFor || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to import asset');
      }

      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      alert(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Moments functions
  const loadMoments = async () => {
    setMomentsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('moderated', 'true'); // Only show approved photos

      const res = await fetch(`/api/admin/social/import/moments?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setMoments(data.photos || []);
      }
    } catch (e) {
      console.error('Failed to load moments:', e);
    } finally {
      setMomentsLoading(false);
    }
  };

  const handleImportMoment = async () => {
    if (!selectedMoment) return;

    setIsImporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/social/import/moments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          photo_id: selectedMoment.id,
          folder_id: folderId,
          title: title.trim() || `Moment by ${selectedMoment.user_name || 'Fan'}`,
          scheduled_for: scheduledFor || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to import moment');
      }

      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      alert(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Media Hub functions
  const loadMediaVideos = async (search?: string) => {
    setMediaLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '20');

      const res = await fetch(`/api/admin/social/import/media-hub?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setMediaVideos(data.videos || []);
      }
    } catch (e) {
      console.error('Failed to load media videos:', e);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleImportMedia = async () => {
    if (!selectedMedia) return;

    setIsImporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/social/import/media-hub', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          video_id: selectedMedia.id,
          folder_id: folderId,
          title: title.trim() || selectedMedia.title,
          scheduled_for: scheduledFor || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to import video');
      }

      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      alert(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) return;
    if (isCreatingNewFolder && !newFolderName.trim()) {
      alert('Please enter a folder name');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('token');
      let finalFolderId = folderId;

      // Create new folder if needed
      if (isCreatingNewFolder && newFolderName.trim()) {
        setUploadProgress(5);
        const folderRes = await fetch('/api/admin/social/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ name: newFolderName.trim() }),
        });

        if (!folderRes.ok) {
          const err = await folderRes.json();
          throw new Error(err.error || 'Failed to create folder');
        }

        const folderData = await folderRes.json();
        finalFolderId = folderData.folder?.id || null;
        setUploadProgress(10);
      }

      // Get upload URL from Cloudflare Stream
      const uploadUrlRes = await fetch('/api/admin/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ filename: selectedFile.name }),
      });

      if (!uploadUrlRes.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL, uid } = await uploadUrlRes.json();

      // Upload to Cloudflare Stream using TUS
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await fetch(uploadURL, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload video');
      }

      setUploadProgress(80);

      // Create social content entry
      const createRes = await fetch('/api/admin/social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          folder_id: finalFolderId,
          source_type: 'upload',
          upload_uid: uid,
          title: title.trim(),
          thumbnail_url: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`,
          scheduled_for: scheduledFor || null,
          status: scheduledFor ? 'scheduled' : 'draft',
        }),
      });

      if (!createRes.ok) {
        throw new Error('Failed to create content entry');
      }

      setUploadProgress(100);
      onSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const isWorking = isUploading || isImporting;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !isWorking && onClose()}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full sm:max-w-2xl bg-[#1a1614] sm:rounded-2xl rounded-t-2xl border border-[#b2a491]/20 overflow-hidden max-h-[95vh] sm:max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b2a491]/10 shrink-0">
          <h2 className="text-lg font-semibold">Add Content</h2>
          <button
            onClick={onClose}
            disabled={isWorking}
            className="p-2 hover:bg-[#0d0b0a] rounded-lg transition-colors disabled:opacity-50"
          >
            {Icons.close}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#b2a491]/10 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'upload'
                ? 'text-[#ede8df] border-b-2 border-[#b2a491]'
                : 'text-[#888] hover:text-[#ede8df]'
            }`}
          >
            {Icons.upload}
            <span>Upload</span>
          </button>
          <button
            onClick={() => setActiveTab('clips')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'clips'
                ? 'text-[#ede8df] border-b-2 border-[#b2a491]'
                : 'text-[#888] hover:text-[#ede8df]'
            }`}
          >
            {Icons.film}
            <span>Clips</span>
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'assets'
                ? 'text-[#ede8df] border-b-2 border-[#b2a491]'
                : 'text-[#888] hover:text-[#ede8df]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span>Assets</span>
          </button>
          <button
            onClick={() => setActiveTab('moments')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'moments'
                ? 'text-[#ede8df] border-b-2 border-[#b2a491]'
                : 'text-[#888] hover:text-[#ede8df]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            <span>Moments</span>
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'media'
                ? 'text-[#ede8df] border-b-2 border-[#b2a491]'
                : 'text-[#888] hover:text-[#ede8df]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
            </svg>
            <span>Media</span>
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'upload' && (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#b2a491] bg-[#b2a491]/10'
                    : 'border-[#b2a491]/30 hover:border-[#b2a491]/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div>
                    <div className="w-12 h-12 mx-auto mb-3 text-[#b2a491]">{Icons.play}</div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-[#888] mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 mx-auto mb-3 text-[#888]">{Icons.upload}</div>
                    <p className="font-medium">Drop video here or click to browse</p>
                    <p className="text-sm text-[#888] mt-1">Supports MP4, MOV, WebM</p>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#888] mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter title..."
                  className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                />
              </div>

              {/* Folder */}
              <div>
                <label className="block text-sm font-medium text-[#888] mb-2">Folder</label>
                {isCreatingNewFolder ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="New folder name..."
                      className="flex-1 px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        setIsCreatingNewFolder(false);
                        setNewFolderName('');
                      }}
                      className="px-3 py-2 text-[#888] hover:text-[#ede8df] transition-colors"
                      type="button"
                    >
                      {Icons.close}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={folderId || ''}
                      onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
                      className="flex-1 px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    >
                      <option value="">No folder</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setIsCreatingNewFolder(true)}
                      className="px-3 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#888] hover:text-[#ede8df] hover:border-[#b2a491]/40 transition-colors"
                      type="button"
                      title="Create new folder"
                    >
                      {Icons.plus}
                    </button>
                  </div>
                )}
              </div>

              {/* Schedule date (shows when creating from calendar or optionally) */}
              <div>
                <label className="block text-sm font-medium text-[#888] mb-2">
                  Schedule For {preSelectedScheduleDate && <span className="text-[#b2a491]">(from calendar)</span>}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                />
                {scheduledFor && (
                  <p className="text-xs text-[#888] mt-1">
                    Content will be scheduled. Clear to save as draft.
                  </p>
                )}
              </div>

              {/* Upload progress */}
              {isUploading && (
                <div>
                  <div className="h-2 bg-[#0d0b0a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#b2a491] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-[#888] mt-2 text-center">Uploading... {uploadProgress}%</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isUploading}
                  className="flex-1 px-4 py-3 bg-[#0d0b0a] hover:bg-[#252220] border border-[#b2a491]/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !title.trim() || isUploading}
                  className="flex-1 px-4 py-3 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#0d0b0a] rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'clips' && (
            <>
              {/* Clips Search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={clipsSearch}
                    onChange={(e) => setClipsSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleClipsSearch()}
                    placeholder="Search clips..."
                    className="w-full pl-10 pr-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]">
                    {Icons.search}
                  </div>
                </div>
                <button
                  onClick={handleClipsSearch}
                  className="px-4 py-3 bg-[#0d0b0a] hover:bg-[#252220] border border-[#b2a491]/20 rounded-xl transition-colors"
                >
                  Search
                </button>
              </div>

              {/* Clips Grid */}
              <div className="min-h-[200px]">
                {clipsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin" />
                  </div>
                ) : clips.length === 0 ? (
                  <div className="text-center py-12 text-[#888]">
                    <div className="w-12 h-12 mx-auto mb-3 opacity-50">{Icons.film}</div>
                    <p>No clips available</p>
                    <p className="text-sm mt-1">All clips have already been imported</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {clips.map((clip) => {
                      const thumbnailUrl = clip.poster_url || clip.thumbnail ||
                        (clip.uid ? `https://videodelivery.net/${clip.uid}/thumbnails/thumbnail.jpg` : null);
                      const isSelected = selectedClip?.id === clip.id;
                      const isImported = clip.already_imported === 1;

                      return (
                        <button
                          key={clip.id}
                          onClick={() => !isImported && setSelectedClip(isSelected ? null : clip)}
                          disabled={isImported}
                          className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all ${
                            isSelected
                              ? 'border-[#b2a491] ring-2 ring-[#b2a491]/30'
                              : isImported
                              ? 'border-transparent opacity-50 cursor-not-allowed'
                              : 'border-transparent hover:border-[#b2a491]/50'
                          }`}
                        >
                          {thumbnailUrl ? (
                            <img
                              src={thumbnailUrl}
                              alt={clip.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#0d0b0a] flex items-center justify-center">
                              {Icons.film}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs font-medium text-white truncate">{clip.title}</p>
                            {clip.duration_seconds && (
                              <p className="text-xs text-white/70">{formatDuration(clip.duration_seconds)}</p>
                            )}
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-[#b2a491] rounded-full flex items-center justify-center">
                              {Icons.check}
                            </div>
                          )}
                          {isImported && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <span className="text-xs bg-[#252220] px-2 py-1 rounded">Already imported</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected clip details */}
              {selectedClip && (
                <div className="p-4 bg-[#0d0b0a] rounded-xl border border-[#b2a491]/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-24 rounded-lg overflow-hidden shrink-0">
                      {(selectedClip.poster_url || selectedClip.thumbnail || selectedClip.uid) ? (
                        <img
                          src={selectedClip.poster_url || selectedClip.thumbnail || `https://videodelivery.net/${selectedClip.uid}/thumbnails/thumbnail.jpg`}
                          alt={selectedClip.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#1a1614] flex items-center justify-center">
                          {Icons.film}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedClip.title}</p>
                      {selectedClip.artist_name && (
                        <p className="text-sm text-[#888]">{selectedClip.artist_name}</p>
                      )}
                    </div>
                  </div>

                  {/* Override title */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">Title (optional override)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={selectedClip.title}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    />
                  </div>

                  {/* Folder */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">Folder</label>
                    <select
                      value={folderId || ''}
                      onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    >
                      <option value="">No folder</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule date */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">
                      Schedule For {preSelectedScheduleDate && <span className="text-[#b2a491]">(from calendar)</span>}
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    />
                    {scheduledFor && (
                      <p className="text-xs text-[#888] mt-1">
                        Content will be scheduled. Clear to save as draft.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isImporting}
                  className="flex-1 px-4 py-3 bg-[#0d0b0a] hover:bg-[#252220] border border-[#b2a491]/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportClip}
                  disabled={!selectedClip || isImporting}
                  className="flex-1 px-4 py-3 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#0d0b0a] rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : 'Import Clip'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'assets' && (
            <>
              {/* Assets Search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={assetsSearch}
                    onChange={(e) => setAssetsSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadAssets(assetsSearch)}
                    placeholder="Search brand assets..."
                    className="w-full pl-10 pr-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]">
                    {Icons.search}
                  </div>
                </div>
                <button
                  onClick={() => loadAssets(assetsSearch)}
                  className="px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl hover:border-[#b2a491]/40 transition-colors"
                >
                  Search
                </button>
              </div>

              {/* Assets Grid */}
              <div className="min-h-[200px]">
                {assetsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin" />
                  </div>
                ) : assets.length === 0 ? (
                  <div className="text-center py-10 text-[#888]">
                    <p>No brand assets found</p>
                    <p className="text-sm mt-1">Upload assets in Brand Assets first</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {assets.map((asset) => {
                      const isSelected = selectedAsset?.id === asset.id;
                      const isImported = asset.already_imported === 1;
                      const thumbnailUrl = asset.r2_key_thumb || asset.r2_key_web || asset.r2_key;
                      return (
                        <button
                          key={asset.id}
                          onClick={() => !isImported && setSelectedAsset(isSelected ? null : asset)}
                          disabled={isImported}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected ? 'border-[#b2a491] ring-2 ring-[#b2a491]/30' :
                            isImported ? 'border-transparent opacity-50 cursor-not-allowed' :
                            'border-transparent hover:border-[#b2a491]/50'
                          }`}
                        >
                          {thumbnailUrl ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${thumbnailUrl}`}
                              alt={asset.title || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : asset.stream_uid ? (
                            <img
                              src={`https://videodelivery.net/${asset.stream_uid}/thumbnails/thumbnail.jpg`}
                              alt={asset.title || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#1a1614] flex items-center justify-center">
                              <svg className="w-8 h-8 text-[#888]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                              </svg>
                            </div>
                          )}
                          {asset.asset_type === 'video' && (
                            <div className="absolute top-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-xs">
                              Video
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-[#b2a491] rounded-full flex items-center justify-center">
                              {Icons.check}
                            </div>
                          )}
                          {isImported && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <span className="text-xs bg-[#252220] px-2 py-1 rounded">Already imported</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected asset details */}
              {selectedAsset && (
                <div className="p-4 bg-[#0d0b0a] rounded-xl border border-[#b2a491]/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#1a1614]">
                      {selectedAsset.r2_key_thumb || selectedAsset.r2_key_web ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${selectedAsset.r2_key_thumb || selectedAsset.r2_key_web}`}
                          alt={selectedAsset.title || ''}
                          className="w-full h-full object-cover"
                        />
                      ) : selectedAsset.stream_uid ? (
                        <img
                          src={`https://videodelivery.net/${selectedAsset.stream_uid}/thumbnails/thumbnail.jpg`}
                          alt={selectedAsset.title || ''}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedAsset.title || 'Untitled Asset'}</p>
                      <p className="text-sm text-[#888]">{selectedAsset.category_name} / {selectedAsset.album_name}</p>
                    </div>
                  </div>

                  {/* Override title */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">Title (optional override)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={selectedAsset.title || 'Enter title...'}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    />
                  </div>

                  {/* Folder */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">Folder</label>
                    <select
                      value={folderId || ''}
                      onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    >
                      <option value="">No folder</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule date */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">
                      Schedule For {preSelectedScheduleDate && <span className="text-[#b2a491]">(from calendar)</span>}
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isImporting}
                  className="flex-1 px-4 py-3 bg-[#0d0b0a] hover:bg-[#252220] border border-[#b2a491]/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportAsset}
                  disabled={!selectedAsset || isImporting}
                  className="flex-1 px-4 py-3 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#0d0b0a] rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : 'Import Asset'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'moments' && (
            <>
              {/* Moments info */}
              <p className="text-sm text-[#888]">Import approved fan photos from Moments galleries</p>

              {/* Moments Grid */}
              <div className="min-h-[200px]">
                {momentsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin" />
                  </div>
                ) : moments.length === 0 ? (
                  <div className="text-center py-10 text-[#888]">
                    <p>No approved moments found</p>
                    <p className="text-sm mt-1">Moderate fan photos in Moments first</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {moments.map((photo) => {
                      const isSelected = selectedMoment?.id === photo.id;
                      const isImported = photo.already_imported === 1;
                      const thumbnailUrl = photo.thumbnail_key || photo.r2_key;
                      return (
                        <button
                          key={photo.id}
                          onClick={() => !isImported && setSelectedMoment(isSelected ? null : photo)}
                          disabled={isImported}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected ? 'border-[#b2a491] ring-2 ring-[#b2a491]/30' :
                            isImported ? 'border-transparent opacity-50 cursor-not-allowed' :
                            'border-transparent hover:border-[#b2a491]/50'
                          }`}
                        >
                          {thumbnailUrl ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${thumbnailUrl}`}
                              alt={photo.user_name || 'Moment'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#1a1614] flex items-center justify-center">
                              <svg className="w-8 h-8 text-[#888]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                              </svg>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-xs text-white truncate">{photo.user_name || 'Anonymous'}</p>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-[#b2a491] rounded-full flex items-center justify-center">
                              {Icons.check}
                            </div>
                          )}
                          {isImported && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <span className="text-xs bg-[#252220] px-2 py-1 rounded">Already imported</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected moment details */}
              {selectedMoment && (
                <div className="p-4 bg-[#0d0b0a] rounded-xl border border-[#b2a491]/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#1a1614]">
                      {(selectedMoment.thumbnail_key || selectedMoment.r2_key) && (
                        <img
                          src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${selectedMoment.thumbnail_key || selectedMoment.r2_key}`}
                          alt={selectedMoment.user_name || 'Moment'}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedMoment.user_name || 'Anonymous'}</p>
                      <p className="text-sm text-[#888]">{selectedMoment.gallery_title || 'Gallery'}</p>
                    </div>
                  </div>

                  {/* Override title */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">Title (optional override)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`Moment by ${selectedMoment.user_name || 'Fan'}`}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    />
                  </div>

                  {/* Folder */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">Folder</label>
                    <select
                      value={folderId || ''}
                      onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    >
                      <option value="">No folder</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule date */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">
                      Schedule For {preSelectedScheduleDate && <span className="text-[#b2a491]">(from calendar)</span>}
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isImporting}
                  className="flex-1 px-4 py-3 bg-[#0d0b0a] hover:bg-[#252220] border border-[#b2a491]/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportMoment}
                  disabled={!selectedMoment || isImporting}
                  className="flex-1 px-4 py-3 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#0d0b0a] rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : 'Import Moment'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'media' && (
            <>
              {/* Media Search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadMediaVideos(mediaSearch)}
                    placeholder="Search media hub videos..."
                    className="w-full pl-10 pr-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]">
                    {Icons.search}
                  </div>
                </div>
                <button
                  onClick={() => loadMediaVideos(mediaSearch)}
                  className="px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl hover:border-[#b2a491]/40 transition-colors"
                >
                  Search
                </button>
              </div>

              {/* Media Grid */}
              <div className="min-h-[200px]">
                {mediaLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin" />
                  </div>
                ) : mediaVideos.length === 0 ? (
                  <div className="text-center py-10 text-[#888]">
                    <p>No media hub videos found</p>
                    <p className="text-sm mt-1">Upload long-form videos to Media Hub first</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {mediaVideos.map((video) => {
                      const isSelected = selectedMedia?.id === video.id;
                      const isImported = video.already_imported === 1;
                      const thumbnailUrl = video.poster_url || video.thumbnail ||
                        (video.uid ? `https://videodelivery.net/${video.uid}/thumbnails/thumbnail.jpg` : null);
                      return (
                        <button
                          key={video.id}
                          onClick={() => !isImported && setSelectedMedia(isSelected ? null : video)}
                          disabled={isImported}
                          className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected ? 'border-[#b2a491] ring-2 ring-[#b2a491]/30' :
                            isImported ? 'border-transparent opacity-50 cursor-not-allowed' :
                            'border-transparent hover:border-[#b2a491]/50'
                          }`}
                        >
                          {thumbnailUrl ? (
                            <img
                              src={thumbnailUrl}
                              alt={video.title || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#1a1614] flex items-center justify-center">
                              {Icons.film}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs font-medium text-white truncate">{video.title}</p>
                            {video.duration_seconds && (
                              <p className="text-xs text-white/70">{formatDuration(video.duration_seconds)}</p>
                            )}
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-[#b2a491] rounded-full flex items-center justify-center">
                              {Icons.check}
                            </div>
                          )}
                          {isImported && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <span className="text-xs bg-[#252220] px-2 py-1 rounded">Already imported</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected media details */}
              {selectedMedia && (
                <div className="p-4 bg-[#0d0b0a] rounded-xl border border-[#b2a491]/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-12 rounded-lg overflow-hidden shrink-0 bg-[#1a1614]">
                      {(selectedMedia.poster_url || selectedMedia.thumbnail || selectedMedia.uid) && (
                        <img
                          src={selectedMedia.poster_url || selectedMedia.thumbnail || `https://videodelivery.net/${selectedMedia.uid}/thumbnails/thumbnail.jpg`}
                          alt={selectedMedia.title || ''}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedMedia.title || 'Untitled Video'}</p>
                      {selectedMedia.artist_name && (
                        <p className="text-sm text-[#888]">{selectedMedia.artist_name}</p>
                      )}
                    </div>
                  </div>

                  {/* Override title */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">Title (optional override)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={selectedMedia.title || 'Enter title...'}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    />
                  </div>

                  {/* Folder */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">Folder</label>
                    <select
                      value={folderId || ''}
                      onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    >
                      <option value="">No folder</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule date */}
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-2">
                      Schedule For {preSelectedScheduleDate && <span className="text-[#b2a491]">(from calendar)</span>}
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="w-full px-4 py-3 bg-[#1a1614] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isImporting}
                  className="flex-1 px-4 py-3 bg-[#0d0b0a] hover:bg-[#252220] border border-[#b2a491]/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportMedia}
                  disabled={!selectedMedia || isImporting}
                  className="flex-1 px-4 py-3 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#0d0b0a] rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : 'Import Video'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Content Editor Modal Component
function ContentEditorModal({
  content,
  folders,
  onClose,
  onSave,
}: {
  content: SocialContent;
  folders: Folder[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState(content.title);
  const [folderId, setFolderId] = useState<number | null>(content.folder_id);
  const [status, setStatus] = useState(content.status);
  const [captionInstagram, setCaptionInstagram] = useState(content.caption_instagram || '');
  const [captionTiktok, setCaptionTiktok] = useState(content.caption_tiktok || '');
  const [captionYoutube, setCaptionYoutube] = useState(content.caption_youtube || '');
  const [hashtagsInstagram, setHashtagsInstagram] = useState(content.hashtags_instagram || '');
  const [hashtagsTiktok, setHashtagsTiktok] = useState(content.hashtags_tiktok || '');
  const [hashtagsYoutube, setHashtagsYoutube] = useState(content.hashtags_youtube || '');
  const [scheduledFor, setScheduledFor] = useState(content.scheduled_for || '');
  const [scheduledPlatforms, setScheduledPlatforms] = useState<string[]>(() => {
    // Handle both array (from calendar API) and string (from main API) formats
    if (Array.isArray(content.scheduled_platforms)) {
      return content.scheduled_platforms;
    }
    if (content.scheduled_platforms && typeof content.scheduled_platforms === 'string') {
      try {
        return JSON.parse(content.scheduled_platforms);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const thumbnailUrl = content.thumbnail_url || (content.upload_uid ? `https://videodelivery.net/${content.upload_uid}/thumbnails/thumbnail.jpg` : null);

  // AI Analysis handler
  const handleAiAnalyze = async () => {
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/social/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          content_id: content.id,
          analyze_type: 'full',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'AI analysis failed');
      }

      const data = await res.json();
      const analysis = data.analysis;

      // Update captions if AI returned them
      if (analysis.captions) {
        if (analysis.captions.instagram?.[0]) {
          setCaptionInstagram(analysis.captions.instagram[0]);
        }
        if (analysis.captions.tiktok?.[0]) {
          setCaptionTiktok(analysis.captions.tiktok[0]);
        }
        if (analysis.captions.youtube?.[0]) {
          setCaptionYoutube(analysis.captions.youtube[0]);
        }
      }

      // Update hashtags if AI returned them
      if (analysis.hashtags) {
        if (analysis.hashtags.instagram?.length) {
          setHashtagsInstagram(analysis.hashtags.instagram.join(' '));
        }
        if (analysis.hashtags.tiktok?.length) {
          setHashtagsTiktok(analysis.hashtags.tiktok.join(' '));
        }
        if (analysis.hashtags.youtube?.length) {
          setHashtagsYoutube(analysis.hashtags.youtube.join(' '));
        }
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      setAiError(error instanceof Error ? error.message : 'AI analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/social/${content.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          folder_id: folderId,
          status,
          caption_instagram: captionInstagram,
          caption_tiktok: captionTiktok,
          caption_youtube: captionYoutube,
          hashtags_instagram: hashtagsInstagram,
          hashtags_tiktok: hashtagsTiktok,
          hashtags_youtube: hashtagsYoutube,
          scheduled_for: scheduledFor || null,
          scheduled_platforms: scheduledPlatforms,
        }),
      });

      if (res.ok) {
        onSave();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setScheduledPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && !isSaving && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl my-8 bg-[#1a1614] rounded-2xl border border-[#b2a491]/20 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b2a491]/10">
          <h2 className="text-lg font-semibold">Edit Content</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 hover:bg-[#0d0b0a] rounded-lg transition-colors disabled:opacity-50"
          >
            {Icons.close}
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Video preview and basic info */}
          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="w-32 h-56 bg-[#0d0b0a] rounded-xl overflow-hidden flex-shrink-0">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#888]">
                  {Icons.play}
                </div>
              )}
            </div>

            {/* Basic info */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#888] mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#888] mb-2">Folder</label>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                  >
                    <option value="">No folder</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#888] mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="approved">Approved</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="posted">Posted</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Captions */}
          <div className="border-t border-[#b2a491]/10 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Captions</h3>
              <button
                onClick={handleAiAnalyze}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#b2a491]/20 hover:bg-[#b2a491]/30 text-[#b2a491] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {isAnalyzing ? (
                  <div className="w-4 h-4 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin" />
                ) : (
                  Icons.sparkles
                )}
                {isAnalyzing ? 'Analyzing...' : 'AI Suggest All'}
              </button>
            </div>
            {aiError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {aiError}
              </div>
            )}

            <div className="space-y-4">
              {/* Instagram */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-pink-400">{Icons.instagram}</span>
                  <label className="text-sm font-medium">Instagram</label>
                </div>
                <textarea
                  value={captionInstagram}
                  onChange={(e) => setCaptionInstagram(e.target.value)}
                  placeholder="Instagram caption..."
                  rows={2}
                  className="w-full px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40 resize-none"
                />
                <input
                  type="text"
                  value={hashtagsInstagram}
                  onChange={(e) => setHashtagsInstagram(e.target.value)}
                  placeholder="#hashtags #separated #by #spaces"
                  className="w-full mt-2 px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40 text-sm text-[#888]"
                />
              </div>

              {/* TikTok */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white">{Icons.tiktok}</span>
                  <label className="text-sm font-medium">TikTok</label>
                </div>
                <textarea
                  value={captionTiktok}
                  onChange={(e) => setCaptionTiktok(e.target.value)}
                  placeholder="TikTok caption..."
                  rows={2}
                  className="w-full px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40 resize-none"
                />
                <input
                  type="text"
                  value={hashtagsTiktok}
                  onChange={(e) => setHashtagsTiktok(e.target.value)}
                  placeholder="#fyp #trending #hashtags"
                  className="w-full mt-2 px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40 text-sm text-[#888]"
                />
              </div>

              {/* YouTube */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-500">{Icons.youtube}</span>
                  <label className="text-sm font-medium">YouTube Shorts</label>
                </div>
                <textarea
                  value={captionYoutube}
                  onChange={(e) => setCaptionYoutube(e.target.value)}
                  placeholder="YouTube Shorts description..."
                  rows={2}
                  className="w-full px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40 resize-none"
                />
                <input
                  type="text"
                  value={hashtagsYoutube}
                  onChange={(e) => setHashtagsYoutube(e.target.value)}
                  placeholder="#shorts #youtube #tags"
                  className="w-full mt-2 px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40 text-sm text-[#888]"
                />
              </div>
            </div>
          </div>

          {/* Scheduling */}
          <div className="border-t border-[#b2a491]/10 pt-6">
            <h3 className="font-medium mb-4">Scheduling</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#888] mb-2">Platforms</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => togglePlatform('instagram')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
                      scheduledPlatforms.includes('instagram')
                        ? 'bg-pink-500/20 border-pink-500/50 text-pink-400'
                        : 'border-[#b2a491]/20 text-[#888] hover:border-[#b2a491]/40'
                    }`}
                  >
                    {Icons.instagram}
                    Instagram
                  </button>
                  <button
                    onClick={() => togglePlatform('tiktok')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
                      scheduledPlatforms.includes('tiktok')
                        ? 'bg-white/20 border-white/50 text-white'
                        : 'border-[#b2a491]/20 text-[#888] hover:border-[#b2a491]/40'
                    }`}
                  >
                    {Icons.tiktok}
                    TikTok
                  </button>
                  <button
                    onClick={() => togglePlatform('youtube')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
                      scheduledPlatforms.includes('youtube')
                        ? 'bg-red-500/20 border-red-500/50 text-red-500'
                        : 'border-[#b2a491]/20 text-[#888] hover:border-[#b2a491]/40'
                    }`}
                  >
                    {Icons.youtube}
                    YouTube
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#888] mb-2">Schedule For</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl focus:outline-none focus:border-[#b2a491]/40"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#b2a491]/10">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-[#0d0b0a] hover:bg-[#252220] border border-[#b2a491]/20 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-[#b2a491] hover:bg-[#c4b8a7] text-[#0d0b0a] rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Calendar View Component
function CalendarView({
  content,
  onEditContent,
  onCreateContent,
}: {
  content: SocialContent[];
  onEditContent: (item: SocialContent) => void;
  onCreateContent?: (date: Date) => void;
}) {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Record<string, SocialContent[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Calculate date range based on view mode
  const getDateRange = useCallback(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'week') {
      // Start of week (Sunday)
      start.setDate(start.getDate() - start.getDay());
      // End of week (Saturday)
      end.setDate(start.getDate() + 6);
    } else {
      // Start of month
      start.setDate(1);
      // End of month
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [currentDate, viewMode]);

  // Fetch calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const { start, end } = getDateRange();

        const res = await fetch(
          `/api/admin/social/calendar?start=${start.toISOString()}&end=${end.toISOString()}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: 'include',
          }
        );

        if (res.ok) {
          const data = await res.json();
          setCalendarData(data.calendar || {});
        }
      } catch (e) {
        console.error('Failed to fetch calendar:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCalendarData();
  }, [getDateRange]);

  // Navigation handlers
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };
  const goNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Generate days for the view
  const getDays = () => {
    const { start, end } = getDateRange();
    const days: Date[] = [];
    const current = new Date(start);

    // For month view, include padding days from previous month
    if (viewMode === 'month') {
      const firstDay = new Date(start);
      const dayOfWeek = firstDay.getDay();
      if (dayOfWeek > 0) {
        const padding = new Date(firstDay);
        padding.setDate(padding.getDate() - dayOfWeek);
        while (padding < firstDay) {
          days.push(new Date(padding));
          padding.setDate(padding.getDate() + 1);
        }
      }
    }

    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // For month view, pad to complete the last week
    if (viewMode === 'month') {
      const lastDay = days[days.length - 1];
      const dayOfWeek = lastDay.getDay();
      if (dayOfWeek < 6) {
        const padding = new Date(lastDay);
        padding.setDate(padding.getDate() + 1);
        while (padding.getDay() !== 0) {
          days.push(new Date(padding));
          padding.setDate(padding.getDate() + 1);
        }
      }
    }

    return days;
  };

  const days = getDays();
  const { start } = getDateRange();

  // Format date key for lookup
  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Get content for a specific day
  const getContentForDay = (date: Date) => {
    const key = formatDateKey(date);
    return calendarData[key] || [];
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is in current month (for month view styling)
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Platform color mapping
  const platformColors: Record<string, string> = {
    instagram: 'bg-pink-500',
    tiktok: 'bg-cyan-500',
    youtube: 'bg-red-500',
  };

  // Format header based on view
  const formatHeader = () => {
    if (viewMode === 'week') {
      const { start, end } = getDateRange();
      const startMonth = start.toLocaleString('default', { month: 'short' });
      const endMonth = end.toLocaleString('default', { month: 'short' });
      if (startMonth === endMonth) {
        return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
    }
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm bg-[#0d0b0a] border border-[#b2a491]/20 rounded-lg hover:bg-[#1a1614] transition-colors"
          >
            Today
          </button>
          <button
            onClick={goPrev}
            className="p-1.5 hover:bg-[#1a1614] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="p-1.5 hover:bg-[#1a1614] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <h2 className="text-lg font-medium ml-2">{formatHeader()}</h2>
        </div>
        <div className="flex items-center gap-1 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'week' ? 'bg-[#b2a491] text-[#0d0b0a]' : 'hover:bg-[#1a1614]'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'month' ? 'bg-[#b2a491] text-[#0d0b0a]' : 'hover:bg-[#1a1614]'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Day Headers */}
      <div className={`grid ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'} gap-px bg-[#b2a491]/10 rounded-t-lg overflow-hidden`}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="bg-[#0d0b0a] px-2 py-2 text-center text-xs font-medium text-[#888]">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin" />
        </div>
      ) : (
        <div className={`grid grid-cols-7 gap-px bg-[#b2a491]/10 rounded-b-lg overflow-hidden flex-1 ${
          viewMode === 'month' ? 'auto-rows-fr' : ''
        }`}>
          {days.map((day, index) => {
            const dayContent = getContentForDay(day);
            const today = isToday(day);
            const inMonth = viewMode === 'month' ? isCurrentMonth(day) : true;

            return (
              <div
                key={index}
                onClick={() => onCreateContent?.(day)}
                className={`bg-[#0d0b0a] p-2 ${viewMode === 'week' ? 'min-h-[120px]' : 'min-h-[80px]'} ${
                  !inMonth ? 'opacity-40' : ''
                } hover:bg-[#1a1614]/50 cursor-pointer transition-colors group`}
              >
                <div className={`text-sm mb-1 ${today ? 'text-[#b2a491] font-bold' : 'text-[#888]'}`}>
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayContent.slice(0, viewMode === 'week' ? 4 : 2).map((item) => {
                    const platforms: string[] = item.scheduled_platforms || [];
                    return (
                      <button
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditContent(item);
                        }}
                        className="w-full text-left p-1.5 bg-[#1a1614] hover:bg-[#252220] rounded text-xs truncate border border-[#b2a491]/10 transition-colors"
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          {platforms.slice(0, 3).map((p) => (
                            <span key={p} className={`w-1.5 h-1.5 rounded-full ${platformColors[p] || 'bg-gray-500'}`} />
                          ))}
                        </div>
                        <span className="truncate block">{item.title || 'Untitled'}</span>
                      </button>
                    );
                  })}
                  {dayContent.length > (viewMode === 'week' ? 4 : 2) && (
                    <div className="text-xs text-[#888] text-center">
                      +{dayContent.length - (viewMode === 'week' ? 4 : 2)} more
                    </div>
                  )}
                </div>
                {/* Quick add indicator on hover */}
                <div className="hidden group-hover:flex items-center justify-center mt-1 text-xs text-[#888]">
                  <span>+ Add</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Analytics View Component (placeholder)
function AnalyticsView({ content }: { content: SocialContent[] }) {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 mx-auto mb-4 text-[#888]">{Icons.chart}</div>
      <h3 className="text-lg font-medium mb-2">Analytics</h3>
      <p className="text-[#888] mb-4">{content.length} posted items to track</p>
      <p className="text-sm text-[#666]">Analytics tracking coming in Phase 3</p>
    </div>
  );
}
