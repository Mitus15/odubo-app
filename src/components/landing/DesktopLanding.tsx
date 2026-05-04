'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ClipItem } from '@/types/clips';
import type { Track, Album } from '@/types/music';
import HeroSection from './HeroSection';
import NavigationDock from './NavigationDock';
import VerseInterlude from './VerseInterlude';
import ClipsShowcase from './ClipsShowcase';
import MusicZone from './MusicZone';
import StorePreview from './StorePreview';
import ProductsSection from './ProductsSection';
import MomentsGallery from './MomentsGallery';
import MediaHub from './MediaHub';
import Footer from './Footer';

interface VerseOfTheDay {
  text: string;
  reference: string;
  error: string | null;
}

interface DesktopLandingProps {
  verseOfTheDay: VerseOfTheDay;
  initialClips: ClipItem[];
}

const SECTION_IDS = ['hero', 'clips', 'music', 'store', 'products', 'moments', 'media'];

export default function DesktopLanding({ verseOfTheDay, initialClips }: DesktopLandingProps) {
  const [activeSection, setActiveSection] = useState('hero');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [clips, setClips] = useState<ClipItem[]>(initialClips);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [galleries, setGalleries] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set(['hero']));

  const observerRef = useRef<IntersectionObserver | null>(null);

  // IntersectionObserver for scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            setLoadedSections((prev) => new Set([...prev, entry.target.id]));
          }
        });
      },
      { threshold: 0.3, rootMargin: '-10% 0px -10% 0px' }
    );

    observerRef.current = observer;

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? scrollTop / docHeight : 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll to section
  const handleNavigate = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Fetch data for sections as they come into view
  useEffect(() => {
    const fetchSectionData = async (section: string) => {
      if (loadedSections.has(section)) return;

      try {
        switch (section) {
          case 'clips':
            if (!clips.length) {
              const res = await fetch('/api/clips?limit=12');
              const data = await res.json() as { clips?: ClipItem[] };
              setClips(data.clips || []);
            }
            break;
          case 'music':
            if (!tracks.length) {
              const [tracksRes, albumsRes] = await Promise.all([
                fetch('/api/tracks'),
                fetch('/api/albums?limit=10'),
              ]);
              const tracksData = await tracksRes.json() as { success?: boolean; tracks?: Track[] };
              const albumsData = await albumsRes.json() as { success?: boolean; albums?: Album[] };
              if (tracksData.success) setTracks(tracksData.tracks || []);
              if (albumsData.success) setAlbums(albumsData.albums || []);
            }
            break;
          case 'store':
            if (!products.length) {
              const res = await fetch('/api/shopify/products');
              const data = await res.json() as { products?: any[] };
              setProducts(data.products || []);
            }
            break;
          case 'moments':
            if (!galleries.length) {
              const res = await fetch('/api/moments/galleries/public?limit=5&preview=true');
              const data = await res.json() as { galleries?: any[] };
              setGalleries(data.galleries || []);
            }
            break;
          case 'media':
            if (!videos.length) {
              const res = await fetch('/api/videos?limit=7&type=video');
              const data = await res.json() as { videos?: any[] };
              setVideos(data.videos || []);
            }
            break;
        }
        setLoadedSections((prev) => new Set([...prev, section]));
      } catch (error) {
        console.error(`Failed to fetch ${section} data:`, error);
      }
    };

    fetchSectionData(activeSection);

    const currentIndex = SECTION_IDS.indexOf(activeSection);
    if (currentIndex < SECTION_IDS.length - 1) {
      const nextSection = SECTION_IDS[currentIndex + 1];
      fetchSectionData(nextSection);
    }
  }, [activeSection, loadedSections, clips.length, tracks.length, products.length, galleries.length, videos.length]);

  return (
    <div className="bg-[#0d0c0a] min-h-screen snap-y snap-mandatory overflow-y-scroll">
      {/* Hero Section */}
      <div className="snap-start">
        <HeroSection
          initialClips={initialClips}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Verse Interlude */}
      {verseOfTheDay?.text && (
        <div className="snap-start">
          <VerseInterlude text={verseOfTheDay.text} reference={verseOfTheDay.reference} />
        </div>
      )}

      {/* Clips Showcase */}
      {loadedSections.has('clips') && (
        <div className="snap-start">
          <ClipsShowcase clips={clips} />
        </div>
      )}

      {/* Music Zone */}
      {loadedSections.has('music') && albums.length > 0 && (
        <div className="snap-start">
          <MusicZone albums={albums} tracks={tracks} />
        </div>
      )}

      {/* Store Preview */}
      {loadedSections.has('store') && products.length > 0 && (
        <div className="snap-start">
          <StorePreview products={products.slice(0, 4)} />
        </div>
      )}

      {/* Products Section */}
      {loadedSections.has('store') && products.length > 4 && (
        <div className="snap-start">
          <ProductsSection products={products} />
        </div>
      )}

      {/* Moments Gallery */}
      {loadedSections.has('moments') && galleries.length > 0 && (
        <div className="snap-start">
          <MomentsGallery galleries={galleries} />
        </div>
      )}

      {/* Media Hub */}
      {loadedSections.has('media') && videos.length > 0 && (
        <div className="snap-start">
          <MediaHub videos={videos} />
        </div>
      )}

      {/* Footer */}
      <div className="snap-start">
        <Footer />
      </div>

      {/* Navigation Dock */}
      <NavigationDock
        activeSection={activeSection}
        onNavigate={handleNavigate}
        scrollProgress={scrollProgress}
      />
    </div>
  );
}
