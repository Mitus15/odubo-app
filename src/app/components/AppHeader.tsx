"use client";
import { useState } from "react";

export default function AppHeader() {
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  return (
    <>
      {/* Liquid Glass Header */}
      <header
        className="w-full h-14 px-4 flex items-center justify-between glass-surface fixed top-0 left-0 right-0 z-40 border-b border-[#502d26]/30 overflow-hidden safe-area-header"
        style={{ ['--app-nav-height' as any]: '56px' }}
      >
        {/* Ambient background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#843c2d]/5 via-transparent to-[#502d26]/5"></div>
        
        {/* Brand Logo - Left Side (links to Home) */}
        <div className="relative z-10">
          <a href="/" aria-label="Home">
            <img 
              src="/brand-logos/baad-logo.png" 
              alt="Odubo Studio" 
              className="w-8 h-8 object-contain"
            />
          </a>
        </div>

        {/* Desktop Navigation - Center/Right */}
        <nav className="hidden md:flex items-center gap-6 relative z-10">
          {/* ARCHIVED: Media page - UI hidden, use master button for Moments */}
          {/* <a href="/media" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">Media</a> */}
          <a href="/store" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">Maison</a>
          <a href="/login" className="text-[#b2a491]/60 hover:text-[#b2a491] transition-colors text-xs">sign in</a>
        </nav>

        {/* Mobile Navigation button - Right Side */}
        <div className="md:hidden relative z-10">
          <button
            className="w-9 h-9 flex items-center justify-center text-[#ede8df] focus:outline-none rounded-lg hover:bg-[#843c2d]/10 hover:scale-105 transition-all duration-200"
            aria-label="Open navigation menu"
            onClick={() => {
              const next = !navMenuOpen;
              setNavMenuOpen(next);
            }}
          >
            {/* Hamburger icon */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Liquid Glass Mobile Nav Menu */}
      {navMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex items-center justify-center">
          {/* Enhanced Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => { setNavMenuOpen(false); }} 
          />
          
          {/* Navigation Menu Panel */}
          <div className="relative w-full max-w-sm mx-4">
            <div className="glass-surface rounded-3xl shadow-2xl border border-[#502d26]/30 overflow-hidden">
              {/* Navigation Links */}
              <div className="relative p-8 space-y-6">
                <nav className="space-y-4">
                  {/* ARCHIVED: Media page - UI hidden, use master button for Moments */}
                  {/* <a 
                    href="/media" 
                    className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                    onClick={() => { setNavMenuOpen(false); }}
                  >
                    Media
                  </a> */}
                  <a 
                    href="/moments" 
                    className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                    onClick={() => { setNavMenuOpen(false); }}
                  >
                    Moments
                  </a>
                  <a 
                    href="/store" 
                    className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                    onClick={() => { setNavMenuOpen(false); }}
                  >
                    Maison
                  </a>
                  <a 
                    href="/login" 
                    className="block w-full text-center text-[#b2a491]/60 hover:text-[#b2a491] transition-colors text-xs mt-4"
                    onClick={() => { setNavMenuOpen(false); }}
                  >
                    sign in
                  </a>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}