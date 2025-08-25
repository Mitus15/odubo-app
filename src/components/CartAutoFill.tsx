"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface CartAutoFillProps {
  onDataLoaded?: (data: any) => void;
  onError?: (error: string) => void;
}

/*
// Temporarily disabled for build
export default function CartAutoFill({ onDataLoaded, onError }: CartAutoFillProps) {
  const [cartData, setCartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadCartData = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/shopify/cart-data?email=${encodeURIComponent(user.email)}`
      );
      
      if (response.ok) {
        const data = await response.json() as any;
        setCartData(data.cart_data);
        onDataLoaded?.(data.cart_data);
      } else {
        const errorData = await response.json() as any;
        const errorMessage = errorData.error || 'Failed to load cart data';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = 'Failed to load cart data';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email && user?.shopify_customer_id) {
      loadCartData();
    }
  }, [user?.email, user?.shopify_customer_id]);

  if (!user) {
    return null;
  }

  if (!user.shopify_customer_id) {
    return (
      <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
        <p className="text-blue-300 text-sm">
          🔗 Your account will be automatically linked to Shopify when you make your first purchase.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
          <span className="text-blue-300 text-sm">Loading your cart preferences...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
        <p className="text-red-300 text-sm mb-2">{error}</p>
        <button
          onClick={loadCartData}
          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!cartData) {
    return null;
  }

  return (
    <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-green-400 mr-2">✅</span>
          <span className="text-green-300 text-sm">
            Cart auto-fill enabled with your saved preferences
          </span>
        </div>
        <button
          onClick={loadCartData}
          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
        >
          Refresh
        </button>
      </div>
      
      {cartData.addresses?.default && (
        <div className="mt-2 text-xs text-green-300">
          <p>Default address: {cartData.addresses.default.city}, {cartData.addresses.default.country}</p>
        </div>
      )}
    </div>
  );
}
*/
