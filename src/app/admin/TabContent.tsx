"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// === EXISTING TABS ===
const OverviewTab = dynamic(() => import('./tabs/OverviewTab'));
const ProductsTab = dynamic(() => import('./tabs/ProductsTab'));
const OrdersTab = dynamic(() => import('./tabs/OrdersTab'));
const CustomersTab = dynamic(() => import('./tabs/CustomersTab'));
const DiscountsTab = dynamic(() => import('./tabs/DiscountsTab'));
const ApiKeysTab = dynamic(() => import('./tabs/ApiKeysTab'));
const MomentsTab = dynamic(() => import('./tabs/MomentsTab'));
const AnalyticsTab = dynamic(() => import('./tabs/AnalyticsTab'));
const StoreSettingsTab = dynamic(() => import('./tabs/StoreSettingsTab'));

// === NEW TAB WRAPPERS (from page content) ===
const SocialCMSTab = dynamic(() => import('./tabs/SocialCMSTab'));
const VideosTab = dynamic(() => import('./tabs/VideosTab'));
const MusicTab = dynamic(() => import('./tabs/MusicTab'));
const BrandAssetsTab = dynamic(() => import('./tabs/BrandAssetsTab'));
const LinksTab = dynamic(() => import('./tabs/LinksTab'));
const AIStudioTab = dynamic(() => import('./tabs/AIStudioTab'));
const StorageTab = dynamic(() => import('./tabs/StorageTab'));
const DatabaseTab = dynamic(() => import('./tabs/DatabaseTab'));
const UsersTab = dynamic(() => import('./tabs/UsersTab'));

// === BUSINESS / BI TABS ===
const ReportsTab = dynamic(() => import('./tabs/ReportsTab'));
const FinanceTab = dynamic(() => import('./tabs/FinanceTab'));
const ExpensesTab = dynamic(() => import('./tabs/ExpensesTab'));
const AdCampaignsTab = dynamic(() => import('./tabs/AdCampaignsTab'));
const SocialGrowthTab = dynamic(() => import('./tabs/SocialGrowthTab'));

// === ACCOUNT TAB ===
const AccountTab = dynamic(() => import('./tabs/AccountTab'));

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

// Tab types - all tabs rendered in-page
type AdminTab =
  // Dashboard
  | 'overview'
  // Content
  | 'music' | 'videos' | 'moments' | 'brand-assets' | 'links'
  // Social
  | 'social-cms' | 'ai-studio'
  // Commerce
  | 'products' | 'orders' | 'customers' | 'discounts' | 'store-settings'
  // Analytics
  | 'analytics'
  // Business / BI
  | 'reports' | 'finance' | 'expenses' | 'ad-campaigns' | 'social-growth'
  // Account
  | 'account'
  // System
  | 'users' | 'database' | 'storage' | 'api-keys'
  | string; // Allow any string for flexibility

interface TabContentProps {
  activeTab: AdminTab;
  canAccess?: (sectionId: string) => boolean;
}

export default function TabContent({ activeTab, canAccess }: TabContentProps) {
  // Check permission before rendering content
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

    // === CONTENT ===
    case 'music':
      return (
        <Suspense fallback={<LoadingFallback title="Music" />}>
          <MusicTab />
        </Suspense>
      );
    case 'videos':
      return (
        <Suspense fallback={<LoadingFallback title="Videos" />}>
          <VideosTab />
        </Suspense>
      );
    case 'moments':
      return (
        <Suspense fallback={<LoadingFallback title="Moments" />}>
          <MomentsTab />
        </Suspense>
      );
    case 'brand-assets':
      return (
        <Suspense fallback={<LoadingFallback title="Brand Assets" />}>
          <BrandAssetsTab />
        </Suspense>
      );
    case 'links':
      return (
        <Suspense fallback={<LoadingFallback title="Links" />}>
          <LinksTab />
        </Suspense>
      );

    // === SOCIAL ===
    case 'social-cms':
      return (
        <Suspense fallback={<LoadingFallback title="Social CMS" />}>
          <SocialCMSTab />
        </Suspense>
      );
    case 'ai-studio':
      return (
        <Suspense fallback={<LoadingFallback title="AI Studio" />}>
          <AIStudioTab />
        </Suspense>
      );

    // === COMMERCE ===
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
    case 'store-settings':
      return (
        <Suspense fallback={<LoadingFallback title="Store Settings" />}>
          <StoreSettingsTab />
        </Suspense>
      );

    // === ANALYTICS ===
    case 'analytics':
      return (
        <Suspense fallback={<LoadingFallback title="Analytics" />}>
          <AnalyticsTab />
        </Suspense>
      );

    // === BUSINESS / BI ===
    case 'reports':
      return (
        <Suspense fallback={<LoadingFallback title="Reports" />}>
          <ReportsTab />
        </Suspense>
      );
    case 'finance':
      return (
        <Suspense fallback={<LoadingFallback title="Finance" />}>
          <FinanceTab />
        </Suspense>
      );
    case 'expenses':
      return (
        <Suspense fallback={<LoadingFallback title="Expenses" />}>
          <ExpensesTab />
        </Suspense>
      );
    case 'ad-campaigns':
      return (
        <Suspense fallback={<LoadingFallback title="Ad Campaigns" />}>
          <AdCampaignsTab />
        </Suspense>
      );
    case 'social-growth':
      return (
        <Suspense fallback={<LoadingFallback title="Social Growth" />}>
          <SocialGrowthTab />
        </Suspense>
      );

    // === ACCOUNT ===
    case 'account':
      return (
        <Suspense fallback={<LoadingFallback title="Account" />}>
          <AccountTab />
        </Suspense>
      );

    // === SYSTEM ===
    case 'users':
      return (
        <Suspense fallback={<LoadingFallback title="Users" />}>
          <UsersTab />
        </Suspense>
      );
    case 'database':
      return (
        <Suspense fallback={<LoadingFallback title="Database" />}>
          <DatabaseTab />
        </Suspense>
      );
    case 'storage':
      return (
        <Suspense fallback={<LoadingFallback title="Storage" />}>
          <StorageTab />
        </Suspense>
      );
    case 'api-keys':
      return (
        <Suspense fallback={<LoadingFallback title="API Keys" />}>
          <ApiKeysTab />
        </Suspense>
      );

    // Fallback to dashboard
    default:
      return (
        <Suspense fallback={<LoadingFallback title="Dashboard" />}>
          <OverviewTab />
        </Suspense>
      );
  }
}
