'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Expense, ExpenseCategory, ExpenseInput } from '@/types/bi';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'advertising', label: 'Advertising' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'production', label: 'Production' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'services', label: 'Services' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'platform_fees', label: 'Platform Fees' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  advertising: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  subscription: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  production: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  equipment: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  services: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  marketing: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  shipping: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  platform_fees: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

interface ExpenseSummary {
  total_cents: number;
  by_category: { category: ExpenseCategory; total_cents: number; count: number }[];
  monthly_recurring_cents: number;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | ExpenseCategory>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<ExpenseInput>({
    category: 'other',
    name: '',
    amount_cents: 0,
    expense_date: new Date().toISOString().split('T')[0],
  });

  const fetchExpenses = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') {
        params.set('category', activeFilter);
      }

      const res = await fetch(`/api/bi/expenses?${params}`);
      const data = await res.json();
      if (data.success) {
        setExpenses(data.expenses);
      }
    } catch (e) {
      console.error('Failed to fetch expenses:', e);
    }
  }, [activeFilter]);

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/bi/expenses/summary');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (e) {
      console.error('Failed to fetch summary:', e);
    }
  };

  useEffect(() => {
    Promise.all([fetchExpenses(), fetchSummary()]).finally(() => setLoading(false));
  }, [fetchExpenses]);

  const openAddModal = () => {
    setEditingExpense(null);
    setFormData({
      category: 'other',
      name: '',
      amount_cents: 0,
      expense_date: new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      name: expense.name,
      description: expense.description || '',
      vendor: expense.vendor || '',
      amount_cents: expense.amount_cents,
      expense_date: expense.expense_date,
      is_recurring: expense.is_recurring === 1,
      recurring_interval: expense.recurring_interval || undefined,
      notes: expense.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingExpense
        ? `/api/bi/expenses/${editingExpense.id}`
        : '/api/bi/expenses';
      const method = editingExpense ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchExpenses();
        fetchSummary();
      } else {
        alert(data.error || 'Failed to save expense');
      }
    } catch (e) {
      console.error('Failed to save expense:', e);
      alert('Failed to save expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const res = await fetch(`/api/bi/expenses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchExpenses();
        fetchSummary();
      }
    } catch (e) {
      console.error('Failed to delete expense:', e);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#ede8df]">Expenses</h2>
        <button
          onClick={openAddModal}
          className="px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors"
        >
          + Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Total Expenses</div>
          <div className="text-2xl font-bold text-[#ede8df]">
            {summary ? formatCurrency(summary.total_cents) : '$0.00'}
          </div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Monthly Recurring</div>
          <div className="text-2xl font-bold text-[#ede8df]">
            {summary ? formatCurrency(summary.monthly_recurring_cents) : '$0.00'}
          </div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Top Category</div>
          <div className="text-xl font-bold text-[#ede8df]">
            {summary?.by_category[0]?.category
              ? EXPENSE_CATEGORIES.find(c => c.value === summary.by_category[0].category)?.label || 'None'
              : 'None'}
          </div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Expense Count</div>
          <div className="text-2xl font-bold text-[#ede8df]">{expenses.length}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-[#1c1a19] rounded-xl border border-[#502d26]/30 overflow-hidden">
        {/* Filter Bar */}
        <div className="border-b border-[#502d26]/30 p-2 flex items-center gap-1 bg-[#302927]/20 overflow-x-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
              activeFilter === 'all'
                ? 'bg-[#302927] text-[#ede8df] font-medium'
                : 'text-[#b2a491] hover:bg-[#302927]/50 hover:text-[#ede8df]'
            }`}
          >
            All
          </button>
          {EXPENSE_CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                activeFilter === value
                  ? 'bg-[#302927] text-[#ede8df] font-medium'
                  : 'text-[#b2a491] hover:bg-[#302927]/50 hover:text-[#ede8df]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#302927]/40 text-[#b2a491] border-b border-[#502d26]/30">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Vendor</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium text-right">Amount</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#502d26]/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#b2a491]">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#b2a491]">
                    No expenses found. Click &quot;Add Expense&quot; to get started.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="hover:bg-[#302927]/20 transition-colors group"
                  >
                    <td className="p-4">
                      <div className="font-medium text-[#ede8df]">{expense.name}</div>
                      {expense.description && (
                        <div className="text-xs text-[#b2a491] mt-0.5">{expense.description}</div>
                      )}
                      {expense.is_recurring === 1 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 mt-1">
                          {expense.recurring_interval}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
                          CATEGORY_COLORS[expense.category]
                        }`}
                      >
                        {EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label}
                      </span>
                    </td>
                    <td className="p-4 text-[#b2a491]">{expense.vendor || '—'}</td>
                    <td className="p-4 text-[#b2a491]">{formatDate(expense.expense_date)}</td>
                    <td className="p-4 text-right font-medium text-[#ede8df]">
                      {formatCurrency(expense.amount_cents)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(expense)}
                          className="px-2 py-1 text-xs text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927] rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1c1a19] rounded-2xl border border-[#502d26]/30 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#502d26]/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#ede8df]">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#b2a491] hover:text-[#ede8df] text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  required
                  placeholder="e.g., Meta Ads - January"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as ExpenseCategory })
                  }
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                >
                  {EXPENSE_CATEGORIES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Amount (CAD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={(formData.amount_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setFormData({ ...formData, amount_cents: Math.round(parseFloat(e.target.value || '0') * 100) })
                  }
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  required
                  placeholder="0.00"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  required
                />
              </div>

              {/* Vendor */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Vendor</label>
                <input
                  type="text"
                  value={formData.vendor || ''}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  placeholder="e.g., Meta, Shopify, DistroKid"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d] resize-none"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>

              {/* Recurring */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring || false}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="rounded border-[#502d26]/50 bg-[#171616] checked:bg-[#843c2d]"
                />
                <label htmlFor="is_recurring" className="text-sm text-[#b2a491]">
                  This is a recurring expense
                </label>
              </div>

              {formData.is_recurring && (
                <div>
                  <label className="block text-sm text-[#b2a491] mb-1">Recurring Interval</label>
                  <select
                    value={formData.recurring_interval || 'monthly'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        recurring_interval: e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
                      })
                    }
                    className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d] resize-none"
                  rows={2}
                  placeholder="Any additional notes..."
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
                  {editingExpense ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
