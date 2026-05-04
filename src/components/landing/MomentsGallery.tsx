'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';

interface Gallery {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  cover_thumb_url?: string;
  photo_count: number;
  starts_at?: string;
  preview_photos?: Array<{
    id: string;
    thumbnail_url?: string;
    r2_url?: string;
  }>;
}

interface MomentsGalleryProps {
  galleries: Gallery[];
}

export default function MomentsGallery({ galleries }: MomentsGalleryProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10%' });

  const heroGallery = galleries[0];
  const gridGalleries = galleries.slice(1, 5);

  if (!galleries.length) return null;

  return (
    <section ref={ref} id="moments" className="relative py-24 px-8 bg-[#0d0c0a]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-12 flex items-end justify-between"
        >
          <div>
            <p className="text-[#843c2d] text-sm font-medium uppercase tracking-[0.2em] mb-2">
              Moments
            </p>
            <h2 className="text-4xl xl:text-5xl font-bold text-[#ede8df]">
              Captured Memories
            </h2>
          </div>
          <a
            href="https://moments.odubo.studio"
            className="text-[#ede8df]/60 hover:text-[#ede8df] text-sm font-medium transition-colors flex items-center gap-2"
          >
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </motion.div>

        {/* Hero Gallery */}
        {heroGallery && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6"
          >
            <a
              href={`https://moments.odubo.studio/gallery/${heroGallery.id}`}
              className="group relative w-full aspect-[21/9] rounded-2xl overflow-hidden bg-[#1a1816]"
            >
              {heroGallery.cover_url ? (
                <Image
                  src={heroGallery.cover_url}
                  alt={heroGallery.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="80vw"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#843c2d]/20 to-[#1a1816]" />
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h3 className="text-[#ede8df] text-2xl font-semibold mb-2">
                  {heroGallery.title}
                </h3>
                <div className="flex items-center gap-4 text-[#ede8df]/60 text-sm">
                  {heroGallery.starts_at && (
                    <span>{new Date(heroGallery.starts_at).toLocaleDateString()}</span>
                  )}
                  <span>{heroGallery.photo_count} photos</span>
                </div>
              </div>
            </a>
          </motion.div>
        )}

        {/* Grid Galleries */}
        {gridGalleries.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {gridGalleries.map((gallery, index) => (
              <motion.a
                key={gallery.id}
                href={`https://moments.odubo.studio/gallery/${gallery.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                className="group relative aspect-square rounded-xl overflow-hidden bg-[#1a1816]"
              >
                {gallery.cover_url ? (
                  <Image
                    src={gallery.cover_url}
                    alt={gallery.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="25vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#502d26]/20 to-[#1a1816]" />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h4 className="text-[#ede8df] text-sm font-medium line-clamp-1">
                    {gallery.title}
                  </h4>
                  <p className="text-[#ede8df]/40 text-xs mt-1">
                    {gallery.photo_count} photos
                  </p>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
