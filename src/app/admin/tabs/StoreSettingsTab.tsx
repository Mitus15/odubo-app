'use client';

import { useState, useEffect } from 'react';

interface StoreSettings {
  storeName: string;
  storeEmail: string;
  currency: string;
  timezone: string;
  weightUnit: string;
  shippingEnabled: boolean;
  taxesEnabled: boolean;
  inventoryTracking: boolean;
  storePublished: boolean;
}

interface ShopifyStatus {
  connected: boolean;
  message: string;
  details?: string;
  shop?: {
    name: string;
    domain: string;
    email: string | null;
  };
  envPresent?: {
    storeUrl: boolean;
    publicToken: boolean;
    adminToken: boolean;
  };
}

export default function StoreSettingsTab() {
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'Odubo Store',
    storeEmail: 'info@odubo.studio',
    currency: 'USD',
    timezone: 'America/New_York',
    weightUnit: 'lb',
    shippingEnabled: true,
    taxesEnabled: true,
    inventoryTracking: true,
    storePublished: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Shopify connection status
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null);
  const [checkingShopify, setCheckingShopify] = useState(true);

  // Store publish sync check
  const [serverPublished, setServerPublished] = useState<boolean | null>(null);
  const [checkingPublishStatus, setCheckingPublishStatus] = useState(true);

  useEffect(() => {
    fetchSettings();
    checkShopifyStatus();
    checkStorePublishStatus();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/store-settings');
      if (res.ok) {
        const data = await res.json() as { settings?: StoreSettings };
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (e) {
      console.error('Failed to fetch store settings', e);
    }
  };

  const checkShopifyStatus = async () => {
    setCheckingShopify(true);
    try {
      const res = await fetch('/api/admin/shopify/status');
      if (res.ok) {
        const data = await res.json() as { success: boolean; connected: boolean; message: string; details?: string; shop?: ShopifyStatus['shop']; envPresent?: ShopifyStatus['envPresent'] };
        if (data.success) {
          setShopifyStatus({
            connected: data.connected,
            message: data.message,
            details: data.details,
            shop: data.shop,
            envPresent: data.envPresent,
          });
        }
      }
    } catch (e) {
      console.error('Failed to check Shopify status', e);
      setShopifyStatus({ connected: false, message: 'Check failed', details: 'Could not reach status endpoint' });
    } finally {
      setCheckingShopify(false);
    }
  };

  const checkStorePublishStatus = async () => {
    setCheckingPublishStatus(true);
    try {
      const res = await fetch('/api/store/status');
      if (res.ok) {
        const data = await res.json() as { published: boolean };
        setServerPublished(data.published);
      }
    } catch (e) {
      console.error('Failed to check store publish status', e);
    } finally {
      setCheckingPublishStatus(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/store-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        // Re-check the server status after saving to confirm sync
        setTimeout(() => {
          checkStorePublishStatus();
        }, 500);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSaveError((errData as any)?.error || `Save failed (HTTP ${res.status})`);
      }
    } catch (e) {
      console.error('Failed to save settings', e);
      setSaveError('Network error — could not save settings');
    } finally {
      setSaving(false);
    }
  };

  // Check if local publish state is out of sync with server
  const isPublishOutOfSync = serverPublished !== null && settings.storePublished !== serverPublished;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#ede8df]">Store Settings</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>

      {/* Sync Warning Banner */}
      {isPublishOutOfSync && (
        <div className="p-3 bg-amber-900/20 border border-amber-600/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-amber-200">
              Settings out of sync — the server shows store is <strong>{serverPublished ? 'published' : 'unpublished'}</strong> but the form shows <strong>{settings.storePublished ? 'published' : 'unpublished'}</strong>. Click "Save Changes" to sync or refresh the page.
            </p>
          </div>
          <button
            onClick={() => { fetchSettings(); checkStorePublishStatus(); }}
            className="ml-4 px-3 py-1.5 text-xs font-medium bg-amber-700/30 text-amber-200 rounded-lg hover:bg-amber-700/50 transition-colors flex-shrink-0"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Save Error */}
      {saveError && (
        <div className="p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
          <p className="text-sm text-red-200">{saveError}</p>
        </div>
      )}

      {/* Store Information */}
      <div className="bg-[#302927] rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[#ede8df]">Store Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Store Name</label>
            <input
              type="text"
              value={settings.storeName}
              onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Store Email</label>
            <input
              type="email"
              value={settings.storeEmail}
              onChange={(e) => setSettings({ ...settings, storeEmail: e.target.value })}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Regional Settings */}
      <div className="bg-[#302927] rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[#ede8df]">Regional Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Currency</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
            >
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Weight Unit</label>
            <select
              value={settings.weightUnit}
              onChange={(e) => setSettings({ ...settings, weightUnit: e.target.value })}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
            >
              <option value="lb">Pounds (lb)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Store Visibility */}
      <div className="bg-[#302927] rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[#ede8df]">Store Visibility</h3>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.storePublished}
              onChange={(e) => setSettings({ ...settings, storePublished: e.target.checked })}
              className="w-5 h-5 rounded border-[#502d26] bg-[#403633] text-[#843c2d] focus:ring-[#843c2d]"
            />
            <div>
              <div className="text-[#ede8df] font-medium">Publish Store</div>
              <div className="text-sm text-[#b2a491]">
                Make the store accessible to the public. When disabled, only admins can access.
              </div>
            </div>
          </label>

          {/* Warning message when unpublished */}
          {!settings.storePublished && (
            <div className="mt-2 p-3 bg-[#843c2d]/10 border border-[#843c2d]/30 rounded-lg">
              <p className="text-xs text-[#ede8df]">
                ⚠️ Store is currently UNPUBLISHED. Only administrators can access store pages and see the shop button.
              </p>
            </div>
          )}

          {/* Success message when published */}
          {settings.storePublished && (
            <div className="mt-2 p-3 bg-emerald-900/10 border border-emerald-700/30 rounded-lg">
              <p className="text-xs text-emerald-200">
                ✓ Store is PUBLISHED and accessible to all visitors.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Commerce Features */}
      <div className="bg-[#302927] rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[#ede8df]">Commerce Features</h3>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.shippingEnabled}
              onChange={(e) => setSettings({ ...settings, shippingEnabled: e.target.checked })}
              className="w-5 h-5 rounded border-[#502d26] bg-[#403633] text-[#843c2d] focus:ring-[#843c2d]"
            />
            <div>
              <div className="text-[#ede8df] font-medium">Enable Shipping</div>
              <div className="text-sm text-[#b2a491]">Calculate shipping rates for physical products</div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.taxesEnabled}
              onChange={(e) => setSettings({ ...settings, taxesEnabled: e.target.checked })}
              className="w-5 h-5 rounded border-[#502d26] bg-[#403633] text-[#843c2d] focus:ring-[#843c2d]"
            />
            <div>
              <div className="text-[#ede8df] font-medium">Enable Taxes</div>
              <div className="text-sm text-[#b2a491]">Automatically calculate taxes based on location</div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.inventoryTracking}
              onChange={(e) => setSettings({ ...settings, inventoryTracking: e.target.checked })}
              className="w-5 h-5 rounded border-[#502d26] bg-[#403633] text-[#843c2d] focus:ring-[#843c2d]"
            />
            <div>
              <div className="text-[#ede8df] font-medium">Track Inventory</div>
              <div className="text-sm text-[#b2a491]">Monitor stock levels and prevent overselling</div>
            </div>
          </label>
        </div>
      </div>

      {/* Shopify Integration — Live Status */}
      <div className="bg-[#302927] rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#ede8df] mb-1">Shopify Integration</h3>
            
            {checkingShopify ? (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-3 h-3 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
                <p className="text-sm text-[#b2a491]">Checking connection...</p>
              </div>
            ) : shopifyStatus?.connected ? (
              <div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <p className="text-sm text-emerald-400 font-medium">Connected</p>
                </div>
                {shopifyStatus.shop && (
                  <div className="mt-2 space-y-1 text-sm text-[#b2a491]">
                    <p>Store: {shopifyStatus.shop.name}</p>
                    <p>Domain: {shopifyStatus.shop.domain}</p>
                  </div>
                )}
              </div>
            ) : shopifyStatus ? (
              <div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  <p className="text-sm text-amber-400 font-medium">Not Connected</p>
                </div>
                <p className="text-sm text-[#b2a491] mt-1">
                  {shopifyStatus.details || shopifyStatus.message || 'Shopify is not configured'}
                </p>
                {shopifyStatus.envPresent && (
                  <div className="mt-2 text-xs text-[#726d6c] space-y-0.5">
                    <p>Environment variables:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li className={shopifyStatus.envPresent.storeUrl ? 'text-emerald-400' : 'text-red-400'}>
                        SHOPIFY_STORE_URL: {shopifyStatus.envPresent.storeUrl ? '✓ set' : '✗ missing'}
                      </li>
                      <li className={shopifyStatus.envPresent.publicToken ? 'text-emerald-400' : 'text-red-400'}>
                        NEXT_PUBLIC_SHOPIFY_API_KEY: {shopifyStatus.envPresent.publicToken ? '✓ set' : '✗ missing'}
                      </li>
                      <li className={shopifyStatus.envPresent.adminToken ? 'text-emerald-400' : 'text-amber-400'}>
                        SHOPIFY_ADMIN_ACCESS_TOKEN: {shopifyStatus.envPresent.adminToken ? '✓ set' : '○ optional'}
                      </li>
                    </ul>
                  </div>
                )}
                <button
                  onClick={checkShopifyStatus}
                  className="mt-3 px-3 py-1.5 text-xs font-medium bg-[#403633] text-[#b2a491] rounded-lg hover:bg-[#502d26] transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <p className="text-sm text-[#b2a491] mt-2">Unable to check status</p>
            )}
          </div>

          {shopifyStatus?.connected && (
            <a
              href="https://admin.shopify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors flex items-center gap-2 flex-shrink-0"
            >
              Manage in Shopify ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
