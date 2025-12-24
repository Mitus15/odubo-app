"use client";

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ShopifyAccountLinkerProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function ShopifyAccountLinker({ onSuccess, onError }: ShopifyAccountLinkerProps) {
  const [shopifyCustomerId, setShopifyCustomerId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<'unlinked' | 'linked' | 'checking'>('unlinked');
  const { user } = useAuth();

  const checkLinkStatus = async () => {
    if (!user?.email || !shopifyCustomerId) return;
    
    setIsChecking(true);
    try {
      const response = await fetch(
        `/api/shopify/sync-customer?email=${encodeURIComponent(user.email)}&shopifyCustomerId=${shopifyCustomerId}`
      );
      
      if (response.ok) {
        setLinkStatus('linked');
        onSuccess?.();
      } else {
        setLinkStatus('unlinked');
      }
    } catch (error) {
      console.error('Failed to check link status:', error);
      setLinkStatus('unlinked');
    } finally {
      setIsChecking(false);
    }
  };

  const linkAccount = async () => {
    if (!user?.email || !shopifyCustomerId) return;
    
    setIsLinking(true);
    try {
      const response = await fetch('/api/shopify/sync-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          shopifyCustomerId
        })
      });

      const data = await response.json() as any;
      
      if (response.ok) {
        setLinkStatus('linked');
        onSuccess?.();
      } else {
        onError?.(data.error || 'Failed to link account');
      }
    } catch (error) {
      console.error('Failed to link account:', error);
      onError?.('Failed to link account');
    } finally {
      setIsLinking(false);
    }
  };

  const syncOrders = async () => {
    if (!user?.email || !shopifyCustomerId) return;
    
    try {
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          shopifyCustomerId
        })
      });

      const data = await response.json() as any;
      
      if (response.ok) {
        onSuccess?.();
      } else {
        onError?.(data.error || 'Failed to sync orders');
      }
    } catch (error) {
      console.error('Failed to sync orders:', error);
      onError?.('Failed to sync orders');
    }
  };

  if (!user) {
    return (
      <div className="p-6 glass-surface border border-white/10 rounded-xl">
        <p className="text-stone-300">Please log in to link your Shopify account.</p>
      </div>
    );
  }

  return (
    <div className="p-6 glass-surface border border-white/10 rounded-xl space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-[#ede8df] mb-2">
          🔗 Link Your Shopify Account
        </h3>
        <p className="text-stone-300 text-sm">
          Connect your app account with your Shopify customer account to track orders and sync data.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-300 mb-2">
            Shopify Customer ID
          </label>
          <input
            type="text"
            value={shopifyCustomerId}
            onChange={(e) => setShopifyCustomerId(e.target.value)}
            placeholder="Enter your Shopify customer ID"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
          <p className="text-xs text-stone-400 mt-1">
            You can find this in your Shopify account or order confirmation emails.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={checkLinkStatus}
            disabled={isChecking || !shopifyCustomerId}
            className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Check Status'}
          </button>
          
          {linkStatus === 'unlinked' && (
            <button
              onClick={linkAccount}
              disabled={isLinking || !shopifyCustomerId}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isLinking ? 'Linking...' : 'Link Account'}
            </button>
          )}
        </div>

        {linkStatus === 'linked' && (
          <div className="space-y-3">
            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
              <p className="text-green-300 text-sm">
                ✅ Account linked successfully! Your Shopify data is now synced.
              </p>
            </div>
            
            <button
              onClick={syncOrders}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Sync Orders Now
            </button>
          </div>
        )}

        {linkStatus === 'checking' && (
          <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-sm">
              🔍 Checking account link status...
            </p>
          </div>
        )}
      </div>

      <div className="text-xs text-stone-400 text-center">
        <p>Need help? Contact support for assistance with account linking.</p>
      </div>
    </div>
  );
}
