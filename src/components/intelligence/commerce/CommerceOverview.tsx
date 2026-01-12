'use client';

import { useState, useEffect } from 'react';
import MetricCard from '../widgets/MetricCard';

interface CommerceData {
  metrics: {
    revenue: { total: number; change: number; trend: 'up' | 'down' | 'neutral' };
    orders: { total: number; change: number; trend: 'up' | 'down' | 'neutral' };
    averageOrderValue: { total: number; change: number; trend: 'up' | 'down' | 'neutral' };
    customers: { total: number; change: number; trend: 'up' | 'down' | 'neutral' };
  };
  topProducts: Array<{
    title: string;
    productId: string;
    unitsSold: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: number;
    total: number;
    financialStatus: string;
    fulfillmentStatus: string;
    source: string;
    createdAt: string;
  }>;
  trend: Array<{
    date: string;
    orders: number;
    revenue: number;
    aov: number;
  }>;
  syncStatus: {
    lastSync: string;
    totalSynced: number;
    status: string;
  } | null;
  period: string;
  lastUpdated: string;
}

export default function CommerceOverview() {
  const [data, setData] = useState<CommerceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/intel/commerce?period=${period}`);
      const result: CommerceData = await res.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch commerce data:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/cron/sync-shopify', { method: 'POST' });
      const result: { success?: boolean } = await res.json();
      if (result.success) {
        // Refresh data after sync
        await fetchData();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'refunded':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getFulfillmentColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'fulfilled':
        return 'bg-green-500/20 text-green-400';
      case 'partial':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'unfulfilled':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Commerce Analytics</h1>
          <p className="text-white/60 text-sm mt-1">
            Shopify order data and revenue insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <div className="flex bg-white/5 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === p
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          {/* Sync Button */}
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Sync Orders
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {data?.syncStatus && (
        <div className="mb-6 p-3 bg-white/5 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-white/60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Last synced: {data.syncStatus.lastSync ? formatDate(data.syncStatus.lastSync) : 'Never'}
          </div>
          <span className="text-white/40">
            {data.syncStatus.totalSynced || 0} orders synced
          </span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Revenue"
          value={formatCurrency(data?.metrics.revenue.total || 0)}
          change={data?.metrics.revenue.change || 0}
          trend={data?.metrics.revenue.trend || 'neutral'}
          icon="revenue"
          loading={loading}
        />
        <MetricCard
          title="Orders"
          value={String(data?.metrics.orders.total || 0)}
          change={data?.metrics.orders.change || 0}
          trend={data?.metrics.orders.trend || 'neutral'}
          icon="orders"
          loading={loading}
        />
        <MetricCard
          title="Avg Order Value"
          value={formatCurrency(data?.metrics.averageOrderValue.total || 0)}
          change={data?.metrics.averageOrderValue.change || 0}
          trend={data?.metrics.averageOrderValue.trend || 'neutral'}
          icon="revenue"
          loading={loading}
        />
        <MetricCard
          title="Customers"
          value={String(data?.metrics.customers.total || 0)}
          change={data?.metrics.customers.change || 0}
          trend={data?.metrics.customers.trend || 'neutral'}
          icon="fans"
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <div className="lg:col-span-1 bg-white/5 rounded-xl p-5">
          <h2 className="text-lg font-medium mb-4">Top Products</h2>
          {data?.topProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/60 text-sm">No product data yet</p>
              <p className="text-white/40 text-xs mt-1">
                Sync orders to see product performance
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.topProducts.map((product, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-white/40 text-sm w-5">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{product.title}</p>
                      <p className="text-xs text-white/40">{product.unitsSold} sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-green-400">
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white/5 rounded-xl p-5">
          <h2 className="text-lg font-medium mb-4">Recent Orders</h2>
          {data?.recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </div>
              <p className="text-white/60 text-sm mb-2">No orders synced yet</p>
              <p className="text-white/40 text-xs max-w-sm mx-auto">
                Click "Sync Orders" to import your Shopify orders.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-left">
                    <th className="pb-3 font-medium">Order</th>
                    <th className="pb-3 font-medium">Total</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Fulfillment</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-white/5">
                      <td className="py-3 font-medium">#{order.orderNumber}</td>
                      <td className="py-3">{formatCurrency(order.total)}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.financialStatus)}`}>
                          {order.financialStatus || 'unknown'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${getFulfillmentColor(order.fulfillmentStatus)}`}>
                          {order.fulfillmentStatus || 'unfulfilled'}
                        </span>
                      </td>
                      <td className="py-3 text-white/60">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Setup Instructions (shown when no data) */}
      {!loading && data?.metrics.orders.total === 0 && (
        <div className="mt-8 bg-white/5 rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Getting Started</h2>
          <div className="space-y-4 text-sm text-white/60">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">1</span>
              <div>
                <p className="font-medium text-white">Configure Shopify Admin API</p>
                <p className="mt-1">Add your <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">SHOPIFY_ADMIN_ACCESS_TOKEN</code> to your environment variables.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">2</span>
              <div>
                <p className="font-medium text-white">Create a Custom App in Shopify</p>
                <p className="mt-1">Go to Settings → Apps → Develop apps → Create app. Grant read access to orders and customers.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">3</span>
              <div>
                <p className="font-medium text-white">Run Initial Sync</p>
                <p className="mt-1">Click the "Sync Orders" button above to import your order history.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">4</span>
              <div>
                <p className="font-medium text-white">Set Up Webhooks (Optional)</p>
                <p className="mt-1">Configure Shopify webhooks to receive real-time order updates at <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">/api/webhooks/shopify</code></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between text-xs text-white/40">
        <span>
          Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '—'}
        </span>
        <span>
          Commerce Analytics • Shopify Basic Compatible
        </span>
      </div>
    </div>
  );
}
