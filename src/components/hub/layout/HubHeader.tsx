'use client';

/**
 * The Hub - Header Component
 * Module header with breadcrumbs and actions
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Module } from '@/lib/hub/types';

// =============================================================================
// TYPES
// =============================================================================

interface HubHeaderProps {
  currentModule: Module;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

// =============================================================================
// MODULE LABELS
// =============================================================================

const moduleLabels: Record<Module, string> = {
  content: 'Content Hub',
  social: 'Social CMS',
  commerce: 'Commerce',
  analytics: 'Analytics',
  communications: 'Communications',
  projects: 'Projects',
  events: 'Events',
  system: 'System',
  reports: 'Reports',
  marketing: 'Marketing',
};

// =============================================================================
// BREADCRUMB GENERATION
// =============================================================================

interface Breadcrumb {
  label: string;
  href: string;
}

function generateBreadcrumbs(pathname: string): Breadcrumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [];

  // Always start with The Hub
  breadcrumbs.push({ label: 'Hub', href: '/admin-v2' });

  // Build path progressively
  let currentPath = '';
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += '/' + segment;

    // Convert segment to label
    let label = segment.charAt(0).toUpperCase() + segment.slice(1);

    // Check if it's a module
    if (moduleLabels[segment as Module]) {
      label = moduleLabels[segment as Module];
    }

    // Skip IDs (numeric or UUID-like)
    if (/^[0-9a-f-]+$/i.test(segment) && segment.length > 5) {
      label = 'Details';
    }

    breadcrumbs.push({
      label,
      href: '/admin-v2' + currentPath,
    });
  }

  return breadcrumbs;
}

// =============================================================================
// ICON COMPONENT
// =============================================================================

function MenuIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  );
}

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HubHeader({
  currentModule,
  onMenuClick,
  showMenuButton = false,
}: HubHeaderProps) {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname);

  return (
    <header
      className="sticky top-0 z-[var(--hub-z-sticky)] bg-[var(--hub-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--hub-border-subtle)]"
      style={{
        paddingTop: 'var(--hub-safe-top)',
      }}
    >
      <div className="flex items-center gap-3 h-[var(--hub-header-height)] px-4">
        {/* Menu Button (Mobile) */}
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-lg hub-btn-ghost"
            aria-label="Open menu"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        )}

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 min-w-0 flex-1" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 min-w-0">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;

              return (
                <li key={crumb.href} className="flex items-center gap-1 min-w-0">
                  {index > 0 && (
                    <ChevronIcon className="w-3 h-3 text-[var(--hub-text-muted)] flex-shrink-0" />
                  )}

                  {isLast ? (
                    <span className="text-sm font-medium text-[var(--hub-text-primary)] truncate">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-sm text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] truncate"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Right Actions (placeholder for notifications, etc.) */}
        <div className="flex items-center gap-2">
          {/* Future: Notifications bell, quick actions, etc. */}
        </div>
      </div>
    </header>
  );
}
