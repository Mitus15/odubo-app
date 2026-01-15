'use client';

import { useState, useEffect } from 'react';
import type { AdCampaign, AdCampaignInput, AdPlatform, AdCampaignStatus } from '@/types/bi';

interface CampaignWithMetrics extends AdCampaign {
  metrics: {
    total_spend_cents: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    total_conversion_value_cents: number;
    roas: number | null;
  };
}

const PLATFORMS: { value: AdPlatform; label: string; icon: string }[] = [
  { value: 'meta', label: 'Meta (FB/IG)', icon: '📘' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'google', label: 'Google', icon: '🔍' },
  { value: 'youtube', label: 'YouTube', icon: '▶️' },
  { value: 'spotify_ads', label: 'Spotify Ads', icon: '🎧' },
  { value: 'other', label: 'Other', icon: '📢' },
];

const STATUSES: { value: AdCampaignStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'paused', label: 'Paused', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'completed', label: 'Completed', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  { value: 'draft', label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
];

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdCampaignsTab() {
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [totals, setTotals] = useState({
    spend_cents: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    conversion_value_cents: 0,
    roas: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | AdCampaignStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignWithMetrics | null>(null);
  const [formData, setFormData] = useState<AdCampaignInput>({
    platform: 'meta',
    name: '',
    start_date: new Date().toISOString().split('T')[0],
  });
  const [metricsForm, setMetricsForm] = useState({
    date: new Date().toISOString().split('T')[0],
    spend_cents: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    conversion_value_cents: 0,
  });

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/bi/ad-campaigns');
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
        setTotals(data.totals || {
          spend_cents: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversion_value_cents: 0,
          roas: null,
        });
      }
    } catch (e) {
      console.error('Failed to fetch campaigns:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bi/ad-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchCampaigns();
      } else {
        alert(data.error || 'Failed to create campaign');
      }
    } catch (e) {
      console.error('Failed to create campaign:', e);
    }
  };

  const handleMetricsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;

    try {
      const res = await fetch(`/api/bi/ad-campaigns/${selectedCampaign.id}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsForm),
      });
      const data = await res.json();
      if (data.success) {
        setIsMetricsModalOpen(false);
        fetchCampaigns();
      } else {
        alert(data.error || 'Failed to add metrics');
      }
    } catch (e) {
      console.error('Failed to add metrics:', e);
    }
  };

  const filteredCampaigns = campaigns.filter((c) =>
    activeFilter === 'all' ? true : c.status === activeFilter
  );

  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const overallCpc = totals.clicks > 0 ? totals.spend_cents / totals.clicks : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#ede8df]">Ad Campaigns</h2>
        <button
          onClick={() => {
            setFormData({
              platform: 'meta',
              name: '',
              start_date: new Date().toISOString().split('T')[0],
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Total Spend</div>
          <div className="text-2xl font-bold text-red-400">{formatCurrency(totals.spend_cents)}</div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Impressions</div>
          <div className="text-2xl font-bold text-[#ede8df]">{formatNumber(totals.impressions)}</div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Clicks</div>
          <div className="text-2xl font-bold text-[#ede8df]">{formatNumber(totals.clicks)}</div>
          <div className="text-xs text-[#b2a491]">{overallCtr.toFixed(2)}% CTR</div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Conversions</div>
          <div className="text-2xl font-bold text-emerald-400">{formatNumber(totals.conversions)}</div>
          <div className="text-xs text-[#b2a491]">{formatCurrency(overallCpc)} CPC</div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">ROAS</div>
          <div className={`text-2xl font-bold ${(totals.roas || 0) >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {totals.roas !== null ? `${totals.roas.toFixed(2)}x` : '—'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-[#1c1a19] rounded-xl border border-[#502d26]/30 overflow-hidden">
        {/* Filter Bar */}
        <div className="border-b border-[#502d26]/30 p-2 flex items-center gap-1 bg-[#302927]/20">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeFilter === 'all'
                ? 'bg-[#302927] text-[#ede8df] font-medium'
                : 'text-[#b2a491] hover:bg-[#302927]/50'
            }`}
          >
            All
          </button>
          {STATUSES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeFilter === value
                  ? 'bg-[#302927] text-[#ede8df] font-medium'
                  : 'text-[#b2a491] hover:bg-[#302927]/50'
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
                <th className="p-4 font-medium">Campaign</th>
                <th className="p-4 font-medium">Platform</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Spend</th>
                <th className="p-4 font-medium text-right">Impressions</th>
                <th className="p-4 font-medium text-right">Clicks</th>
                <th className="p-4 font-medium text-right">Conv.</th>
                <th className="p-4 font-medium text-right">ROAS</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#502d26]/30">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#b2a491]">Loading campaigns...</td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#b2a491]">
                    No campaigns found. Click &quot;New Campaign&quot; to get started.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const statusInfo = STATUSES.find((s) => s.value === campaign.status);
                  const platformInfo = PLATFORMS.find((p) => p.value === campaign.platform);

                  return (
                    <tr key={campaign.id} className="hover:bg-[#302927]/20 transition-colors group">
                      <td className="p-4">
                        <div className="font-medium text-[#ede8df]">{campaign.name}</div>
                        <div className="text-xs text-[#b2a491]">
                          {formatDate(campaign.start_date)}
                          {campaign.end_date && ` — ${formatDate(campaign.end_date)}`}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1">
                          <span>{platformInfo?.icon}</span>
                          <span className="text-[#b2a491]">{platformInfo?.label}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${statusInfo?.color}`}>
                          {statusInfo?.label}
                        </span>
                      </td>
                      <td className="p-4 text-right text-[#ede8df]">
                        {formatCurrency(campaign.metrics.total_spend_cents)}
                      </td>
                      <td className="p-4 text-right text-[#b2a491]">
                        {formatNumber(campaign.metrics.total_impressions)}
                      </td>
                      <td className="p-4 text-right text-[#b2a491]">
                        {formatNumber(campaign.metrics.total_clicks)}
                      </td>
                      <td className="p-4 text-right text-emerald-400">
                        {formatNumber(campaign.metrics.total_conversions)}
                      </td>
                      <td className="p-4 text-right">
                        <span className={campaign.metrics.roas !== null && campaign.metrics.roas >= 1 ? 'text-emerald-400' : 'text-amber-400'}>
                          {campaign.metrics.roas !== null ? `${campaign.metrics.roas.toFixed(2)}x` : '—'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setMetricsForm({
                              date: new Date().toISOString().split('T')[0],
                              spend_cents: 0,
                              impressions: 0,
                              clicks: 0,
                              conversions: 0,
                              conversion_value_cents: 0,
                            });
                            setIsMetricsModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          + Metrics
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1c1a19] rounded-2xl border border-[#502d26]/30 w-full max-w-md mx-4">
            <div className="p-6 border-b border-[#502d26]/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#ede8df]">New Ad Campaign</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#b2a491] hover:text-[#ede8df] text-2xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Platform *</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as AdPlatform })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                >
                  {PLATFORMS.map(({ value, label, icon }) => (
                    <option key={value} value={value}>{icon} {label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Campaign Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                  required
                  placeholder="e.g., New Album Launch - January"
                />
              </div>
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Objective</label>
                <select
                  value={formData.objective || ''}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                >
                  <option value="">Select objective...</option>
                  <option value="awareness">Awareness</option>
                  <option value="traffic">Traffic</option>
                  <option value="engagement">Engagement</option>
                  <option value="leads">Leads</option>
                  <option value="conversions">Conversions</option>
                  <option value="sales">Sales</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#b2a491] mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#b2a491] mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Budget (CAD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.budget_cents ? (formData.budget_cents / 100).toFixed(2) : ''}
                  onChange={(e) => setFormData({ ...formData, budget_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                  placeholder="Optional"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#502d26]/30">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-[#b2a491]">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white">Create Campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Metrics Modal */}
      {isMetricsModalOpen && selectedCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1c1a19] rounded-2xl border border-[#502d26]/30 w-full max-w-md mx-4">
            <div className="p-6 border-b border-[#502d26]/30 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-[#ede8df]">Add Daily Metrics</h3>
                <p className="text-sm text-[#b2a491]">{selectedCampaign.name}</p>
              </div>
              <button onClick={() => setIsMetricsModalOpen(false)} className="text-[#b2a491] hover:text-[#ede8df] text-2xl">×</button>
            </div>
            <form onSubmit={handleMetricsSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Date *</label>
                <input
                  type="date"
                  value={metricsForm.date}
                  onChange={(e) => setMetricsForm({ ...metricsForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Spend (CAD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={(metricsForm.spend_cents / 100).toFixed(2)}
                  onChange={(e) => setMetricsForm({ ...metricsForm, spend_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#b2a491] mb-1">Impressions</label>
                  <input
                    type="number"
                    min="0"
                    value={metricsForm.impressions || ''}
                    onChange={(e) => setMetricsForm({ ...metricsForm, impressions: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#b2a491] mb-1">Clicks</label>
                  <input
                    type="number"
                    min="0"
                    value={metricsForm.clicks || ''}
                    onChange={(e) => setMetricsForm({ ...metricsForm, clicks: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#b2a491] mb-1">Conversions</label>
                  <input
                    type="number"
                    min="0"
                    value={metricsForm.conversions || ''}
                    onChange={(e) => setMetricsForm({ ...metricsForm, conversions: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#b2a491] mb-1">Conv. Value (CAD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(metricsForm.conversion_value_cents / 100).toFixed(2)}
                    onChange={(e) => setMetricsForm({ ...metricsForm, conversion_value_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#502d26]/30">
                <button type="button" onClick={() => setIsMetricsModalOpen(false)} className="px-4 py-2 text-sm text-[#b2a491]">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white">Save Metrics</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
