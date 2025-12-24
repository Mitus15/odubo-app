'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { ShopifyCustomer, ShopifyOrder } from '@/lib/shopify-customer';

// ============================================================================
// Types
// ============================================================================

interface ShopifyCustomerContextValue {
  // Customer data
  customer: ShopifyCustomer | null;
  orders: ShopifyOrder[];

  // State
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  login: (returnTo?: string) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const ShopifyCustomerContext = createContext<ShopifyCustomerContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ShopifyCustomerProviderProps {
  children: ReactNode;
}

export function ShopifyCustomerProvider({ children }: ShopifyCustomerProviderProps) {
  const [customer, setCustomer] = useState<ShopifyCustomer | null>(null);
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = customer !== null;

  /**
   * Fetch customer data from API
   */
  const fetchCustomerData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/shopify/customer');

      if (response.status === 401) {
        // Not authenticated
        setCustomer(null);
        setOrders([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch customer data');
      }

      const data = await response.json();
      setCustomer(data.customer);
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Error fetching customer data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCustomer(null);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  /**
   * Redirect to Shopify login
   */
  const login = useCallback((returnTo?: string) => {
    const url = new URL('/api/shopify/auth/login', window.location.origin);
    if (returnTo) {
      url.searchParams.set('returnTo', returnTo);
    }
    window.location.href = url.toString();
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback(async () => {
    try {
      await fetch('/api/shopify/auth/logout', { method: 'POST' });
      setCustomer(null);
      setOrders([]);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  /**
   * Refresh customer data
   */
  const refresh = useCallback(async () => {
    await fetchCustomerData();
  }, [fetchCustomerData]);

  const value: ShopifyCustomerContextValue = {
    customer,
    orders,
    isLoading,
    isAuthenticated,
    error,
    login,
    logout,
    refresh,
  };

  return (
    <ShopifyCustomerContext.Provider value={value}>
      {children}
    </ShopifyCustomerContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useShopifyCustomer(): ShopifyCustomerContextValue {
  const context = useContext(ShopifyCustomerContext);
  if (!context) {
    throw new Error('useShopifyCustomer must be used within ShopifyCustomerProvider');
  }
  return context;
}
