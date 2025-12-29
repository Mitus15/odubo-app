'use client';

import { useState } from 'react';

export function VideoDistributionPanel() {
  const [activeTab, setActiveTab] = useState<'videos' | 'upload'>('videos');

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4">
        <div className="flex gap-4">
          {(['videos', 'upload'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-[#843c2d] text-[#ede8df]'
                  : 'border-transparent text-[#726d6c] hover:text-[#ede8df]'
              }`}
            >
              {tab === 'videos' ? 'My Videos' : 'Upload'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'videos' ? (
          <div className="space-y-4">
            {/* Empty state */}
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎬</div>
              <h3 className="font-semibold mb-2">No video releases</h3>
              <p className="text-sm text-[#726d6c] mb-4">
                Upload music videos for YouTube and Vevo distribution
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 rounded-xl bg-[#843c2d] text-white text-sm font-medium hover:bg-[#9a4a3a] transition-colors"
              >
                Upload Video
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upload placeholder */}
            <div className="p-6 rounded-xl border border-dashed border-[#502d26]/40 text-center">
              <div className="text-4xl mb-3">📤</div>
              <h3 className="font-semibold mb-2">Upload Music Video</h3>
              <p className="text-sm text-[#726d6c]">
                Video upload and distribution coming in Phase 5
              </p>
              <p className="text-xs text-[#502d26] mt-4">
                YouTube • Vevo • Premiere scheduling • Content ID
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
