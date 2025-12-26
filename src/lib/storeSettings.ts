/**
 * Store Settings Cache
 * In-memory cache for global settings to avoid DB queries on every request
 */

import { getBooleanSetting, getAllGlobalSettings, type GlobalSetting } from './db';

// Cache for store settings - cleared on Cloudflare Pages/Vercel deploy
let settingsCache: Map<string, GlobalSetting> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Check if store is published (with caching)
 * Falls back to false (closed) if DB unavailable
 */
export async function isStorePublished(): Promise<boolean> {
  try {
    // Check cache freshness
    const now = Date.now();
    if (settingsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
      const cached = settingsCache.get('store_published');
      if (cached) {
        return cached.value === '1' || cached.value === 'true';
      }
    }

    // Cache miss or stale - fetch from DB
    const published = await getBooleanSetting('store_published', false);

    // Refresh entire cache while we're here (for future settings)
    settingsCache = await getAllGlobalSettings();
    cacheTimestamp = now;

    return published;
  } catch (error) {
    console.error('Failed to check store published status:', error);
    // Fail closed - if DB is down, store stays unpublished
    return false;
  }
}

/**
 * Invalidate the settings cache (call after updating settings)
 */
export function invalidateSettingsCache(): void {
  settingsCache = null;
  cacheTimestamp = 0;
}
