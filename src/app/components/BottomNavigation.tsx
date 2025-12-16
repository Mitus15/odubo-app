'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

export default function BottomNavigation() {
  const pathname = usePathname();
  const { state } = useMusicPlayer();

  const navItems = [
    {
      href: '/media',
      label: 'Media',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-[#843c2d]' : 'text-[#726d6c]'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
        </svg>
      ),
    },
    {
      href: '/store',
      label: 'Maison',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-[#843c2d]' : 'text-[#726d6c]'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
        </svg>
      ),
    },
    {
      href: '/search',
      label: 'Search',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-[#843c2d]' : 'text-[#726d6c]'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      ),
    },
  ];

  // Adjust padding based on whether music player is active
  const paddingBottom = state.currentTrack ? 'pb-24' : 'pb-3';

  return (
    <nav className={`fixed bottom-0 left-0 right-0 glass-surface border-t border-[#502d26]/30 z-30 ${state.currentTrack ? 'hidden md:block' : 'block'} overflow-hidden`}>
      {/* Background particle effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-2 left-1/4 w-1 h-1 bg-[#ede8df]/20 rounded-full blur-sm liquid-pulse opacity-50" style={{ animationDelay: '0s', animationDuration: '4s' }}></div>
        <div className="absolute bottom-1 right-1/3 w-1.5 h-1.5 bg-[#b2a491]/15 rounded-full blur-sm liquid-float opacity-40" style={{ animationDelay: '2s', animationDuration: '6s' }}></div>
        <div className="absolute top-1 right-1/4 w-1 h-1 bg-[#843c2d]/25 rounded-full blur-sm liquid-wave opacity-30" style={{ animationDelay: '1s', animationDuration: '5s' }}></div>
        <div className="absolute bottom-2 left-1/2 w-1 h-1 bg-[#ede8df]/15 rounded-full blur-sm liquid-flow opacity-35" style={{ animationDelay: '3s', animationDuration: '7s' }}></div>
      </div>
      
      {/* Ambient background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#843c2d]/5 via-transparent to-[#502d26]/5"></div>
      
      <div className={`relative flex items-center justify-around py-3 px-4 max-w-md mx-auto ${paddingBottom}`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-3 group transition-all duration-200 hover:scale-105 glass-card rounded-xl hover:bg-[#843c2d]/10 ${
                isActive ? 'bg-[#843c2d]/15 scale-105' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center glass-card transition-all duration-200 ${
                isActive ? 'bg-[#843c2d]/20' : 'group-hover:bg-[#843c2d]/10'
              }`}>
                {item.icon(isActive)}
              </div>
              <span className={`text-xs mt-1 transition-colors ${
                isActive ? 'text-[#843c2d]' : 'text-[#726d6c] group-hover:text-[#ede8df]'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}