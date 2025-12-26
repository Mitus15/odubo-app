import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import {
  getAllGlobalSettings,
  setGlobalSetting,
} from '@/lib/db';
import { invalidateSettingsCache } from '@/lib/storeSettings';

interface StoreSettings {
  storeName: string;
  storeEmail: string;
  currency: string;
  timezone: string;
  weightUnit: string;
  shippingEnabled: boolean;
  taxesEnabled: boolean;
  inventoryTracking: boolean;
  storePublished: boolean; // NEW FIELD
}

export async function GET(request: NextRequest) {
  // Require admin authentication
  const user = await verifyUserFromRequest(request);
  if (!user || !isAdminUser(user)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Fetch all settings from database
    const allSettings = await getAllGlobalSettings();

    // Parse settings with defaults
    const settings: StoreSettings = {
      storeName: allSettings.get('store_name')?.value || 'Odubo Store',
      storeEmail: allSettings.get('store_email')?.value || 'store@odubo.com',
      currency: allSettings.get('store_currency')?.value || 'USD',
      timezone: allSettings.get('store_timezone')?.value || 'America/New_York',
      weightUnit: allSettings.get('store_weight_unit')?.value || 'lb',
      shippingEnabled: allSettings.get('shipping_enabled')?.value === '1',
      taxesEnabled: allSettings.get('taxes_enabled')?.value === '1',
      inventoryTracking: allSettings.get('inventory_tracking')?.value === '1',
      storePublished: allSettings.get('store_published')?.value === '1',
    };

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to fetch store settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch store settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Require admin authentication
  const user = await verifyUserFromRequest(request);
  if (!user || !isAdminUser(user)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const settings = await request.json() as StoreSettings;
    const userId = user.userId;

    // Save each setting to database
    await setGlobalSetting('store_name', settings.storeName, 'string', userId);
    await setGlobalSetting('store_email', settings.storeEmail, 'string', userId);
    await setGlobalSetting('store_currency', settings.currency, 'string', userId);
    await setGlobalSetting('store_timezone', settings.timezone, 'string', userId);
    await setGlobalSetting('store_weight_unit', settings.weightUnit, 'string', userId);
    await setGlobalSetting('shipping_enabled', settings.shippingEnabled, 'boolean', userId);
    await setGlobalSetting('taxes_enabled', settings.taxesEnabled, 'boolean', userId);
    await setGlobalSetting('inventory_tracking', settings.inventoryTracking, 'boolean', userId);
    await setGlobalSetting('store_published', settings.storePublished, 'boolean', userId);

    // Invalidate cache so changes take effect immediately
    invalidateSettingsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save store settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save store settings' },
      { status: 500 }
    );
  }
}
