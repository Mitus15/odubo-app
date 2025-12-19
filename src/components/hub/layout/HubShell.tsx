'use client';

/**
 * The Hub - Shell Layout
 * Main app shell with navigation and content area
 */

import React, { ReactNode, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { HubNavigation } from './HubNavigation';
import { HubHeader } from './HubHeader';
import { useHubUser } from '@/contexts/HubUserContext';
import type { Module } from '@/lib/hub/types';

// =============================================================================
// TYPES
// =============================================================================

interface HubShellProps {
  children: ReactNode;
}

// =============================================================================
// MODULE MAPPING
// =============================================================================

const pathToModule: Record<string, Module> = {
  '/admin-v2': 'content',
  '/admin-v2/content': 'content',
  '/admin-v2/content/videos': 'content',
  '/admin-v2/content/clips': 'content',
  '/admin-v2/content/music': 'content',
  '/admin-v2/content/moments': 'content',
  '/admin-v2/social': 'social',
  '/admin-v2/commerce': 'commerce',
  '/admin-v2/analytics': 'analytics',
  '/admin-v2/communications': 'communications',
  '/admin-v2/projects': 'projects',
  '/admin-v2/events': 'events',
  '/admin-v2/system': 'system',
  '/admin-v2/reports': 'reports',
  '/admin-v2/settings': 'system',
};

function getModuleFromPath(pathname: string): Module {
  // Exact match first
  if (pathToModule[pathname]) {
    return pathToModule[pathname];
  }

  // Prefix match
  for (const [path, module] of Object.entries(pathToModule)) {
    if (pathname.startsWith(path + '/')) {
      return module;
    }
  }

  return 'content'; // Default
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HubShell({ children }: HubShellProps) {
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useHubUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const currentModule = getModuleFromPath(pathname);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  // Loading state
  if (isLoading) {
    return (
      <div className="hub-app flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[var(--hub-accent)] border-t-transparent rounded-full hub-animate-spin" />
          <p className="hub-text-muted">Loading The Hub...</p>
        </div>
      </div>
    );
  }

  // Not authenticated (will redirect via context)
  if (!isAuthenticated) {
    return (
      <div className="hub-app flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <p className="hub-text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-app flex min-h-screen">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className="hidden lg:flex flex-col w-[var(--hub-sidebar-width)] bg-[var(--hub-bg-primary)] border-r border-[var(--hub-border-subtle)] fixed inset-y-0 left-0 z-[var(--hub-z-sticky)]"
        >
          <HubNavigation
            currentModule={currentModule}
            variant="sidebar"
            onClose={() => setSidebarOpen(false)}
          />
        </aside>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-[var(--hub-z-overlay)]"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar */}
          <aside
            className="fixed inset-y-0 left-0 w-[280px] bg-[var(--hub-bg-primary)] border-r border-[var(--hub-border-subtle)] z-[var(--hub-z-modal)] hub-animate-slide-in-left"
            style={{
              animation: 'hubSlideInLeft 200ms ease',
            }}
          >
            <HubNavigation
              currentModule={currentModule}
              variant="sidebar"
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen ${
          !isMobile ? 'lg:ml-[var(--hub-sidebar-width)]' : ''
        }`}
      >
        {/* Header */}
        <HubHeader
          currentModule={currentModule}
          onMenuClick={() => setSidebarOpen(true)}
          showMenuButton={isMobile}
        />

        {/* Page Content */}
        <main
          className="flex-1 overflow-y-auto hub-scroll-styled"
          style={{
            paddingBottom: isMobile
              ? 'calc(var(--hub-nav-height-mobile) + var(--hub-safe-bottom))'
              : '0',
          }}
        >
          <div className="max-w-[var(--hub-content-max-width)] mx-auto p-[var(--hub-content-padding)]">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <HubNavigation
            currentModule={currentModule}
            variant="bottom"
          />
        )}
      </div>

      {/* Custom CSS for slide animation */}
      <style jsx global>{`
        @keyframes hubSlideInLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
