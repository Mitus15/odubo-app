"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const OverviewTab = dynamic(() => import('./tabs/OverviewTab'));
const AnalyticsTab = dynamic(() => import('./tabs/AnalyticsTab'));
const MomentsTab = dynamic(() => import('./tabs/MomentsTab'));
// const ProductsTab = dynamic(() => import('./tabs/ProductsTab'));
const OrdersTab = dynamic(() => import('./tabs/OrdersTab'));
const CustomersTab = dynamic(() => import('./tabs/CustomersTab'));
const PlaceholderTab = dynamic(() => import('./tabs/PlaceholderTab'));
const LibraryManager = dynamic(() => import('@/components/LibraryManager'));
const AdminVideosPage = dynamic(() => import('./videos/page'));
const AdminUsersPage = dynamic(() => import('./users/page'));

type AdminTab = 'overview' | 'music-library' | 'video-library' | 'moments' | 'products' | 'analytics' | 'orders' | 'customers' | 'marketing' | 'discounts' | 'content' | 'markets' | 'finance' | 'analytics-overview' | 'analytics-sales' | 'analytics-finance' | 'analytics-music' | 'analytics-video' | 'analytics-moments' | 'analytics-gallery' | 'analytics-users' | 'analytics-customers' | 'analytics-reports';

export default function TabContent({ activeTab }: { activeTab: AdminTab }) {
  switch (activeTab) {
    case 'overview':
      return (
        <Suspense fallback={<div className="p-6">Loading Overview…</div>}>
          <OverviewTab />
        </Suspense>
      );
    case 'orders':
      return (
        <Suspense fallback={<div className="p-6">Loading Orders…</div>}>
          <OrdersTab />
        </Suspense>
      );
    case 'products':
      return <PlaceholderTab title="Products" />;
    case 'customers':
      return (
        <Suspense fallback={<div className="p-6">Loading Customers…</div>}>
          <CustomersTab />
        </Suspense>
      );
    case 'marketing':
      return <PlaceholderTab title="Marketing" />;
    case 'discounts':
      return <PlaceholderTab title="Discounts" />;
    case 'content':
      return <PlaceholderTab title="Content Management" />;
    case 'markets':
      return <PlaceholderTab title="Markets" />;
    case 'finance':
      return <PlaceholderTab title="Finance" />;
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
          <AnalyticsTab view="analytics-overview" />
        </Suspense>
      );
    case 'analytics-overview':
    case 'analytics-sales':
    case 'analytics-finance':
    case 'analytics-music':
    case 'analytics-video':
    case 'analytics-moments':
    case 'analytics-gallery':
    case 'analytics-users':
    case 'analytics-customers':
    case 'analytics-reports':
      return (
        <Suspense fallback={<div className="p-6">Loading Analytics…</div>}>
          <AnalyticsTab view={activeTab} />
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
