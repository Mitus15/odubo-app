"use client";
import { useState } from "react";
// import { useAuth } from "@/contexts/AuthContext";

export default function AppHeader() {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [navSubmenu, setNavSubmenu] = useState<"root" | "media" | "moments">("root");
  // const { isAuthenticated, user, logout } = useAuth();
  const isAuthenticated = false;
  const user: any = null;
  const logout = () => {};

  return (
    <>
      {/* Liquid Glass Header */}
      <header className="w-full h-14 px-4 flex items-center justify-between glass-surface fixed top-0 left-0 right-0 z-40 border-b border-[#502d26]/30 overflow-hidden safe-area-header">
        {/* Ambient background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#843c2d]/5 via-transparent to-[#502d26]/5"></div>
        
        {/* Brand Logo - Left Side (links to Home) */}
        <div className="relative z-10">
          <a href="/" aria-label="Home">
            <img 
              src="/odubo_logo_emboss.png" 
              alt="Odubo Studio" 
              className="w-8 h-8 object-contain"
            />
          </a>
        </div>

        {/* Desktop Navigation - Center/Right */}
        <nav className="hidden md:flex items-center gap-6 relative z-10">
          <a href="/featured" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">Featured</a>
          <a href="/music" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">Music</a>
          <a href="/media" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">Video</a>
          <a href="/moments" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">Moments</a>
          <a href="/clips" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">Clips</a>
          <a href="/store" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">Store</a>
        </nav>

        {/* Mobile Navigation button - Right Side */}
        <div className="md:hidden relative z-10">
          <button
            className="w-9 h-9 flex items-center justify-center text-[#ede8df] focus:outline-none rounded-lg hover:bg-[#843c2d]/10 hover:scale-105 transition-all duration-200"
            aria-label="Open navigation menu"
            onClick={() => {
              const next = !navMenuOpen;
              setNavMenuOpen(next);
              if (!next) setNavSubmenu("root");
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
            onClick={() => { setNavMenuOpen(false); setNavSubmenu("root"); }} 
          />
          
          {/* Navigation Menu Panel */}
          <div className="relative w-full max-w-sm mx-4">
            <div className="glass-surface rounded-3xl shadow-2xl border border-[#502d26]/30 overflow-hidden">
              {/* Navigation Links */}
              <div className="relative p-8 space-y-6">
                {/* Submenu header: Back only when inside a hub */}
                <div className="mb-4 flex items-center justify-start">
                  {navSubmenu !== "root" && (
                    <button
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#ede8df] transition-colors"
                      onClick={() => setNavSubmenu("root")}
                      aria-label="Back to main menu"
                    >
                      Back
                    </button>
                  )}
                </div>

                {/* Root or Submenus */}
                {navSubmenu === "root" && (
                  <nav className="space-y-4">
                    <a 
                      href="/featured" 
                      className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                      onClick={() => { setNavMenuOpen(false); setNavSubmenu("root"); }}
                    >
                      Featured
                    </a>
                    <button 
                      className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                      onClick={() => setNavSubmenu("media")}
                    >
                      Media
                    </button>
                    <button 
                      className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                      onClick={() => setNavSubmenu("moments")}
                    >
                      Moments
                    </button>
                    <a 
                      href="/store" 
                      className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                      onClick={() => { setNavMenuOpen(false); setNavSubmenu("root"); }}
                    >
                      Store
                    </a>
                  </nav>
                )}

                {navSubmenu === "media" && (
                  <nav className="space-y-4">
                    <a 
                      href="/music" 
                      className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                      onClick={() => { setNavMenuOpen(false); setNavSubmenu("root"); }}
                    >
                      Music
                    </a>
                    <a 
                      href="/media" 
                      className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                      onClick={() => { setNavMenuOpen(false); setNavSubmenu("root"); }}
                    >
                      Video
                    </a>
                  </nav>
                )}

                {navSubmenu === "moments" && (
                  <nav className="space-y-4">
                    <a 
                      href="/moments" 
                      className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                      onClick={() => { setNavMenuOpen(false); setNavSubmenu("root"); }}
                    >
                      Moments
                    </a>
                    <a 
                      href="/clips" 
                      className="block w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-200 text-center text-[#ede8df] font-medium hover:scale-105"
                      onClick={() => { setNavMenuOpen(false); setNavSubmenu("root"); }}
                    >
                      Clips
                    </a>
                  </nav>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Menu Dropdown */}
      {profileMenuOpen && (
        <div className="fixed top-16 left-4 z-50">
          <div className="glass-surface rounded-2xl shadow-2xl border border-[#502d26]/30 overflow-hidden">
            <div className="p-4 space-y-2">
              <button
                onClick={logout}
                className="w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-[#ede8df] text-left"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}