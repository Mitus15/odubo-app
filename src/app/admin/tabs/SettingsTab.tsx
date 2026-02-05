'use client';

import { useState } from 'react';
import AccountTab from './AccountTab';
import StorageTab from './StorageTab';
import ApiKeysTab from './ApiKeysTab';

/**
 * Unified Settings Tab - Consolidates system/account settings
 * - Account (user profile, preferences)
 * - Storage (R2 storage management)
 * - API Keys (integration credentials)
 */

export default function SettingsTab() {
  const [activeSection, setActiveSection] = useState<'account' | 'storage' | 'api'>('account');

  return (
    <div className="w-full pt-4 pb-20">
      {/* Section Tabs */}
      <div className="container mx-auto px-4 mb-6">
        <div className="flex gap-2 border-b border-[#302927]">
          <button
            onClick={() => setActiveSection('account')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'account'
                ? 'border-[#843c2d] text-[#ede8df]'
                : 'border-transparent text-[#726d6c] hover:text-[#b2a491]'
            }`}
          >
            Account
          </button>
          <button
            onClick={() => setActiveSection('storage')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'storage'
                ? 'border-[#843c2d] text-[#ede8df]'
                : 'border-transparent text-[#726d6c] hover:text-[#b2a491]'
            }`}
          >
            Storage
          </button>
          <button
            onClick={() => setActiveSection('api')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeSection === 'api'
                ? 'border-[#843c2d] text-[#ede8df]'
                : 'border-transparent text-[#726d6c] hover:text-[#b2a491]'
            }`}
          >
            API Keys
          </button>
        </div>
      </div>

      {/* Section Content */}
      <div className="container mx-auto px-4">
        {activeSection === 'account' && <AccountTab />}
        {activeSection === 'storage' && <StorageTab />}
        {activeSection === 'api' && <ApiKeysTab />}
      </div>
    </div>
  );
}
