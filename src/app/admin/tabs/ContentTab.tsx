'use client';

import { useState } from 'react';

type ContentType = 'music' | 'videos' | 'galleries' | 'featured';

export default function ContentTab() {
  const [activeType, setActiveType] = useState<ContentType>('music');

  const contentSections = [
    { id: 'music' as ContentType, label: 'Music Library', icon: '🎵', count: 0 },
    { id: 'videos' as ContentType, label: 'Video Library', icon: '🎬', count: 0 },
    { id: 'galleries' as ContentType, label: 'Moments', icon: '📸', count: 0 },
    { id: 'featured' as ContentType, label: 'Featured Content', icon: '⭐', count: 0 },
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#ede8df]">Content Management</h2>
        <p className="text-sm text-[#b2a491] mt-1">Unified view of all your content across the platform</p>
      </div>

      {/* Content Type Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {contentSections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveType(section.id)}
            className={`p-6 rounded-xl text-left transition-all ${
              activeType === section.id
                ? 'bg-[#843c2d] ring-2 ring-[#843c2d]/50'
                : 'bg-[#302927] hover:bg-[#403633]'
            }`}
          >
            <div className="text-4xl mb-3">{section.icon}</div>
            <h3 className="text-lg font-semibold text-[#ede8df] mb-1">{section.label}</h3>
            <div className="text-2xl font-bold text-[#ede8df]">{section.count}</div>
          </button>
        ))}
      </div>

      {/* Content Details */}
      <div className="bg-[#302927] rounded-xl p-8">
        <div className="text-center">
          <div className="text-5xl mb-4">
            {contentSections.find(s => s.id === activeType)?.icon}
          </div>
          <h3 className="text-xl font-bold text-[#ede8df] mb-2">
            {contentSections.find(s => s.id === activeType)?.label}
          </h3>
          <p className="text-[#b2a491] mb-6">
            Navigate to the specific section from the sidebar to manage this content type
          </p>
          
          <div className="flex gap-3 justify-center">
            {activeType === 'music' && (
              <button className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors">
                Go to Music Library →
              </button>
            )}
            {activeType === 'videos' && (
              <button className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors">
                Go to Video Library →
              </button>
            )}
            {activeType === 'galleries' && (
              <button className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors">
                Go to Moments →
              </button>
            )}
            {activeType === 'featured' && (
              <button className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors">
                Go to Featured →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#302927] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#403633] rounded-lg flex items-center justify-center text-xl">🎨</div>
            <h4 className="font-semibold text-[#ede8df]">Bulk Actions</h4>
          </div>
          <p className="text-sm text-[#b2a491]">Manage multiple items at once</p>
        </div>

        <div className="bg-[#302927] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#403633] rounded-lg flex items-center justify-center text-xl">📊</div>
            <h4 className="font-semibold text-[#ede8df]">Analytics</h4>
          </div>
          <p className="text-sm text-[#b2a491]">View content performance metrics</p>
        </div>

        <div className="bg-[#302927] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#403633] rounded-lg flex items-center justify-center text-xl">⚙️</div>
            <h4 className="font-semibold text-[#ede8df]">Settings</h4>
          </div>
          <p className="text-sm text-[#b2a491]">Configure content defaults</p>
        </div>
      </div>
    </div>
  );
}
