"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Only load tabs that are actually used in-page (not via separate routes)
const OverviewTab = dynamic(() => import('./tabs/OverviewTab'));
const ProductsTab = dynamic(() => import('./tabs/ProductsTab'));
const OrdersTab = dynamic(() => import('./tabs/OrdersTab'));
const CustomersTab = dynamic(() => import('./tabs/CustomersTab'));
const DiscountsTab = dynamic(() => import('./tabs/DiscountsTab'));
const ApiKeysTab = dynamic(() => import('./tabs/ApiKeysTab'));

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

// Simplified tab types - only tabs used in-page
type AdminTab =
  | 'overview'
  | 'products' | 'orders' | 'customers' | 'discounts'
  | 'api-keys'
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

    // === COMMERCE (in-page tabs) ===
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

    // === SYSTEM (api-keys is the only in-page tab) ===
    case 'api-keys':
      return (
        <Suspense fallback={<LoadingFallback title="API Keys" />}>
          <ApiKeysTab />
        </Suspense>
      );

    // All other content is accessed via dedicated routes
    default:
      return (
        <Suspense fallback={<LoadingFallback title="Dashboard" />}>
          <OverviewTab />
        </Suspense>
      );
  }
}
