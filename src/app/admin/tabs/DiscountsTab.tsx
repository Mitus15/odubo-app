'use client';

import { useState, useEffect } from 'react';

interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'free_shipping';
  value: number;
  status: 'active' | 'expired' | 'scheduled';
  usageCount: number;
  usageLimit?: number;
  startDate: string;
  endDate?: string;
  minPurchase?: number;
}

export default function DiscountsTab() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | Discount['status']>('all');
  const [showNewDiscountModal, setShowNewDiscountModal] = useState(false);

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const res = await fetch('/api/admin/discounts');
      if (res.ok) {
        const data = await res.json() as { discounts?: Discount[] };
        setDiscounts(data.discounts || []);
      }
    } catch (e) {
      console.error('Failed to fetch discounts', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    activeFilter === 'all' || d.status === activeFilter
  );

  const getStatusColor = (status: Discount['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500';
      case 'expired': return 'bg-red-500/10 text-red-500';
      case 'scheduled': return 'bg-blue-500/10 text-blue-500';
    }
  };

  const getTypeLabel = (type: Discount['type']) => {
    switch (type) {
      case 'percentage': return 'Percentage';
      case 'fixed': return 'Fixed Amount';
      case 'bogo': return 'BOGO';
      case 'free_shipping': return 'Free Shipping';
    }
  };

  const getTypeIcon = (type: Discount['type']) => {
    switch (type) {
      case 'percentage': return '%';
      case 'fixed': return '$';
      case 'bogo': return '🎁';
      case 'free_shipping': return '🚚';
    }
  };

  const formatValue = (discount: Discount) => {
    switch (discount.type) {
      case 'percentage': return `${discount.value}%`;
      case 'fixed': return `$${discount.value}`;
      case 'bogo': return 'Buy 1 Get 1';
      case 'free_shipping': return 'Free Shipping';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-[#b2a491]">Loading discounts...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#ede8df]">Discount Codes</h2>
          <p className="text-sm text-[#b2a491] mt-1">Create and manage discount codes for your store</p>
        </div>
        <button
          onClick={() => setShowNewDiscountModal(true)}
          className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors"
        >
          + Create Discount
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Codes', value: discounts.length, color: '#3b82f6' },
          { label: 'Active', value: discounts.filter(d => d.status === 'active').length, color: '#10b981' },
          { label: 'Total Uses', value: discounts.reduce((sum, d) => sum + d.usageCount, 0).toLocaleString(), color: '#8b5cf6' },
          { label: 'Expired', value: discounts.filter(d => d.status === 'expired').length, color: '#ef4444' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#302927] rounded-xl p-4">
            <div className="text-sm text-[#b2a491]">{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'scheduled', 'expired'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeFilter === filter
                ? 'bg-[#843c2d] text-[#ede8df]'
                : 'bg-[#302927] text-[#b2a491] hover:bg-[#403633]'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Discounts List */}
      {filteredDiscounts.length === 0 ? (
        <div className="bg-[#302927] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">🎟️</div>
          <h3 className="text-lg font-semibold text-[#ede8df] mb-2">No discount codes yet</h3>
          <p className="text-[#b2a491] mb-4">Create your first discount code to boost sales</p>
          <button
            onClick={() => setShowNewDiscountModal(true)}
            className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors"
          >
            + Create Discount
          </button>
        </div>
      ) : (
        <div className="bg-[#302927] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#403633]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#ede8df]">Code</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#ede8df]">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#ede8df]">Value</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#ede8df]">Usage</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#ede8df]">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[#ede8df]">Dates</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-[#ede8df]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#502d26]">
              {filteredDiscounts.map(discount => (
                <tr key={discount.id} className="hover:bg-[#403633] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-[#ede8df]">{discount.code}</div>
                    {discount.minPurchase && (
                      <div className="text-xs text-[#b2a491]">Min: ${discount.minPurchase}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getTypeIcon(discount.type)}</span>
                      <span className="text-sm text-[#ede8df]">{getTypeLabel(discount.type)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-[#ede8df]">{formatValue(discount)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-[#ede8df]">
                      {discount.usageCount}
                      {discount.usageLimit && (
                        <span className="text-[#b2a491]"> / {discount.usageLimit}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getStatusColor(discount.status)}`}>
                      {discount.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-[#b2a491]">
                      <div>{new Date(discount.startDate).toLocaleDateString()}</div>
                      {discount.endDate && (
                        <div>→ {new Date(discount.endDate).toLocaleDateString()}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="px-3 py-1.5 text-sm text-[#ede8df] bg-[#403633] hover:bg-[#504440] rounded-lg transition-colors">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Discount Modal Placeholder */}
      {showNewDiscountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewDiscountModal(false)}>
          <div className="bg-[#302927] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[#ede8df] mb-4">Create New Discount</h3>
            <p className="text-[#b2a491] mb-4">Discount creation form will be implemented here</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewDiscountModal(false)}
                className="flex-1 px-4 py-2 text-sm bg-[#403633] text-[#ede8df] rounded-lg hover:bg-[#504440] transition-colors"
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-2 text-sm bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
