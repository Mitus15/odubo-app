'use client';

/**
 * The Hub - Dashboard
 * Role-based landing page with quick stats and actions
 */

import React from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';
import type { Module } from '@/lib/hub/types';

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  href?: string;
  icon: string;
}

function StatCard({ label, value, change, href, icon }: StatCardProps) {
  const content = (
    <div className="hub-card p-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-[var(--hub-accent-muted)] flex items-center justify-center flex-shrink-0">
        <StatIcon name={icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--hub-text-muted)] mb-1">{label}</p>
        <p className="text-2xl font-semibold text-[var(--hub-text-primary)] truncate">
          {value}
        </p>
        {change && (
          <p
            className={`text-xs mt-1 ${
              change.direction === 'up'
                ? 'text-[var(--hub-success)]'
                : change.direction === 'down'
                ? 'text-[var(--hub-error)]'
                : 'text-[var(--hub-text-muted)]'
            }`}
          >
            {change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '→'}{' '}
            {Math.abs(change.value)}% vs last period
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

function StatIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    video: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
      />
    ),
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    ),
    cart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    ),
    chart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
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
      className="w-5 h-5 text-[var(--hub-accent-active)]"
    >
      {icons[name] || icons.chart}
    </svg>
  );
}

// =============================================================================
// QUICK ACTION CARD
// =============================================================================

interface QuickActionProps {
  label: string;
  description: string;
  href: string;
  icon: string;
  module: Module;
}

function QuickAction({ label, description, href, icon, module }: QuickActionProps) {
  const { hasModule } = useHubUser();

  if (!hasModule(module)) return null;

  return (
    <Link
      href={href}
      className="hub-card p-4 flex items-center gap-4 group"
    >
      <div className="w-12 h-12 rounded-xl bg-[var(--hub-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--hub-accent-muted)] transition-colors">
        <ActionIcon name={icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--hub-text-primary)] group-hover:text-[var(--hub-accent-active)] transition-colors">
          {label}
        </p>
        <p className="text-sm text-[var(--hub-text-muted)] truncate">{description}</p>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="w-5 h-5 text-[var(--hub-text-muted)] group-hover:text-[var(--hub-accent-active)] group-hover:translate-x-1 transition-all"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

function ActionIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    upload: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    ),
    share: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    ),
    inbox: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
      />
    ),
    report: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
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
      className="w-6 h-6 text-[var(--hub-text-secondary)]"
    >
      {icons[name] || icons.upload}
    </svg>
  );
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

export default function DashboardPage() {
  const { user, isFullAdmin, hasModule } = useHubUser();

  return (
    <div className="space-y-8 pb-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--hub-text-primary)] mb-1">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="text-[var(--hub-text-muted)]">
          Here&apos;s what&apos;s happening with your platform today.
        </p>
      </div>

      {/* Quick Stats */}
      <div>
        <h2 className="text-sm font-medium text-[var(--hub-text-secondary)] mb-3 uppercase tracking-wider">
          Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {hasModule('content') && (
            <StatCard
              label="Total Videos"
              value="--"
              icon="video"
              href="/admin-v2/content/videos"
            />
          )}
          {hasModule('analytics') && (
            <StatCard
              label="Active Users"
              value="--"
              icon="users"
              href="/admin-v2/analytics"
            />
          )}
          {hasModule('commerce') && (
            <StatCard
              label="Orders Today"
              value="--"
              icon="cart"
              href="/admin-v2/commerce/orders"
            />
          )}
          {hasModule('analytics') && (
            <StatCard
              label="Engagement"
              value="--"
              icon="chart"
              href="/admin-v2/analytics"
            />
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-[var(--hub-text-secondary)] mb-3 uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <QuickAction
            label="Upload Content"
            description="Add new videos, clips, or music"
            href="/admin-v2/content/videos"
            icon="upload"
            module="content"
          />
          <QuickAction
            label="Distribute to Social"
            description="Schedule posts across platforms"
            href="/admin-v2/social"
            icon="share"
            module="social"
          />
          <QuickAction
            label="View Messages"
            description="Check customer inquiries"
            href="/admin-v2/communications"
            icon="inbox"
            module="communications"
          />
          <QuickAction
            label="Generate Report"
            description="Export analytics and insights"
            href="/admin-v2/reports"
            icon="report"
            module="reports"
          />
        </div>
      </div>

      {/* Admin-only System Status */}
      {isFullAdmin && (
        <div>
          <h2 className="text-sm font-medium text-[var(--hub-text-secondary)] mb-3 uppercase tracking-wider">
            System Status
          </h2>
          <div className="hub-card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SystemStatus label="Database" status="operational" />
              <SystemStatus label="Storage" status="operational" />
              <SystemStatus label="Video CDN" status="operational" />
              <SystemStatus label="Shopify" status="operational" />
            </div>
          </div>
        </div>
      )}

      {/* Getting Started Guide (for new users) */}
      <div className="hub-card p-6 border border-[var(--hub-accent-muted)]">
        <h3 className="font-semibold text-[var(--hub-text-primary)] mb-2">
          Welcome to The Hub v2
        </h3>
        <p className="text-sm text-[var(--hub-text-secondary)] mb-4">
          This is your new enterprise command center. Explore the modules available to your role
          using the navigation below (mobile) or sidebar (desktop).
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="hub-badge hub-badge-accent">Phase 1: Content Hub</span>
          <span className="hub-badge hub-badge-default">Coming: Social CMS</span>
          <span className="hub-badge hub-badge-default">Coming: Commerce</span>
          <span className="hub-badge hub-badge-default">Coming: Analytics</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SYSTEM STATUS COMPONENT
// =============================================================================

function SystemStatus({ label, status }: { label: string; status: 'operational' | 'degraded' | 'down' }) {
  const statusColors = {
    operational: 'bg-[var(--hub-success)]',
    degraded: 'bg-[var(--hub-warning)]',
    down: 'bg-[var(--hub-error)]',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      <span className="text-sm text-[var(--hub-text-secondary)]">{label}</span>
    </div>
  );
}
