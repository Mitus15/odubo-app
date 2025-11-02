"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const OverviewTab = dynamic(() => import('./tabs/OverviewTab'));
const AnalyticsTab = dynamic(() => import('./tabs/AnalyticsTab'));
const MomentsTab = dynamic(() => import('./tabs/MomentsTab'));
const LibraryManager = dynamic(() => import('@/components/LibraryManager'));
const AdminVideosPage = dynamic(() => import('./videos/page'));
const AdminUsersPage = dynamic(() => import('./users/page'));

type AdminTab = 'overview' | 'music-library' | 'video-library' | 'moments' | 'analytics';

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
        <Suspense fallback={<div className="p-6">Loading Video Library…</div>}>
          <AdminVideosPage />
        </Suspense>
      );
    case 'moments':
      return (
        <Suspense fallback={<div className="p-6">Loading Moments…</div>}>
          <MomentsTab />
        </Suspense>
      );
    case 'analytics':
      return (
        <Suspense fallback={<div className="p-6">Loading Analytics…</div>}>
          <AnalyticsTab />
        </Suspense>
      );
    // Temporary route to access users management (could be moved to separate tab later)
    case 'users' as any:
      return (
        <Suspense fallback={<div className="p-6">Loading Users…</div>}>
          <AdminUsersPage />
        </Suspense>
      );
    default:
      return null;
  }
}
