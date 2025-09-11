'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface VerseOfTheDay {
  text: string;
  reference: string;
  error: string | null;
}

interface HomePageClientProps {
  verseOfTheDay: VerseOfTheDay;
}

export default function HomePageClient({ verseOfTheDay }: HomePageClientProps) {
  // Real-time clock state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  // Mobile available height (window.innerHeight - fixed header)
  const [mobileAvailableHeight, setMobileAvailableHeight] = useState<number | null>(null);

  // Update clock every millisecond - but only after client mount
  useEffect(() => {
    // Set initial time immediately on mount
    setCurrentTime(new Date());
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1); // Update every millisecond

    return () => clearInterval(interval);
  }, []);

  // Format time with milliseconds
  const formatTime = (date: Date | null) => {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    
    return `${year} ${month} ${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  // Compute mobile available height so we can perfectly center content beneath the fixed header
  useEffect(() => {
    const headerHeight = 56; // px - keep in sync with header height

    function updateHeight() {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      // apply only for small viewports (mobile)
      if (width < 768) {
        setMobileAvailableHeight(window.innerHeight - headerHeight);
      } else {
        setMobileAvailableHeight(null);
      }
    }

    updateHeight();
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
    };
  }, []);

  return (
    <div className="h-screen bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] overflow-hidden">
      {/* Main Container - Centered content */}
      <div
        className="flex flex-col justify-center items-center p-8 md:h-full"
        style={mobileAvailableHeight ? { height: `${mobileAvailableHeight}px` } : undefined}
      >
        
        {/* The Words - Bible Verse Widget */}
        <div className="max-w-2xl mx-auto text-center">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-[#ede8df] to-[#b2a491] bg-clip-text text-transparent mb-4">
              The Words
            </h1>
            <p className="text-sm text-[#726d6c]/70 font-mono">
              {currentTime ? formatTime(currentTime) : 'Loading...'}
            </p>
          </div>
          
          {/* Verse Content */}
          <div className="mb-8">
            <blockquote className="text-lg md:text-xl text-[#ede8df] leading-relaxed italic mb-4">
              "{verseOfTheDay.text}"
            </blockquote>
            
            {verseOfTheDay.error && (
              <p className="text-sm text-[#843c2d]/80 italic mt-2">
                {verseOfTheDay.error}
              </p>
            )}
          </div>
          
          {/* The Light Button - Links to Music */}
          <Link href="/store" className="block">
            <div className="relative group">
              {/* Glowing background effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#ede8df]/20 via-[#b2a491]/30 to-[#ede8df]/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-0 group-hover:opacity-100"></div>
              
              {/* Main button */}
              <div className="relative px-12 py-4 bg-gradient-to-r from-[#ede8df] via-[#b2a491] to-[#ede8df] text-[#171616] font-bold text-lg rounded-2xl shadow-2xl transform group-hover:scale-105 group-hover:shadow-[0_0_40px_rgba(237,232,223,0.3)] transition-all duration-500 border border-[#ede8df]/50 overflow-hidden cursor-pointer">
                {/* Inner light effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                
                {/* Text with subtle shadow */}
                <span className="relative z-10 drop-shadow-sm">Store</span>
              </div>
              
              {/* Floating particles around the button */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-2 -left-2 w-2 h-2 bg-[#ede8df]/40 rounded-full blur-sm animate-pulse" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#b2a491]/50 rounded-full blur-sm animate-pulse" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
                <div className="absolute -bottom-2 left-1/2 w-1 h-1 bg-[#ede8df]/30 rounded-full blur-sm animate-pulse" style={{ animationDelay: '2s', animationDuration: '3.5s' }}></div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
