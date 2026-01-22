'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ============================================
// Types
// ============================================

export interface Announcement {
  id: string;
  title: string;
  message: string;
  link_url?: string;
  link_text?: string;
  image_url?: string;
  target: 'store' | 'all' | 'moments' | 'media';
  priority: number;
  starts_at?: string;
  ends_at?: string;
}

interface AnnouncementsContextValue {
  // Active announcements
  storeAnnouncement: Announcement | null;
  momentsAnnouncement: Announcement | null;
  mediaAnnouncement: Announcement | null;

  // Badge state
  hasUnreadStoreAnnouncement: boolean;
  hasUnreadMomentsAnnouncement: boolean;
  hasUnreadMediaAnnouncement: boolean;

  // Actions
  dismissAnnouncement: (id: string) => void;
  markAsRead: (id: string) => void;
  refreshAnnouncements: () => Promise<void>;

  // Loading state
  isLoading: boolean;
}

// ============================================
// Context
// ============================================

const AnnouncementsContext = createContext<AnnouncementsContextValue | null>(null);

// ============================================
// Storage Keys
// ============================================

const DISMISSED_KEY = 'odubo_dismissed_announcements';
const READ_KEY = 'odubo_read_announcements';

// ============================================
// Provider
// ============================================

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load dismissed/read state from localStorage
  useEffect(() => {
    try {
      const dismissedStr = localStorage.getItem(DISMISSED_KEY);
      const readStr = localStorage.getItem(READ_KEY);

      if (dismissedStr) {
        setDismissedIds(new Set(JSON.parse(dismissedStr)));
      }
      if (readStr) {
        setReadIds(new Set(JSON.parse(readStr)));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Fetch announcements
  const refreshAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const data = await res.json() as { announcements: Announcement[] };
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    refreshAnnouncements();
  }, [refreshAnnouncements]);

  // Dismiss announcement (hide from view)
  const dismissAnnouncement = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  // Mark as read (for badge indicator)
  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  // Get active announcement for a target (not dismissed, highest priority)
  const getActiveAnnouncement = useCallback(
    (target: 'store' | 'moments' | 'media'): Announcement | null => {
      const now = new Date().toISOString();

      const eligible = announcements.filter(a => {
        // Check target
        if (a.target !== target && a.target !== 'all') return false;
        // Check not dismissed
        if (dismissedIds.has(a.id)) return false;
        // Check date range
        if (a.starts_at && a.starts_at > now) return false;
        if (a.ends_at && a.ends_at < now) return false;
        return true;
      });

      // Sort by priority (highest first)
      eligible.sort((a, b) => b.priority - a.priority);

      return eligible[0] || null;
    },
    [announcements, dismissedIds]
  );

  // Check if there's an unread announcement for badge
  const hasUnread = useCallback(
    (target: 'store' | 'moments' | 'media'): boolean => {
      const announcement = getActiveAnnouncement(target);
      if (!announcement) return false;
      return !readIds.has(announcement.id);
    },
    [getActiveAnnouncement, readIds]
  );

  const value: AnnouncementsContextValue = {
    storeAnnouncement: getActiveAnnouncement('store'),
    momentsAnnouncement: getActiveAnnouncement('moments'),
    mediaAnnouncement: getActiveAnnouncement('media'),
    hasUnreadStoreAnnouncement: hasUnread('store'),
    hasUnreadMomentsAnnouncement: hasUnread('moments'),
    hasUnreadMediaAnnouncement: hasUnread('media'),
    dismissAnnouncement,
    markAsRead,
    refreshAnnouncements,
    isLoading,
  };

  return (
    <AnnouncementsContext.Provider value={value}>
      {children}
    </AnnouncementsContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================

export function useAnnouncements() {
  const context = useContext(AnnouncementsContext);
  if (!context) {
    throw new Error('useAnnouncements must be used within AnnouncementsProvider');
  }
  return context;
}

// Safe version that returns null if not in provider
export function useAnnouncementsSafe() {
  return useContext(AnnouncementsContext);
}
