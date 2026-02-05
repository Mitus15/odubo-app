'use client';

import { useState } from 'react';
import SocialAccountsTab from './SocialAccountsTab';
import SocialGrowthTab from './SocialGrowthTab';
import AIStudioTab from './AIStudioTab';

/**
 * Unified Social Tab - Consolidates all social functionality except deployment
 * - Connected Accounts (manage platform connections)
 * - Growth Analytics (follower/engagement metrics)
 * - AI Studio (AI content tools)
 * 
 * Deployment functionality lives in Arsenal tab
 */

export default function SocialTab() {
  const [activeSection, setActiveSection] = useState<'accounts' | 'growth' | 'ai'>('accounts');

  return (
    <div className="w-full pt-4 pb-20">
      {/* Section Tabs */}
      <div className="container mx-auto px-4 mb-6">
        <div className="flex gap-2 border-b border-[#302927]">
          <button
            onClick={() => setActiveSection('accounts')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'accounts'
                ? 'border-[#843c2d] text-[#ede8df]'
                : 'border-transparent text-[#726d6c] hover:text-[#b2a491]'
            }`}
          >
            Connected Accounts
          </button>
          <button
            onClick={() => setActiveSection('growth')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'growth'
                ? 'border-[#843c2d] text-[#ede8df]'
                : 'border-transparent text-[#726d6c] hover:text-[#b2a491]'
            }`}
          >
            Growth Analytics
          </button>
          <button
            onClick={() => setActiveSection('ai')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'ai'
                ? 'border-[#843c2d] text-[#ede8df]'
                : 'border-transparent text-[#726d6c] hover:text-[#b2a491]'
            }`}
          >
            AI Studio
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div className="container mx-auto px-4">
        {activeSection === 'accounts' && <SocialAccountsTab />}
        {activeSection === 'growth' && <SocialGrowthTab />}
        {activeSection === 'ai' && <AIStudioTab />}
      </div>
    </div>
  );
}
