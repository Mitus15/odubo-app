'use client';

/**
 * The Hub - Navigation Component
 * Mobile bottom nav + Desktop sidebar
 */

import React from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';
import type { Module } from '@/lib/hub/types';

// =============================================================================
// TYPES
// =============================================================================

interface HubNavigationProps {
  currentModule: Module;
  variant: 'sidebar' | 'bottom';
  onClose?: () => void;
}

interface NavItemConfig {
  id: Module;
  label: string;
  shortLabel: string;
  href: string;
  icon: string;
}

// =============================================================================
// NAVIGATION CONFIG
// =============================================================================

const navItems: NavItemConfig[] = [
  {
    id: 'content',
    label: 'Content Hub',
    shortLabel: 'Content',
    href: '/admin-v2/content',
    icon: 'grid',
  },
  {
    id: 'social',
    label: 'Social CMS',
    shortLabel: 'Social',
    href: '/admin-v2/social',
    icon: 'share',
  },
  {
    id: 'commerce',
    label: 'Commerce',
    shortLabel: 'Store',
    href: '/admin-v2/commerce',
    icon: 'shopping-bag',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    shortLabel: 'Stats',
    href: '/admin-v2/analytics',
    icon: 'chart',
  },
  {
    id: 'communications',
    label: 'Communications',
    shortLabel: 'Comms',
    href: '/admin-v2/communications',
    icon: 'message',
  },
  {
    id: 'projects',
    label: 'Projects',
    shortLabel: 'Tasks',
    href: '/admin-v2/projects',
    icon: 'clipboard',
  },
  {
    id: 'events',
    label: 'Events',
    shortLabel: 'Events',
    href: '/admin-v2/events',
    icon: 'calendar',
  },
  {
    id: 'system',
    label: 'System',
    shortLabel: 'System',
    href: '/admin-v2/system',
    icon: 'settings',
  },
];

// Mobile bottom nav shows limited items
const mobileNavItems = navItems.slice(0, 4); // Content, Social, Commerce, Analytics
const mobileMoreItems = navItems.slice(4); // Rest in "More" menu

// =============================================================================
// ICON COMPONENT
// =============================================================================

interface IconProps {
  name: string;
  className?: string;
}

function Icon({ name, className = '' }: IconProps) {
  const iconPaths: Record<string, JSX.Element> = {
    grid: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    ),
    share: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    ),
    'shopping-bag': (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    ),
    chart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    ),
    message: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    ),
    clipboard: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    ),
    calendar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    ),
    settings: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
    ),
    more: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    ),
    x: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    ),
    home: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`w-6 h-6 ${className}`}
    >
      {iconPaths[name] || iconPaths.grid}
    </svg>
  );
}

// =============================================================================
// SIDEBAR VARIANT
// =============================================================================

function SidebarNav({ currentModule, onClose }: { currentModule: Module; onClose?: () => void }) {
  const { hasModule, user, logout } = useHubUser();

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Header */}
      <div className="flex items-center justify-between h-[var(--hub-header-height)] px-4 border-b border-[var(--hub-border-subtle)]">
        <Link href="/admin-v2" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--hub-accent)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <span className="font-semibold text-[var(--hub-text-primary)]">The Hub</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 -mr-2 hub-btn-ghost rounded-lg"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 hub-scroll-hidden">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentModule === item.id;
            const hasAccess = hasModule(item.id);

            if (!hasAccess) return null;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-[var(--hub-accent-muted)] text-[var(--hub-accent-active)]'
                    : 'text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-tertiary)] hover:text-[var(--hub-text-primary)]'
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-[var(--hub-border-subtle)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[var(--hub-bg-tertiary)] flex items-center justify-center">
            <span className="text-sm font-medium text-[var(--hub-text-secondary)]">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--hub-text-primary)] truncate">
              {user?.firstName || user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-[var(--hub-text-muted)] truncate">
              {user?.roles?.[0]?.roleSlug || 'Member'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full hub-btn hub-btn-ghost text-sm justify-start"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// BOTTOM NAV VARIANT
// =============================================================================

function BottomNav({ currentModule }: { currentModule: Module }) {
  const { hasModule } = useHubUser();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Filter items user has access to
  const visibleItems = mobileNavItems.filter((item) => hasModule(item.id));
  const moreItems = mobileMoreItems.filter((item) => hasModule(item.id));
  const showMore = moreItems.length > 0;

  return (
    <>
      {/* More Menu Overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[var(--hub-z-overlay)]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-[calc(var(--hub-nav-height-mobile)+var(--hub-safe-bottom)+8px)] right-4 bg-[var(--hub-bg-secondary)] border border-[var(--hub-border-default)] rounded-xl shadow-lg overflow-hidden hub-animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {moreItems.map((item) => {
              const isActive = currentModule === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isActive
                      ? 'bg-[var(--hub-accent-muted)] text-[var(--hub-accent-active)]'
                      : 'text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-tertiary)]'
                  }`}
                >
                  <Icon name={item.icon} className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[var(--hub-z-sticky)] bg-[var(--hub-bg-primary)] border-t border-[var(--hub-border-subtle)]"
        style={{
          paddingBottom: 'var(--hub-safe-bottom)',
        }}
      >
        <div className="flex items-center justify-around h-[var(--hub-nav-height-mobile)]">
          {visibleItems.map((item) => {
            const isActive = currentModule === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                  isActive
                    ? 'text-[var(--hub-accent-active)]'
                    : 'text-[var(--hub-text-muted)]'
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.shortLabel}</span>
              </Link>
            );
          })}

          {showMore && (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                moreOpen || mobileMoreItems.some((i) => currentModule === i.id)
                  ? 'text-[var(--hub-accent-active)]'
                  : 'text-[var(--hub-text-muted)]'
              }`}
            >
              <Icon name="more" className="w-5 h-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HubNavigation({ currentModule, variant, onClose }: HubNavigationProps) {
  if (variant === 'sidebar') {
    return <SidebarNav currentModule={currentModule} onClose={onClose} />;
  }

  return <BottomNav currentModule={currentModule} />;
}
