'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MusicDistributionPanel } from './panels/MusicDistributionPanel';
import { VideoDistributionPanel } from './panels/VideoDistributionPanel';
import { AnalyticsDashboardPanel } from './panels/AnalyticsDashboardPanel';
import { DiscographyPanel } from './panels/DiscographyPanel';
import { SocialDistributionPanel } from './panels/SocialDistributionPanel';
import { SocialAccountsPanel } from './panels/SocialAccountsPanel';

type User = {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer' | null;
  is_admin: boolean;
};

type Section = 'music' | 'video' | 'analytics' | 'discography' | 'social' | 'accounts';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'video', label: 'Video', icon: '🎬' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'discography', label: 'Discography', icon: '💿' },
  { id: 'social', label: 'Social', icon: '📱' },
  { id: 'accounts', label: 'Accounts', icon: '🔗' },
];

interface CommandCenterShellProps {
  user: User;
}

export function CommandCenterShell({ user }: CommandCenterShellProps) {
  const [activeSection, setActiveSection] = useState<Section>('music');

  const renderPanel = () => {
    switch (activeSection) {
      case 'music':
        return <MusicDistributionPanel />;
      case 'video':
        return <VideoDistributionPanel />;
      case 'analytics':
        return <AnalyticsDashboardPanel />;
      case 'discography':
        return <DiscographyPanel />;
      case 'social':
        return <SocialDistributionPanel />;
      case 'accounts':
        return <SocialAccountsPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df] flex flex-col">
      {/* Top Bar */}
      <header className="flex-shrink-0 border-b border-[#502d26]/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Admin
            </Link>

            <div className="h-5 w-px bg-[#502d26]/40" />

            <div className="flex items-center gap-2">
              <span className="text-lg">🎛️</span>
              <h1 className="font-semibold">Command Center</h1>
            </div>
          </div>

          <span className="text-xs text-[#726d6c]">{user.email}</span>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeSection === section.id
                  ? 'bg-[#843c2d] text-white'
                  : 'text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927]'
              }`}
            >
              <span>{section.icon}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {renderPanel()}
      </main>
    </div>
  );
}
