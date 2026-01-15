'use client';

import { useState, useEffect } from 'react';

interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'free_shipping';
  value: number;
  status: 'active' | 'expired' | 'scheduled' | 'disabled';
  usageCount: number;
  usageLimit?: number;
  startDate: string;
  endDate?: string;
  minPurchase?: number;
  description?: string;
}

interface DiscountFormData {
  code: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'free_shipping';
  value: number;
  description: string;
  start_date: string;
  end_date: string;
  usage_limit: string;
  min_purchase: string;
  notes: string;
}

const initialFormData: DiscountFormData = {
  code: '',
  type: 'percentage',
  value: 10,
  description: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  usage_limit: '',
  min_purchase: '',
  notes: '',
};

export default function DiscountsTab() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | Discount['status']>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DiscountFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/discounts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
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
      case 'active': return 'bg-emerald-500/10 text-emerald-500';
      case 'expired': return 'bg-red-500/10 text-red-500';
      case 'scheduled': return 'bg-[#b2a491]/10 text-[#ede8df]';
      case 'disabled': return 'bg-[#726d6c]/10 text-[#726d6c]';
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
      case 'bogo': return '2×1';
      case 'free_shipping': return '📦';
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

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (discount: Discount) => {
    setEditingId(discount.id);
    setFormData({
      code: discount.code,
      type: discount.type,
      value: discount.value,
      description: discount.description || '',
      start_date: discount.startDate,
      end_date: discount.endDate || '',
      usage_limit: discount.usageLimit?.toString() || '',
      min_purchase: discount.minPurchase?.toString() || '',
      notes: '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const url = editingId
        ? `/api/admin/discounts/${editingId}`
        : '/api/admin/discounts';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        code: formData.code,
        type: formData.type,
        value: formData.value,
        description: formData.description || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        min_purchase: formData.min_purchase ? parseFloat(formData.min_purchase) : null,
        notes: formData.notes || null,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save discount');
      }

      setShowModal(false);
      fetchDiscounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save discount');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this discount code?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/discounts/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (res.ok) {
        fetchDiscounts();
      }
    } catch (e) {
      console.error('Failed to delete discount', e);
    }
  };

  const handleToggleStatus = async (discount: Discount) => {
    const newStatus = discount.status === 'disabled' ? 'active' : 'disabled';

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/discounts/${discount.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchDiscounts();
      }
    } catch (e) {
      console.error('Failed to toggle status', e);
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
          onClick={openCreateModal}
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
        {(['all', 'active', 'scheduled', 'expired', 'disabled'] as const).map(filter => (
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
            onClick={openCreateModal}
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
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(discount)}
                        className="px-3 py-1.5 text-sm text-[#ede8df] bg-[#403633] hover:bg-[#504440] rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(discount)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          discount.status === 'disabled'
                            ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                            : 'text-[#b2a491] bg-[#403633] hover:bg-[#504440]'
                        }`}
                      >
                        {discount.status === 'disabled' ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        onClick={() => handleDelete(discount.id)}
                        className="px-3 py-1.5 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !saving && setShowModal(false)}>
          <div className="bg-[#302927] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#ede8df]">
                {editingId ? 'Edit Discount' : 'Create New Discount'}
              </h3>
              <button
                onClick={() => !saving && setShowModal(false)}
                className="text-[#b2a491] hover:text-[#ede8df]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-[#b2a491] mb-1">
                  Discount Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER25"
                  className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
                />
              </div>

              {/* Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#b2a491] mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as DiscountFormData['type'] })}
                    className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  >
                    <option value="percentage">Percentage Off</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="bogo">Buy One Get One</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#b2a491] mb-1">
                    {formData.type === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
                  </label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    disabled={formData.type === 'bogo' || formData.type === 'free_shipping'}
                    min={0}
                    max={formData.type === 'percentage' ? 100 : undefined}
                    className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d] disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#b2a491] mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summer sale discount"
                  className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#b2a491] mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#b2a491] mb-1">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  />
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#b2a491] mb-1">
                    Usage Limit (optional)
                  </label>
                  <input
                    type="number"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                    placeholder="Unlimited"
                    min={1}
                    className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#b2a491] mb-1">
                    Min. Purchase ($)
                  </label>
                  <input
                    type="number"
                    value={formData.min_purchase}
                    onChange={(e) => setFormData({ ...formData, min_purchase: e.target.value })}
                    placeholder="No minimum"
                    min={0}
                    step="0.01"
                    className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[#b2a491] mb-1">
                  Internal Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes for your team..."
                  rows={2}
                  className="w-full px-4 py-2 bg-[#1a1614] border border-[#b2a491]/20 rounded-lg text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => !saving && setShowModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm bg-[#403633] text-[#ede8df] rounded-lg hover:bg-[#504440] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !formData.code || !formData.start_date}
                className="flex-1 px-4 py-2 text-sm bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Discount'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
