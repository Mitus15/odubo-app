'use client';

import { useState, useEffect, useCallback } from 'react';

// Map child sections to their parent sections
const SECTION_PARENT_MAP: Record<string, string> = {
  // CMS
  'music-library': 'cms',
  'video-library': 'cms',
  'moments': 'cms',
  'featured': 'cms',
  'linktree': 'cms',
  'live': 'cms',
  // Social
  'social-posts': 'social',
  'social-accounts': 'social',
  'social-analytics': 'social',
  // Commerce
  'products': 'commerce',
  'orders': 'commerce',
  'customers': 'commerce',
  'discounts': 'commerce',
  'store-settings': 'commerce',
  // Marketing
  'campaigns': 'marketing',
  // Analytics
  'analytics-overview': 'analytics',
  'analytics-music': 'analytics',
  'analytics-video': 'analytics',
  'analytics-moments': 'analytics',
  'analytics-customers': 'analytics',
  'analytics-reports': 'analytics',
  // System
  'users': 'system',
  'database': 'system',
  'storage': 'system',
  'api-keys': 'system',
};

interface Role {
  name: string;
  display_name: string;
}

interface PermissionsState {
  sections: string[];
  isAdmin: boolean;
  roles: Role[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and manage user permissions
 * Returns accessible sections, admin status, and helper functions
 */
export function usePermissions() {
  const [state, setState] = useState<PermissionsState>({
    sections: [],
    isAdmin: false,
    roles: [],
    loading: true,
    error: null,
  });

  const fetchPermissions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const res = await fetch('/api/admin/permissions');

      if (!res.ok) {
        if (res.status === 401) {
          setState({
            sections: [],
            isAdmin: false,
            roles: [],
            loading: false,
            error: 'Not authenticated',
          });
          return;
        }
        throw new Error('Failed to fetch permissions');
      }

      const data = await res.json() as { sections: string[]; isAdmin: boolean; roles: Role[] };
      setState({
        sections: data.sections,
        isAdmin: data.isAdmin,
        roles: data.roles,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('[usePermissions] Error:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  /**
   * Check if user can access a specific section
   */
  const canAccess = useCallback((sectionId: string): boolean => {
    // Full admin access
    if (state.isAdmin || state.sections.includes('*')) return true;

    // Direct match
    if (state.sections.includes(sectionId)) return true;

    // Check parent section (e.g., 'music-library' → 'cms')
    const parent = SECTION_PARENT_MAP[sectionId];
    if (parent && state.sections.includes(parent)) return true;

    return false;
  }, [state.sections, state.isAdmin]);

  /**
   * Check if user can access any of the given sections
   */
  const canAccessAny = useCallback((sectionIds: string[]): boolean => {
    return sectionIds.some(id => canAccess(id));
  }, [canAccess]);

  /**
   * Check if a parent section should be visible (has at least one accessible child)
   */
  const hasAccessibleChildren = useCallback((parentId: string): boolean => {
    if (state.isAdmin || state.sections.includes('*')) return true;
    if (state.sections.includes(parentId)) return true;

    // Check if any child section maps to this parent
    return Object.entries(SECTION_PARENT_MAP).some(
      ([childId, parent]) => parent === parentId && canAccess(childId)
    );
  }, [state.sections, state.isAdmin, canAccess]);

  return {
    ...state,
    canAccess,
    canAccessAny,
    hasAccessibleChildren,
    refresh: fetchPermissions,
  };
}
