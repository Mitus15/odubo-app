"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Order {
  id: number;
  shopify_order_id: string;
  order_number: string;
  order_status: string;
  total_amount: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  shopify_created_at: string;
  synced_at: string;
}

interface OrderHistoryProps {
  onRefresh?: () => void;
}

export default function OrderHistory({ onRefresh }: OrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchOrders = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/shopify/sync-orders?email=${encodeURIComponent(user.email)}`
      );
      
      if (response.ok) {
        const data = await response.json() as { orders: Order[] };
        setOrders(data.orders || []);
      } else {
        const errorData = await response.json() as { error?: string };
        setError(errorData.error || 'Failed to fetch orders');
      }
    } catch (err) {
      setError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      fetchOrders();
    }
  }, [user?.email]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'fulfilled':
      case 'delivered':
        return 'text-green-400';
      case 'pending':
      case 'unfulfilled':
        return 'text-yellow-400';
      case 'cancelled':
      case 'refunded':
        return 'text-red-400';
      default:
        return 'text-stone-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'fulfilled':
      case 'delivered':
        return '✅';
      case 'pending':
      case 'unfulfilled':
        return '⏳';
      case 'cancelled':
      case 'refunded':
        return '❌';
      default:
        return '❓';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  if (!user) {
    return (
      <div className="p-6 glass-surface border border-white/10 rounded-xl">
        <p className="text-stone-300">Please log in to view your order history.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 glass-surface border border-white/10 rounded-xl">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          <span className="ml-3 text-stone-300">Loading orders...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 glass-surface border border-white/10 rounded-xl">
        <div className="text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-6 glass-surface border border-white/10 rounded-xl text-center">
        <div className="text-4xl mb-3">📦</div>
        <h3 className="text-lg font-semibold text-[#ede8df] mb-2">No Orders Yet</h3>
        <p className="text-stone-300 text-sm mb-4">
          You haven't placed any orders yet, or your Shopify account isn't linked.
        </p>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Refresh Orders
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-[#ede8df]">
          📦 Order History ({orders.length})
        </h3>
        <button
          onClick={fetchOrders}
          className="px-3 py-1 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="p-4 glass-surface border border-white/10 rounded-lg hover:border-white/20 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-[#ede8df]">
                  Order #{order.order_number}
                </h4>
                <p className="text-sm text-stone-400">
                  {formatDate(order.shopify_created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[#ede8df]">
                  {formatCurrency(order.total_amount, order.currency)}
                </p>
                <p className="text-xs text-stone-400">
                  Shopify ID: {order.shopify_order_id}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-stone-400">Status:</span>
                <div className="flex items-center mt-1">
                  <span className="mr-2">{getStatusIcon(order.order_status)}</span>
                  <span className={getStatusColor(order.order_status)}>
                    {order.order_status}
                  </span>
                </div>
              </div>
              
              <div>
                <span className="text-stone-400">Payment:</span>
                <div className="flex items-center mt-1">
                  <span className="mr-2">{getStatusIcon(order.payment_status)}</span>
                  <span className={getStatusColor(order.payment_status)}>
                    {order.payment_status}
                  </span>
                </div>
              </div>
              
              <div>
                <span className="text-stone-400">Fulfillment:</span>
                <div className="flex items-center mt-1">
                  <span className="mr-2">{getStatusIcon(order.fulfillment_status)}</span>
                  <span className={getStatusColor(order.fulfillment_status)}>
                    {order.fulfillment_status}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-stone-400">
                Last synced: {formatDate(order.synced_at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {onRefresh && (
        <div className="text-center">
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Sync Latest Orders
          </button>
        </div>
      )}
    </div>
  );
}
