'use client';

import { useState, useEffect } from 'react';
import type { ProductCost, ProductCostInput } from '@/types/bi';
import { useToast } from '@/contexts/ToastContext';

interface Product {
  id: string;
  title: string;
  handle: string;
  price: number;
}

interface FinancialSummary {
  period: { start: string; end: string };
  revenue_cents: number;
  order_count: number;
  avg_order_value: number;
  cogs_cents: number;
  gross_profit_cents: number;
  expenses_cents: number;
  net_profit_cents: number;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function FinanceTab() {
  const toast = useToast();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'ytd'>('30d');
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCosts, setProductCosts] = useState<ProductCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<ProductCost | null>(null);
  const [formData, setFormData] = useState<ProductCostInput>({
    product_handle: '',
    unit_cost_cents: 0,
    shipping_cost_cents: 0,
    packaging_cost_cents: 0,
    effective_from: new Date().toISOString().split('T')[0],
  });

  const getPeriodDates = (p: string): { start: string; end: string } => {
    const end = new Date();
    const start = new Date();

    switch (p) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case 'ytd':
        start.setMonth(0, 1);
        break;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const dates = getPeriodDates(period);

      try {
        // Fetch commerce data
        const commerceRes = await fetch(`/api/intel/commerce?period=${period}`);
        const commerceData = await commerceRes.json();

        // Fetch expenses for period
        const expensesRes = await fetch(`/api/bi/expenses/summary?start=${dates.start}&end=${dates.end}`);
        const expensesData = await expensesRes.json();

        // Fetch product costs
        const costsRes = await fetch('/api/bi/product-costs?current=true');
        const costsData = await costsRes.json();

        // Fetch products
        const productsRes = await fetch('/api/products');
        const productsData = await productsRes.json();

        if (productsData.success) {
          setProducts(productsData.products || []);
        }

        if (costsData.success) {
          setProductCosts(costsData.costs || []);
        }

        // Calculate COGS based on orders and product costs
        const revenue = commerceData.success ? (commerceData.metrics?.total_revenue || 0) : 0;
        const orderCount = commerceData.success ? (commerceData.metrics?.total_orders || 0) : 0;
        const expenses = expensesData.success ? (expensesData.summary?.total_cents || 0) : 0;

        // Estimate COGS (this would need actual order line item data for accuracy)
        const estimatedCogs = Math.round(revenue * 0.4); // Placeholder: 40% of revenue

        setSummary({
          period: dates,
          revenue_cents: revenue,
          order_count: orderCount,
          avg_order_value: orderCount > 0 ? Math.round(revenue / orderCount) : 0,
          cogs_cents: estimatedCogs,
          gross_profit_cents: revenue - estimatedCogs,
          expenses_cents: expenses,
          net_profit_cents: revenue - estimatedCogs - expenses,
        });
      } catch (e) {
        console.error('Failed to fetch financial data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  const openAddModal = (productHandle?: string) => {
    setEditingCost(null);
    setFormData({
      product_handle: productHandle || '',
      unit_cost_cents: 0,
      shipping_cost_cents: 0,
      packaging_cost_cents: 0,
      effective_from: new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cost: ProductCost) => {
    setEditingCost(cost);
    setFormData({
      product_handle: cost.product_handle,
      variant_sku: cost.variant_sku || undefined,
      unit_cost_cents: cost.unit_cost_cents,
      shipping_cost_cents: cost.shipping_cost_cents,
      packaging_cost_cents: cost.packaging_cost_cents,
      effective_from: cost.effective_from,
      notes: cost.notes || undefined,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const method = editingCost ? 'PUT' : 'POST';
      const body = editingCost ? { id: editingCost.id, ...formData } : formData;

      const res = await fetch('/api/bi/product-costs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingCost ? 'Product cost updated' : 'Product cost added');
        setIsModalOpen(false);
        // Refresh costs
        const costsRes = await fetch('/api/bi/product-costs?current=true');
        const costsData = await costsRes.json();
        if (costsData.success) {
          setProductCosts(costsData.costs || []);
        }
      } else {
        toast.error(data.error || 'Failed to save product cost');
      }
    } catch (e) {
      console.error('Failed to save product cost:', e);
      toast.error('An error occurred while saving');
    }
  };

  const grossMargin = summary && summary.revenue_cents > 0
    ? (summary.gross_profit_cents / summary.revenue_cents) * 100
    : 0;

  const netMargin = summary && summary.revenue_cents > 0
    ? (summary.net_profit_cents / summary.revenue_cents) * 100
    : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#ede8df]">Finance</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'ytd'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                period === p
                  ? 'bg-[#302927] text-[#ede8df] font-medium'
                  : 'text-[#b2a491] hover:bg-[#302927]/50'
              }`}
            >
              {p === 'ytd' ? 'YTD' : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[#b2a491] text-center py-12">Loading financial data...</div>
      ) : (
        <>
          {/* P&L Summary */}
          <div className="bg-[#1c1a19] rounded-xl border border-[#502d26]/30 p-6">
            <h3 className="text-lg font-semibold text-[#ede8df] mb-6">Profit & Loss Summary</h3>

            <div className="space-y-4">
              {/* Revenue */}
              <div className="flex justify-between items-center py-3 border-b border-[#502d26]/20">
                <div>
                  <div className="text-[#ede8df] font-medium">Revenue</div>
                  <div className="text-xs text-[#b2a491]">{summary?.order_count || 0} orders</div>
                </div>
                <div className="text-xl font-bold text-emerald-400">
                  {formatCurrency(summary?.revenue_cents || 0)}
                </div>
              </div>

              {/* COGS */}
              <div className="flex justify-between items-center py-3 border-b border-[#502d26]/20">
                <div>
                  <div className="text-[#ede8df] font-medium">Cost of Goods Sold</div>
                  <div className="text-xs text-[#b2a491]">Product costs + shipping</div>
                </div>
                <div className="text-xl font-bold text-red-400">
                  -{formatCurrency(summary?.cogs_cents || 0)}
                </div>
              </div>

              {/* Gross Profit */}
              <div className="flex justify-between items-center py-3 border-b border-[#502d26]/20 bg-[#302927]/20 -mx-6 px-6">
                <div>
                  <div className="text-[#ede8df] font-semibold">Gross Profit</div>
                  <div className="text-xs text-[#b2a491]">{formatPercent(grossMargin)} margin</div>
                </div>
                <div className={`text-xl font-bold ${(summary?.gross_profit_cents || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(summary?.gross_profit_cents || 0)}
                </div>
              </div>

              {/* Operating Expenses */}
              <div className="flex justify-between items-center py-3 border-b border-[#502d26]/20">
                <div>
                  <div className="text-[#ede8df] font-medium">Operating Expenses</div>
                  <div className="text-xs text-[#b2a491]">Ads, subscriptions, services</div>
                </div>
                <div className="text-xl font-bold text-red-400">
                  -{formatCurrency(summary?.expenses_cents || 0)}
                </div>
              </div>

              {/* Net Profit */}
              <div className="flex justify-between items-center py-4 bg-[#302927]/30 -mx-6 px-6 rounded-b-lg">
                <div>
                  <div className="text-[#ede8df] font-bold text-lg">Net Profit</div>
                  <div className="text-xs text-[#b2a491]">{formatPercent(netMargin)} net margin</div>
                </div>
                <div className={`text-2xl font-bold ${(summary?.net_profit_cents || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(summary?.net_profit_cents || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Product Costs (COGS) */}
          <div className="bg-[#1c1a19] rounded-xl border border-[#502d26]/30 overflow-hidden">
            <div className="p-4 border-b border-[#502d26]/30 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[#ede8df]">Product Costs (COGS)</h3>
              <button
                onClick={() => openAddModal()}
                className="px-3 py-1.5 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors"
              >
                + Add Cost
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#302927]/40 text-[#b2a491] border-b border-[#502d26]/30">
                  <tr>
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium text-right">Unit Cost</th>
                    <th className="p-4 font-medium text-right">Shipping</th>
                    <th className="p-4 font-medium text-right">Packaging</th>
                    <th className="p-4 font-medium text-right">Total COGS</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#502d26]/30">
                  {products.map((product) => {
                    const cost = productCosts.find((c) => c.product_handle === product.handle);
                    const totalCogs = cost
                      ? cost.unit_cost_cents + cost.shipping_cost_cents + cost.packaging_cost_cents
                      : 0;

                    return (
                      <tr key={product.id} className="hover:bg-[#302927]/20 transition-colors group">
                        <td className="p-4">
                          <div className="font-medium text-[#ede8df]">{product.title}</div>
                          <div className="text-xs text-[#b2a491]">{product.handle}</div>
                        </td>
                        <td className="p-4 text-right text-[#b2a491]">
                          {cost ? formatCurrency(cost.unit_cost_cents) : '—'}
                        </td>
                        <td className="p-4 text-right text-[#b2a491]">
                          {cost ? formatCurrency(cost.shipping_cost_cents) : '—'}
                        </td>
                        <td className="p-4 text-right text-[#b2a491]">
                          {cost ? formatCurrency(cost.packaging_cost_cents) : '—'}
                        </td>
                        <td className="p-4 text-right font-medium text-[#ede8df]">
                          {cost ? formatCurrency(totalCogs) : '—'}
                        </td>
                        <td className="p-4 text-right">
                          {cost ? (
                            <button
                              onClick={() => openEditModal(cost)}
                              className="px-2 py-1 text-xs text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927] rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                              Edit
                            </button>
                          ) : (
                            <button
                              onClick={() => openAddModal(product.handle)}
                              className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                              + Set Cost
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#b2a491]">
                        No products found. Products will appear here once synced from Shopify.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Cost Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1c1a19] rounded-2xl border border-[#502d26]/30 w-full max-w-md mx-4">
            <div className="p-6 border-b border-[#502d26]/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#ede8df]">
                {editingCost ? 'Edit Product Cost' : 'Set Product Cost'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#b2a491] hover:text-[#ede8df] text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Product */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Product *</label>
                <select
                  value={formData.product_handle}
                  onChange={(e) => setFormData({ ...formData, product_handle: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  required
                  disabled={!!editingCost}
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.handle}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Cost */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Unit Cost (CAD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={(formData.unit_cost_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setFormData({ ...formData, unit_cost_cents: Math.round(parseFloat(e.target.value || '0') * 100) })
                  }
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  required
                />
                <p className="text-xs text-[#b2a491] mt-1">Cost to produce/acquire one unit</p>
              </div>

              {/* Shipping Cost */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Shipping Cost per Unit (CAD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={((formData.shipping_cost_cents || 0) / 100).toFixed(2)}
                  onChange={(e) =>
                    setFormData({ ...formData, shipping_cost_cents: Math.round(parseFloat(e.target.value || '0') * 100) })
                  }
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                />
              </div>

              {/* Packaging Cost */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Packaging Cost per Unit (CAD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={((formData.packaging_cost_cents || 0) / 100).toFixed(2)}
                  onChange={(e) =>
                    setFormData({ ...formData, packaging_cost_cents: Math.round(parseFloat(e.target.value || '0') * 100) })
                  }
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                />
              </div>

              {/* Effective From */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Effective From *</label>
                <input
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d] resize-none"
                  rows={2}
                  placeholder="e.g., Supplier changed, bulk discount"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#502d26]/30">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-[#b2a491] hover:text-[#ede8df] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors"
                >
                  {editingCost ? 'Save Changes' : 'Set Cost'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
