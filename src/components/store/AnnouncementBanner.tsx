'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnnouncementsSafe, type Announcement } from '@/contexts/AnnouncementsContext';

interface AnnouncementBannerProps {
  target: 'store' | 'moments' | 'media';
  className?: string;
}

export default function AnnouncementBanner({ target, className = '' }: AnnouncementBannerProps) {
  const announcementsCtx = useAnnouncementsSafe();

  // Get announcement based on target
  const announcement: Announcement | null =
    target === 'store'
      ? announcementsCtx?.storeAnnouncement ?? null
      : target === 'moments'
        ? announcementsCtx?.momentsAnnouncement ?? null
        : announcementsCtx?.mediaAnnouncement ?? null;

  // Mark as read when shown
  useEffect(() => {
    if (announcement && announcementsCtx) {
      announcementsCtx.markAsRead(announcement.id);
    }
  }, [announcement?.id, announcementsCtx]);

  const handleDismiss = useCallback(() => {
    if (announcement && announcementsCtx) {
      announcementsCtx.dismissAnnouncement(announcement.id);
    }
  }, [announcement, announcementsCtx]);

  if (!announcement) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`overflow-hidden ${className}`}
      >
        <div className="relative bg-gradient-to-r from-[#843c2d] via-[#a85540] to-[#843c2d] rounded-xl mx-4 mt-2 p-3 text-white shadow-lg">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 transition-colors"
            aria-label="Dismiss announcement"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image (if provided) */}
          {announcement.image_url && (
            <div className="mb-2 rounded-lg overflow-hidden">
              <img
                src={announcement.image_url}
                alt=""
                className="w-full h-24 object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="pr-8">
            <h3 className="font-semibold text-sm mb-0.5">{announcement.title}</h3>
            <p className="text-white/90 text-xs leading-relaxed">{announcement.message}</p>

            {/* Link (if provided) */}
            {announcement.link_url && (
              <a
                href={announcement.link_url}
                target={announcement.link_url.startsWith('http') ? '_blank' : undefined}
                rel={announcement.link_url.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-white/90 hover:text-white transition-colors underline underline-offset-2"
              >
                {announcement.link_text || 'Learn more'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
