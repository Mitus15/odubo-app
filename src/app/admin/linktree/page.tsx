'use client';

/**
 * LinkTree / Connect Hub Management
 * Admin interface for managing branded digital presence links
 */

import { useState, useEffect } from 'react';
import type { LinkTreeItem, LinkCategory } from '@/types/linktree';

const categoryOptions: LinkCategory[] = [
  'streaming',
  'social',
  'video',
  'fashion',
  'admin',
  'store',
  'other',
];

export default function LinkTreeAdminPage() {
  const [links, setLinks] = useState<LinkTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    url: '',
    category: 'social' as LinkCategory,
    platform: '',
    description: '',
    display_order: 0,
    is_active: true,
    is_featured: false,
    managed_by: '',
    notes: '',
    last_posted_at: '',
  });

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/linktree');
      if (res.ok) {
        const data: any = await res.json();
        // Show all links (including inactive) for admin
        const allLinksRes = await fetch('/api/admin/linktree/all');
        const allLinks: any = allLinksRes.ok ? await allLinksRes.json() : { links: data.links };
        setLinks(allLinks.links || data.links || []);
      }
    } catch (error) {
      console.error('Failed to fetch links:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editing !== null ? `/api/linktree/${editing}` : '/api/linktree';
      const method = editing !== null ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          is_active: formData.is_active ? 1 : 0,
          is_featured: formData.is_featured ? 1 : 0,
        }),
      });

      if (res.ok) {
        await fetchLinks();
        resetForm();
      } else {
        alert('Failed to save link');
      }
    } catch (error) {
      console.error('Error saving link:', error);
      alert('Error saving link');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this link?')) return;

    try {
      const res = await fetch(`/api/linktree/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchLinks();
      } else {
        alert('Failed to delete link');
      }
    } catch (error) {
      console.error('Error deleting link:', error);
    }
  };

  const handleEdit = (link: LinkTreeItem) => {
    setEditing(link.id);
    setExpandedRow(link.id);
    setFormData({
      title: link.title,
      url: link.url,
      category: link.category,
      platform: link.platform || '',
      description: link.description || '',
      display_order: link.display_order,
      is_active: Boolean(link.is_active),
      is_featured: Boolean(link.is_featured),
      managed_by: link.managed_by || '',
      notes: link.notes || '',
      last_posted_at: link.last_posted_at || '',
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      url: '',
      category: 'social',
      platform: '',
      description: '',
      display_order: 0,
      is_active: true,
      is_featured: false,
      managed_by: '',
      notes: '',
      last_posted_at: '',
    });
    setEditing(null);
    setExpandedRow(null);
    setCreating(false);
  };

  return (
    <div className="w-full min-h-screen p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df]">LinkTree / Connect Hub</h1>
            <p className="text-sm sm:text-base text-[#b2a491] mt-1">Manage your branded digital presence links</p>
          </div>
          <button
            onClick={() => setCreating(!creating)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#843c2d] text-[#ede8df] font-semibold hover:bg-[#9a4535] transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            {creating ? 'Cancel' : '+ Add Link'}
          </button>
        </div>

        {/* Create/Edit Form */}
        {creating && (
          <form onSubmit={handleSubmit} className="glass-surface rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-[#ede8df] mb-4">
              {editing !== null ? 'Edit Link' : 'Create New Link'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-[#b2a491] mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm sm:text-base"
                  required
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-[#b2a491] mb-1">URL *</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm sm:text-base"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#b2a491] mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as LinkCategory })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm sm:text-base"
                  required
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#b2a491] mb-1">Platform</label>
                <input
                  type="text"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  placeholder="e.g., spotify, instagram"
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#b2a491] mb-1">Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#b2a491] mb-1">Managed By</label>
                <input
                  type="text"
                  value={formData.managed_by}
                  onChange={(e) => setFormData({ ...formData, managed_by: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm sm:text-base"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#b2a491] mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm sm:text-base"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#b2a491] mb-1">Internal Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm sm:text-base"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 text-[#b2a491] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded w-4 h-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 text-[#b2a491] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="rounded w-4 h-4"
                  />
                  <span className="text-sm">Featured</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#843c2d] text-[#ede8df] font-semibold hover:bg-[#9a4535] transition-colors text-sm sm:text-base"
              >
                {editing !== null ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#302927] text-[#b2a491] font-semibold hover:bg-[#1a1918] transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Links - Responsive Cards and Table */}
        <div className="glass-surface rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin mx-auto" />
            </div>
          ) : links.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[#726d6c]">
              <p className="text-base sm:text-lg">No links yet. Create your first link to get started!</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden divide-y divide-[#502d26]/30">
                {links.map((link) => (
                  <div key={link.id} className="p-4 hover:bg-[#1a1918]/40 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[#ede8df] font-semibold text-base truncate">{link.title}</h3>
                        <p className="text-xs text-[#726d6c] truncate mt-0.5">{link.url}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {link.is_active ? (
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-700/30 whitespace-nowrap">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#302927] text-[#726d6c] border border-[#502d26]/30 whitespace-nowrap">
                            Inactive
                          </span>
                        )}
                        {link.is_featured && (
                          <span className="text-amber-400">⭐</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                      <div>
                        <span className="text-[#726d6c] text-xs">Category:</span>
                        <span className="text-[#b2a491] ml-1">{link.category}</span>
                      </div>
                      <div>
                        <span className="text-[#726d6c] text-xs">Platform:</span>
                        <span className="text-[#b2a491] ml-1">{link.platform || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#726d6c] text-xs">Clicks:</span>
                        <span className="text-[#ede8df] font-semibold ml-1">{link.click_count}</span>
                      </div>
                      <div>
                        <span className="text-[#726d6c] text-xs">Last Clicked:</span>
                        <span className="text-[#b2a491] ml-1 text-xs">
                          {link.last_clicked_at ? new Date(link.last_clicked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </span>
                      </div>
                      {link.managed_by && (
                        <div className="col-span-2">
                          <span className="text-[#726d6c] text-xs">Managed by:</span>
                          <span className="text-[#b2a491] ml-1">{link.managed_by}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(link)}
                        className="flex-1 px-3 py-2 text-xs rounded-lg bg-[#302927] text-[#b2a491] hover:bg-[#1a1918] transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="flex-1 px-3 py-2 text-xs rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#1a1918]/80 border-b border-[#502d26]/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#b2a491] uppercase w-8"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#b2a491] uppercase w-32">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#b2a491] uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#b2a491] uppercase">Platform</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#b2a491] uppercase">Clicks</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#b2a491] uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#b2a491] uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#502d26]/30">
                    {links.map((link) => (
                      <>
                        <tr key={link.id} className="hover:bg-[#1a1918]/40 transition-colors">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                if (expandedRow === link.id) {
                                  setExpandedRow(null);
                                  setEditing(null);
                                } else {
                                  setExpandedRow(link.id);
                                  setEditing(link.id);
                                  setFormData({
                                    title: link.title,
                                    url: link.url,
                                    category: link.category,
                                    platform: link.platform || '',
                                    description: link.description || '',
                                    display_order: link.display_order,
                                    is_active: Boolean(link.is_active),
                                    is_featured: Boolean(link.is_featured),
                                    managed_by: link.managed_by || '',
                                    notes: link.notes || '',
                                    last_posted_at: link.last_posted_at || '',
                                  });
                                }
                              }}
                              className="text-[#b2a491] hover:text-[#ede8df] transition-colors"
                            >
                              {expandedRow === link.id ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[#ede8df] font-medium">{link.title}</div>
                            <div className="text-xs text-[#726d6c] truncate max-w-xs">{link.url}</div>
                          </td>
                          <td className="px-4 py-3 text-[#b2a491] text-sm">{link.category}</td>
                          <td className="px-4 py-3 text-[#b2a491] text-sm">{link.platform || '—'}</td>
                          <td className="px-4 py-3 text-[#ede8df] font-semibold">{link.click_count}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {link.is_active ? (
                                <span className="px-2 py-1 text-xs rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-700/30">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs rounded-full bg-[#302927] text-[#726d6c] border border-[#502d26]/30">
                                  Inactive
                                </span>
                              )}
                              {link.is_featured && (
                                <span className="px-2 py-1 text-xs rounded-full bg-amber-900/30 text-amber-400 border border-amber-700/30">
                                  ⭐
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleDelete(link.id)}
                                className="px-3 py-1 text-xs rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedRow === link.id && (
                          <tr className="bg-[#1a1918]/60">
                            <td colSpan={7} className="px-4 py-4">
                              {/* Edit Form */}
                              <form onSubmit={handleSubmit} className="space-y-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-[#b2a491] mb-1">Title *</label>
                                      <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-[#b2a491] mb-1">URL *</label>
                                      <input
                                        type="url"
                                        required
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-[#b2a491] mb-1">Category *</label>
                                      <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value as LinkCategory })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm"
                                      >
                                        {categoryOptions.map((cat) => (
                                          <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-[#b2a491] mb-1">Platform</label>
                                      <input
                                        type="text"
                                        value={formData.platform}
                                        onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                                        placeholder="e.g., spotify, instagram"
                                        className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-[#b2a491] mb-1">Display Order</label>
                                      <input
                                        type="number"
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-[#b2a491] mb-1">Managed By</label>
                                      <input
                                        type="text"
                                        value={formData.managed_by}
                                        onChange={(e) => setFormData({ ...formData, managed_by: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm"
                                      />
                                    </div>

                                    <div className="sm:col-span-2">
                                      <label className="block text-sm font-medium text-[#b2a491] mb-1">Description</label>
                                      <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm"
                                      />
                                    </div>

                                    <div className="sm:col-span-2">
                                      <label className="block text-sm font-medium text-[#b2a491] mb-1">Internal Notes</label>
                                      <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-lg bg-[#1a1918]/80 border border-[#502d26]/30 text-[#ede8df] focus:outline-none focus:border-[#843c2d] text-sm"
                                      />
                                    </div>

                                    <div className="sm:col-span-2 flex gap-4">
                                      <label className="flex items-center gap-2 text-[#b2a491] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={formData.is_active}
                                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                          className="rounded w-4 h-4"
                                        />
                                        <span className="text-sm">Active</span>
                                      </label>
                                      <label className="flex items-center gap-2 text-[#b2a491] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={formData.is_featured}
                                          onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                                          className="rounded w-4 h-4"
                                        />
                                        <span className="text-sm">Featured</span>
                                      </label>
                                    </div>
                                  </div>

                                  <div className="flex gap-3 pt-2">
                                    <button
                                      type="submit"
                                      className="px-6 py-2 rounded-lg bg-[#843c2d] text-[#ede8df] font-semibold hover:bg-[#9a4535] transition-colors text-sm"
                                    >
                                      Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={resetForm}
                                      className="px-6 py-2 rounded-lg bg-[#302927] text-[#b2a491] font-semibold hover:bg-[#1a1918] transition-colors text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
