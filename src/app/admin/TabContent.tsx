"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Core tab components
const OverviewTab = dynamic(() => import('./tabs/OverviewTab'));
const AnalyticsTab = dynamic(() => import('./tabs/AnalyticsTab'));
const MomentsTab = dynamic(() => import('./tabs/MomentsTab'));
const ProductsTab = dynamic(() => import('./tabs/ProductsTab'));
const OrdersTab = dynamic(() => import('./tabs/OrdersTab'));
const CustomersTab = dynamic(() => import('./tabs/CustomersTab'));
const PlaceholderTab = dynamic(() => import('./tabs/PlaceholderTab'));

// New tab components
const StoreSettingsTab = dynamic(() => import('./tabs/StoreSettingsTab'));
const CampaignsTab = dynamic(() => import('./tabs/CampaignsTab'));
const EmailMarketingTab = dynamic(() => import('./tabs/EmailMarketingTab'));
const DiscountsTab = dynamic(() => import('./tabs/DiscountsTab'));
const ApiKeysTab = dynamic(() => import('./tabs/ApiKeysTab'));
const ContentTab = dynamic(() => import('./tabs/ContentTab'));

// Social management components
const SocialPostsTab = dynamic(() => import('./tabs/SocialPostsTab'));
const SocialAccountsTab = dynamic(() => import('./tabs/SocialAccountsTab'));
const SocialAnalyticsTab = dynamic(() => import('./tabs/SocialAnalyticsTab'));

// Content management components
const LibraryManager = dynamic(() => import('@/components/LibraryManager'));
const AdminVideosPage = dynamic(() => import('./videos/page'));
const AdminUsersPage = dynamic(() => import('./users/page'));
const AdminLinktreePage = dynamic(() => import('./linktree/page'));
const AdminLivePage = dynamic(() => import('./live/page'));
const AdminStoragePage = dynamic(() => import('./storage/page'));
const AdminDatabasePage = dynamic(() => import('./db/page'));

// Loading fallback component
function LoadingFallback({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
        <span className="text-sm text-[#726d6c]">Loading {title}…</span>
      </div>
    </div>
  );
}

// Access denied component
function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
        <div className="w-16 h-16 rounded-full bg-[#843c2d]/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-[#ede8df]">Access Denied</h3>
        <p className="text-sm text-[#726d6c]">
          You don&apos;t have permission to view this section. Contact an admin to request access.
        </p>
      </div>
    </div>
  );
}

// All admin tab types
type AdminTab =
  | 'overview'
  // CMS
  | 'music-library' | 'video-library' | 'moments' | 'linktree' | 'live'
  // Social
  | 'social-posts' | 'social-accounts' | 'social-analytics'
  // Commerce
  | 'store-settings' | 'products' | 'orders' | 'customers' | 'discounts'
  // Marketing
  | 'campaigns' | 'email-marketing'
  // Analytics
  | 'analytics' | 'analytics-overview' | 'analytics-sales' | 'analytics-finance'
  | 'analytics-music' | 'analytics-video' | 'analytics-moments' | 'analytics-gallery'
  | 'analytics-users' | 'analytics-customers' | 'analytics-reports'
  // System
  | 'users' | 'database' | 'storage' | 'api-keys' | 'settings'
  // Legacy
  | 'marketing' | 'content' | 'markets' | 'finance';

interface TabContentProps {
  activeTab: AdminTab;
  canAccess?: (sectionId: string) => boolean;
}

export default function TabContent({ activeTab, canAccess }: TabContentProps) {
  // Check permission before rendering content
  // If canAccess is not provided (legacy), allow all access
  if (canAccess && !canAccess(activeTab)) {
    return <AccessDenied />;
  }

  switch (activeTab) {
    // === DASHBOARD ===
    case 'overview':
      return (
        <Suspense fallback={<LoadingFallback title="Dashboard" />}>
          <OverviewTab />
        </Suspense>
      );

    // === CMS ===
    case 'music-library':
      return (
        <Suspense fallback={<LoadingFallback title="Music Library" />}>
          <LibraryManager />
        </Suspense>
      );
    case 'video-library':
      return (
        <Suspense fallback={<LoadingFallback title="Video Library" />}>
          <AdminVideosPage />
        </Suspense>
      );
    case 'moments':
      return (
        <Suspense fallback={<LoadingFallback title="Moments" />}>
          <MomentsTab />
        </Suspense>
      );
    case 'linktree':
      return (
        <Suspense fallback={<LoadingFallback title="Link Tree" />}>
          <AdminLinktreePage />
        </Suspense>
      );
    case 'live':
      return (
        <Suspense fallback={<LoadingFallback title="Live Streams" />}>
          <AdminLivePage />
        </Suspense>
      );

    // === SOCIAL ===
    case 'social-posts':
      return (
        <Suspense fallback={<LoadingFallback title="Social Posts" />}>
          <SocialPostsTab />
        </Suspense>
      );
    case 'social-accounts':
      return (
        <Suspense fallback={<LoadingFallback title="Social Accounts" />}>
          <SocialAccountsTab />
        </Suspense>
      );
    case 'social-analytics':
      return (
        <Suspense fallback={<LoadingFallback title="Social Analytics" />}>
          <SocialAnalyticsTab />
        </Suspense>
      );

    // === COMMERCE ===
    case 'store-settings':
      return (
        <Suspense fallback={<LoadingFallback title="Store Settings" />}>
          <StoreSettingsTab />
        </Suspense>
      );
    case 'products':
      return (
        <Suspense fallback={<LoadingFallback title="Products" />}>
          <ProductsTab />
        </Suspense>
      );
    case 'orders':
      return (
        <Suspense fallback={<LoadingFallback title="Orders" />}>
          <OrdersTab />
        </Suspense>
      );
    case 'customers':
      return (
        <Suspense fallback={<LoadingFallback title="Customers" />}>
          <CustomersTab />
        </Suspense>
      );
    case 'discounts':
      return (
        <Suspense fallback={<LoadingFallback title="Discounts" />}>
          <DiscountsTab />
        </Suspense>
      );

    // === MARKETING ===
    case 'campaigns':
    case 'marketing':
      return (
        <Suspense fallback={<LoadingFallback title="Campaigns" />}>
          <CampaignsTab />
        </Suspense>
      );
    case 'email-marketing':
      return (
        <Suspense fallback={<LoadingFallback title="Email Marketing" />}>
          <EmailMarketingTab />
        </Suspense>
      );

    // === ANALYTICS ===
    case 'analytics':
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
        <Suspense fallback={<LoadingFallback title="Analytics" />}>
          <AnalyticsTab view={activeTab === 'analytics' ? 'analytics-overview' : activeTab} />
        </Suspense>
      );

    // === SYSTEM ===
    case 'users':
      return (
        <Suspense fallback={<LoadingFallback title="Users" />}>
          <AdminUsersPage />
        </Suspense>
      );
    case 'database':
      return (
        <Suspense fallback={<LoadingFallback title="Database" />}>
          <AdminDatabasePage />
        </Suspense>
      );
    case 'storage':
      return (
        <Suspense fallback={<LoadingFallback title="Storage" />}>
          <AdminStoragePage />
        </Suspense>
      );
    case 'api-keys':
      return (
        <Suspense fallback={<LoadingFallback title="API Keys" />}>
          <ApiKeysTab />
        </Suspense>
      );

    // === LEGACY/PLACEHOLDER ===
    case 'content':
      return (
        <Suspense fallback={<LoadingFallback title="Content Management" />}>
          <ContentTab />
        </Suspense>
      );
    case 'markets':
      return <PlaceholderTab title="Markets" description="Manage international markets, regions, and currencies." />;
    case 'finance':
      return <PlaceholderTab title="Finance" description="View revenue, payouts, and financial reports." />;

    default:
      return <PlaceholderTab title="Not Found" description="This section is not available." />;
  }
}
