
"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const OverviewTab = dynamic(() => import('./tabs/OverviewTab'));
const AnalyticsTab = dynamic(() => import('./tabs/AnalyticsTab'));
// const LibraryManager = dynamic(() => import('@/components/LibraryManager'));

interface TabContentProps {
  activeTab: 'overview' | 'music-library' | 'video-library' | 'analytics';
}

export default function TabContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Overview</h2>
          <p>Welcome to the admin dashboard.</p>
        </div>
      );
    case 'music-library':
      return (
        <div className="w-full">
          {/* <LibraryManager contentType="albums" /> */}
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Music Library</h2>
            <p>Music library management coming soon...</p>
          </div>
        </div>
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
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Analytics</h2>
          <p>Analytics dashboard coming soon...</p>
        </div>
      );
    default:
      return null;
  }
}
