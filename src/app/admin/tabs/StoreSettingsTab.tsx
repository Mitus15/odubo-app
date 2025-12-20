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
}

export default function StoreSettingsTab() {
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'Odubo Store',
    storeEmail: 'store@odubo.com',
    currency: 'USD',
    timezone: 'America/New_York',
    weightUnit: 'lb',
    shippingEnabled: true,
    taxesEnabled: true,
    inventoryTracking: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
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

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/store-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save settings', e);
    } finally {
      setSaving(false);
    }
  };

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

      {/* Shopify Integration */}
      <div className="bg-[#302927] rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#ede8df] mb-1">Shopify Integration</h3>
            <p className="text-sm text-[#b2a491]">Connected and syncing</p>
          </div>
          <a
            href="https://admin.shopify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors flex items-center gap-2"
          >
            Manage in Shopify ↗
          </a>
        </div>
      </div>
    </div>
  );
}
