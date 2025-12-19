'use client';

/**
 * The Hub - Settings Overview
 * Administrative settings and configuration
 */

import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';

const settingsCards = [
  {
    title: 'Team & Roles',
    description: 'Manage team members and assign roles',
    href: '/admin-v2/settings/team',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    requiresAdmin: true,
  },
  {
    title: 'Account',
    description: 'Your profile and preferences',
    href: '/admin-v2/settings/account',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    requiresAdmin: false,
  },
  {
    title: 'System',
    description: 'System health and diagnostics',
    href: '/admin-v2/settings/system',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
    requiresAdmin: true,
  },
];

export default function SettingsPage() {
  const { canAccess } = useHubUser();
  const isAdmin = canAccess('system', 'admin');

  const visibleCards = settingsCards.filter(
    (card) => !card.requiresAdmin || isAdmin
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--hub-text-primary)]">
          Settings
        </h1>
        <p className="text-[var(--hub-text-muted)] mt-1">
          Manage your account and system configuration
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="hub-card p-5 group hover:border-[var(--hub-accent)]/40 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-[var(--hub-bg-tertiary)] text-[var(--hub-text-secondary)] group-hover:bg-[var(--hub-accent)]/10 group-hover:text-[var(--hub-accent)] transition-colors">
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[var(--hub-text-primary)] group-hover:text-[var(--hub-accent-active)] transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-[var(--hub-text-muted)] mt-0.5">
                  {card.description}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-[var(--hub-text-muted)] group-hover:text-[var(--hub-accent)] transition-colors"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
