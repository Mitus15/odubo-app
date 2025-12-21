'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LinkTreeItem, LinkCategory } from '@/types/linktree';

interface LinkTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const categoryConfig: Record<LinkCategory, { label: string; icon: string; color: string }> = {
  streaming: { label: 'Music', icon: '', color: '#1DB954' },
  social: { label: 'Social', icon: '', color: '#E1306C' },
  video: { label: 'Video', icon: '', color: '#FF0000' },
  fashion: { label: 'B.A.A.D by Odubo', icon: '', color: '#000000' },
  store: { label: 'Store', icon: '', color: '#96BF48' },
  admin: { label: 'Personal', icon: '', color: '#6B7280' },
  other: { label: 'More', icon: '', color: '#8B5CF6' },
};

const platformIcons: Record<string, string> = {
  spotify: '🎧',
  apple_music: '🍎',
  youtube_music: '🎵',
  tidal: '🌊',
  instagram: '📷',
  tiktok: '🎬',
  twitter: '🐦',
  youtube: '▶️',
  vimeo: '🎥',
  shopify: '🛒',
};

export default function LinkTreeModal({ isOpen, onClose }: LinkTreeModalProps) {
  const [links, setLinks] = useState<LinkTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clickingId, setClickingId] = useState<number | null>(null);

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
    setClickingId(link.id);
    
    // Track click
    try {
      await fetch(`/api/linktree/${link.id}/click`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to track click:', error);
    }

    // Open link
    window.open(link.url, '_blank', 'noopener,noreferrer');
    
    setTimeout(() => setClickingId(null), 300);
  };

  // Group links by category
  const groupedLinks = links.reduce((acc, link) => {
    if (!acc[link.category]) {
      acc[link.category] = [];
    }
    acc[link.category].push(link);
    return acc;
  }, {} as Record<LinkCategory, LinkTreeItem[]>);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-xl bg-black/40"
          onClick={onClose}
        >
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-all text-white/80 hover:text-white backdrop-blur-md bg-white/10"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Grouped by Category */}
                  {Object.entries(groupedLinks).map(([category, categoryLinks]) => {
                    const config = categoryConfig[category as LinkCategory];
                    if (!config || categoryLinks.length === 0) return null;

                    return (
                      <div key={category} className="space-y-4">
                        <div className="flex justify-center items-center gap-4 flex-wrap">
                          {categoryLinks.map((link) => (
                            <motion.button
                              key={link.id}
                              onClick={() => handleLinkClick(link)}
                              whileHover={{ scale: 1.1, y: -4 }}
                              whileTap={{ scale: 0.9 }}
                              className="relative w-20 h-20 backdrop-blur-xl bg-gradient-to-br from-white/30 via-white/20 to-white/10 hover:from-white/40 hover:via-white/30 hover:to-white/20 border border-white/30 hover:border-white/50 transition-all duration-300 flex items-center justify-center overflow-hidden"
                              style={{
                                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2)',
                                borderRadius: '24px',
                              }}
                            >
                              {/* Glass reflection effect */}
                              <div 
                                className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60"
                                style={{ borderRadius: '24px' }}
                              />
                              
                              {/* Icon */}
                              <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
                                {link.title === 'B.A.A.D Store' ? (
                                  <img src="/brand-logos/baad-icon.svg" alt="B.A.A.D" className="w-full h-full object-contain drop-shadow-2xl" />
                                ) : link.title === 'B.A.A.D Instagram' ? (
                                  <svg viewBox="0 0 24 24" fill="white" className="w-full h-full drop-shadow-2xl">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                  </svg>
                                ) : link.platform === 'spotify' ? (
                                  <svg viewBox="0 0 24 24" fill="#1DB954" className="w-full h-full drop-shadow-2xl">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                  </svg>
                                ) : link.platform === 'apple_music' ? (
                                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/5f/Apple_Music_icon.svg" alt="Apple Music" className="w-full h-full object-contain drop-shadow-2xl" />
                                ) : link.platform === 'youtube' ? (
                                  <svg viewBox="0 0 24 24" fill="#FF0000" className="w-full h-full drop-shadow-2xl">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                  </svg>
                                ) : link.platform === 'instagram' ? (
                                  <svg viewBox="0 0 24 24" fill="url(#instagram-gradient)" className="w-full h-full drop-shadow-2xl">
                                    <defs>
                                      <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                                        <stop offset="0%" style={{stopColor: '#FFDD55'}} />
                                        <stop offset="25%" style={{stopColor: '#FF543E'}} />
                                        <stop offset="50%" style={{stopColor: '#C837AB'}} />
                                        <stop offset="100%" style={{stopColor: '#4F5BD5'}} />
                                      </linearGradient>
                                    </defs>
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                  </svg>
                                ) : link.platform === 'tiktok' ? (
                                  <svg viewBox="0 0 24 24" fill="white" className="w-full h-full drop-shadow-2xl">
                                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                                  </svg>
                                ) : (
                                  <span className="text-3xl drop-shadow-2xl">
                                    {link.platform && platformIcons[link.platform] ? platformIcons[link.platform] : config.icon}
                                  </span>
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {links.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-white/30 text-sm">No links available</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
