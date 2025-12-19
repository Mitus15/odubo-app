'use client';

/**
 * The Hub - User Context
 * Authentication and permission state management
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { HubUser, Module, Permission, ResolvedPermissions } from '@/lib/hub/types';

// =============================================================================
// TYPES
// =============================================================================

interface HubUserContextValue {
  // User state
  user: HubUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Permission checks
  isFullAdmin: boolean;
  canAccess: (module: Module, permission: Permission) => boolean;
  hasModule: (module: Module) => boolean;
  accessibleModules: Module[];

  // Actions
  refresh: () => Promise<void>;
  logout: () => void;
}

interface HubUserProviderProps {
  children: ReactNode;
  loginPath?: string;
}

// =============================================================================
// CONTEXT
// =============================================================================

const HubUserContext = createContext<HubUserContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

export function HubUserProvider({
  children,
  loginPath = '/admin/login',
}: HubUserProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<HubUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user from API
  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        return;
      }

      const response = await fetch('/api/v2/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          setUser(null);
          return;
        }
        throw new Error('Failed to fetch user');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setUser(data.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Redirect if not authenticated after loading
  useEffect(() => {
    if (!isLoading && !user) {
      router.push(loginPath);
    }
  }, [isLoading, user, router, loginPath]);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    router.push(loginPath);
  }, [router, loginPath]);

  // Permission check helpers
  const isFullAdmin = useMemo(() => {
    return user?.permissions?.isFullAdmin || false;
  }, [user]);

  const canAccess = useCallback(
    (module: Module, permission: Permission): boolean => {
      if (!user) return false;
      if (user.permissions?.isFullAdmin) return true;

      const modulePerms = user.permissions?.modules?.[module];
      if (!modulePerms) return false;

      switch (permission) {
        case 'read':
          return modulePerms.canRead;
        case 'write':
          return modulePerms.canWrite;
        case 'delete':
          return modulePerms.canDelete;
        case 'admin':
          return modulePerms.canAdmin;
        case 'approve':
          return modulePerms.canApprove;
        case 'export':
          return modulePerms.canExport;
        default:
          return false;
      }
    },
    [user]
  );

  const hasModule = useCallback(
    (module: Module): boolean => {
      if (!user) return false;
      if (user.permissions?.isFullAdmin) return true;
      return user.accessibleModules?.includes(module) || false;
    },
    [user]
  );

  const accessibleModules = useMemo(() => {
    return user?.accessibleModules || [];
  }, [user]);

  // Context value
  const value = useMemo<HubUserContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      error,
      isFullAdmin,
      canAccess,
      hasModule,
      accessibleModules,
      refresh: fetchUser,
      logout,
    }),
    [user, isLoading, error, isFullAdmin, canAccess, hasModule, accessibleModules, fetchUser, logout]
  );

  return (
    <HubUserContext.Provider value={value}>
      {children}
    </HubUserContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

export function useHubUser(): HubUserContextValue {
  const context = useContext(HubUserContext);
  if (!context) {
    throw new Error('useHubUser must be used within a HubUserProvider');
  }
  return context;
}

/**
 * Hook to require a specific permission
 * Returns loading state and permission check result
 */
export function usePermission(
  module: Module,
  permission: Permission
): { isAllowed: boolean; isLoading: boolean } {
  const { canAccess, isLoading } = useHubUser();
  return {
    isAllowed: canAccess(module, permission),
    isLoading,
  };
}

/**
 * Hook to require admin access
 */
export function useAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { isFullAdmin, isLoading } = useHubUser();
  return {
    isAdmin: isFullAdmin,
    isLoading,
  };
}

/**
 * Hook to check if user has access to a module
 */
export function useModuleAccess(module: Module): { hasAccess: boolean; isLoading: boolean } {
  const { hasModule, isLoading } = useHubUser();
  return {
    hasAccess: hasModule(module),
    isLoading,
  };
}
