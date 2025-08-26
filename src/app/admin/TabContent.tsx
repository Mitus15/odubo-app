
"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const OverviewTab = dynamic(() => import('./tabs/OverviewTab'));
const AnalyticsTab = dynamic(() => import('./tabs/AnalyticsTab'));
const LibraryManager = dynamic(() => import('@/components/LibraryManager'));

type AdminTab = 'overview' | 'music-library' | 'video-library' | 'analytics';

export default function TabContent({ activeTab }: { activeTab: AdminTab }) {
  switch (activeTab) {
    case 'overview':
      return (
        <Suspense fallback={<div className="p-6">Loading Overview…</div>}>
          <OverviewTab />
        </Suspense>
      );
    case 'music-library':
      return (
        <Suspense fallback={<div className="p-6">Loading Music Library…</div>}>
          <LibraryManager />
        </Suspense>
      );
    case 'video-library':
      return (
        <div className="w-full">
          {/* <LibraryManager contentType="videos" /> */}
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Video Library</h2>
            <p>Video library management coming soon...</p>
          </div>
        </div>
      );
    case 'analytics':
      return (
        <Suspense fallback={<div className="p-6">Loading Analytics…</div>}>
          <AnalyticsTab />
        </Suspense>
      );
    default:
      return null;
  }
}
