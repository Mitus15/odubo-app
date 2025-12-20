import { useState, useEffect, useCallback } from 'react';

interface ShopifyCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isLoggedIn: boolean;
  insights?: {
    isNewCustomer: boolean;
    isVIP: boolean;
    totalLifetimeValue: number;
    lastPurchaseDate: string | null;
    averageOrderValue: number;
  };
}

/**
 * Hook for managing Shopify customer authentication state
 * Uses Customer Account API v2 for seamless headless auth
 */
export function useShopifyAuth() {
  const [customer, setCustomer] = useState<ShopifyCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  // Check customer session on mount
  useEffect(() => {
    checkCustomerSession();
  }, []);

  const checkCustomerSession = useCallback(async () => {
    try {
      // Fetch full customer profile with insights
      const response = await fetch('/api/customer/profile', {
        credentials: 'include'
      });

      if (response.ok) {
        const profileData = await response.json();
        setCustomer({
          id: profileData.id,
          email: profileData.email,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          phone: profileData.phone,
          isLoggedIn: true,
          insights: profileData.insights
        });
      } else {
        setCustomer(null);
      }
    } catch (error) {
      console.error('Failed to check Shopify session:', error);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(() => {
    // Use Customer Account API v2
    const clientId = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID || '843046fe-e8cb-4fd1-9f46-ac5c8acd876b';
    const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const redirectUri = `${siteUrl}/api/auth/shopify/callback`;
    
    // Generate state and nonce for security
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    
    sessionStorage.setItem('shopify_auth_state', state);
    sessionStorage.setItem('shopify_auth_nonce', nonce);
    
    const authUrl = new URL(`${shopifyStore}/account/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', 'openid email customer-account-api:full');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    
    window.location.href = authUrl.toString();
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/shopify/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setCustomer(null);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  }, []);

  return {
    customer,
    loading,
    isLoggedIn: !!customer?.isLoggedIn,
    isNewCustomer: customer?.insights?.isNewCustomer ?? true,
    isVIP: customer?.insights?.isVIP ?? false,
    lifetimeValue: customer?.insights?.totalLifetimeValue ?? 0,
    login,
    logout,
    checkSession: checkCustomerSession
  };
}