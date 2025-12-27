'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LinkTreeItem } from '@/types/linktree';

interface LinkTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Platform icon components - inline SVGs for reliability
function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function AppleMusicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#FA2D48">
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.1-1.267-.315-.812-.09-1.79.574-2.306.37-.287.803-.46 1.26-.575.47-.118.944-.22 1.414-.337.25-.063.47-.18.59-.42.1-.19.12-.39.12-.59V8.76c0-.12-.02-.24-.09-.34-.1-.13-.24-.19-.4-.19-.18 0-.37.03-.55.07l-4.68 1.04c-.03 0-.06.01-.09.02-.35.07-.49.24-.52.6v7.69c0 .43-.06.85-.25 1.24-.3.59-.76.96-1.39 1.14-.35.1-.71.16-1.08.18-.96.04-1.8-.46-2.12-1.28-.31-.81-.09-1.78.58-2.3.37-.29.8-.46 1.26-.58.46-.12.93-.22 1.4-.34.26-.06.49-.19.6-.44.09-.18.11-.37.11-.57V7.13c0-.3.07-.58.27-.8.18-.2.4-.32.67-.38l6.32-1.41c.23-.05.46-.1.7-.13.3-.04.58.06.78.3.14.17.21.38.21.6v4.78z"/>
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDD55" />
          <stop offset="25%" stopColor="#FF543E" />
          <stop offset="50%" stopColor="#C837AB" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
      <path d="M16 6V4a4 4 0 10-8 0v2H4a1 1 0 00-1 1v12a3 3 0 003 3h12a3 3 0 003-3V7a1 1 0 00-1-1h-4zm-6-2a2 2 0 114 0v2h-4V4zm9 15a1 1 0 01-1 1H6a1 1 0 01-1-1V8h14v11z"/>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="white" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

// Get icon for platform
function getPlatformIcon(platform: string | null) {
  switch (platform) {
    case 'spotify': return <SpotifyIcon />;
    case 'apple_music': return <AppleMusicIcon />;
    case 'youtube': return <YouTubeIcon />;
    case 'instagram': return <InstagramIcon />;
    case 'tiktok': return <TikTokIcon />;
    case 'shopify': return <ShopIcon />;
    default: return <LinkIcon />;
  }
}

export default function LinkTreeModal({ isOpen, onClose }: LinkTreeModalProps) {
  const [links, setLinks] = useState<LinkTreeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchLinks();
    }
  }, [isOpen]);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/linktree');
      if (res.ok) {
        const data = await res.json() as { links?: LinkTreeItem[] };
        setLinks(data.links || []);
      }
    } catch (error) {
      console.error('Failed to fetch links:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClick = async (link: LinkTreeItem) => {
    // Track click (fire and forget)
    fetch(`/api/linktree/${link.id}/click`, { method: 'POST' }).catch(() => {});
    // Open link
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] flex flex-col bg-black/90 backdrop-blur-md"
          onClick={onClose}
        >
          {/* Close button - top right */}
          <div className="flex justify-end p-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content - centered */}
          <div
            className="flex-1 flex flex-col items-center justify-center px-6 pb-8 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loading ? (
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : links.length === 0 ? (
              <p className="text-white/40 text-sm">No links available</p>
            ) : (
              <div className="w-full max-w-sm space-y-3">
                {links.map((link, index) => (
                  <motion.button
                    key={link.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    onClick={() => handleLinkClick(link)}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 transition-all active:scale-[0.98]"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="flex-shrink-0">
                      {getPlatformIcon(link.platform)}
                    </div>
                    <span className="flex-1 text-left text-white font-medium">
                      {link.title}
                    </span>
                    <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
