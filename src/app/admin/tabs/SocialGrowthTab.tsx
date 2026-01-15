'use client';

import { useState, useEffect } from 'react';
import type { SocialPlatform, SocialSnapshotInput } from '@/types/bi';

interface GrowthData {
  platform: SocialPlatform;
  currentFollowers: number;
  previousFollowers: number;
  growth: number;
  growthPercent: number;
  trend: 'up' | 'down' | 'neutral';
  latestDate: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

const PLATFORMS: { value: SocialPlatform; label: string; icon: string; color: string }[] = [
  { value: 'instagram', label: 'Instagram', icon: '📷', color: 'from-pink-500 to-purple-500' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵', color: 'from-cyan-400 to-pink-500' },
  { value: 'youtube', label: 'YouTube', icon: '▶️', color: 'from-red-500 to-red-600' },
  { value: 'twitter', label: 'Twitter/X', icon: '𝕏', color: 'from-slate-600 to-slate-800' },
  { value: 'spotify', label: 'Spotify', icon: '🎧', color: 'from-green-500 to-green-600' },
  { value: 'apple_music', label: 'Apple Music', icon: '🎵', color: 'from-pink-400 to-red-400' },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

export default function SocialGrowthTab() {
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [totals, setTotals] = useState({ followers: 0, growth: 0, growthPercent: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<SocialSnapshotInput>({
    platform: 'instagram',
    date: new Date().toISOString().split('T')[0],
    followers: 0,
  });

  const fetchData = async () => {
    try {
      const res = await fetch('/api/bi/social-growth');
      const data = await res.json();
      if (data.success) {
        setGrowthData(data.growth || []);
        setTotals(data.totals || { followers: 0, growth: 0, growthPercent: 0 });
      }
    } catch (e) {
      console.error('Failed to fetch social growth:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bi/social-growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (e) {
      console.error('Failed to save snapshot:', e);
    }
  };

  const getGrowthForPlatform = (platform: SocialPlatform): GrowthData | undefined => {
    return growthData.find((g) => g.platform === platform);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#ede8df]">Social Growth</h2>
        <button
          onClick={() => {
            setFormData({
              platform: 'instagram',
              date: new Date().toISOString().split('T')[0],
              followers: 0,
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors"
        >
          + Add Snapshot
        </button>
      </div>

      {/* Total Summary */}
      <div className="bg-gradient-to-br from-[#302927] to-[#1c1a19] rounded-xl border border-[#502d26]/30 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-sm text-[#b2a491] mb-1">Total Audience</div>
            <div className="text-4xl font-bold text-[#ede8df]">{formatNumber(totals.followers)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-[#b2a491] mb-1">Weekly Growth</div>
            <div className={`text-4xl font-bold ${totals.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totals.growth >= 0 ? '+' : ''}{formatNumber(totals.growth)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-[#b2a491] mb-1">Growth Rate</div>
            <div className={`text-4xl font-bold ${totals.growthPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totals.growthPercent >= 0 ? '+' : ''}{totals.growthPercent.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-[#b2a491] text-center py-12">Loading social metrics...</div>
      ) : (
        /* Platform Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORMS.map(({ value, label, icon, color }) => {
            const data = getGrowthForPlatform(value);

            return (
              <div
                key={value}
                className="bg-[#1c1a19] rounded-xl border border-[#502d26]/30 overflow-hidden group hover:border-[#502d26]/50 transition-colors"
              >
                {/* Header with gradient */}
                <div className={`bg-gradient-to-r ${color} p-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{icon}</span>
                      <span className="font-semibold text-white">{label}</span>
                    </div>
                    {data && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        data.trend === 'up'
                          ? 'bg-emerald-500/30 text-emerald-200'
                          : data.trend === 'down'
                          ? 'bg-red-500/30 text-red-200'
                          : 'bg-white/20 text-white'
                      }`}>
                        {data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→'}
                        {Math.abs(data.growthPercent).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {data ? (
                    <>
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <div className="text-3xl font-bold text-[#ede8df]">
                            {formatNumber(data.currentFollowers)}
                          </div>
                          <div className="text-xs text-[#b2a491]">followers</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${data.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {data.growth >= 0 ? '+' : ''}{formatNumber(data.growth)}
                          </div>
                          <div className="text-xs text-[#b2a491]">this week</div>
                        </div>
                      </div>

                      {/* Engagement */}
                      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-[#502d26]/20">
                        <div className="text-center">
                          <div className="text-sm font-medium text-[#ede8df]">{formatNumber(data.engagement.likes)}</div>
                          <div className="text-xs text-[#b2a491]">likes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-[#ede8df]">{formatNumber(data.engagement.comments)}</div>
                          <div className="text-xs text-[#b2a491]">comments</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-[#ede8df]">{formatNumber(data.engagement.shares)}</div>
                          <div className="text-xs text-[#b2a491]">shares</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-[#ede8df]">{formatNumber(data.engagement.views)}</div>
                          <div className="text-xs text-[#b2a491]">views</div>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-[#b2a491] text-right">
                        Updated {formatDate(data.latestDate)}
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center">
                      <div className="text-[#b2a491] mb-3">No data yet</div>
                      <button
                        onClick={() => {
                          setFormData({
                            platform: value,
                            date: new Date().toISOString().split('T')[0],
                            followers: 0,
                          });
                          setIsModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg transition-colors"
                      >
                        + Add First Snapshot
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Snapshot Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1c1a19] rounded-2xl border border-[#502d26]/30 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#502d26]/30 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#ede8df]">Add Social Snapshot</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#b2a491] hover:text-[#ede8df] text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Platform */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Platform *</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as SocialPlatform })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                >
                  {PLATFORMS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  required
                />
              </div>

              {/* Followers */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Followers *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.followers || ''}
                  onChange={(e) => setFormData({ ...formData, followers: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  required
                  placeholder="e.g., 15000"
                />
              </div>

              {/* Following */}
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Following</label>
                <input
                  type="number"
                  min="0"
                  value={formData.following || ''}
                  onChange={(e) => setFormData({ ...formData, following: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                  placeholder="Optional"
                />
              </div>

              <div className="border-t border-[#502d26]/30 pt-4 mt-4">
                <div className="text-sm text-[#b2a491] mb-3">Engagement (optional)</div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Likes</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.likes_count || ''}
                      onChange={(e) => setFormData({ ...formData, likes_count: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Comments</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.comments_count || ''}
                      onChange={(e) => setFormData({ ...formData, comments_count: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Shares</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.shares_count || ''}
                      onChange={(e) => setFormData({ ...formData, shares_count: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Views</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.views_count || ''}
                      onChange={(e) => setFormData({ ...formData, views_count: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-[#171616] border border-[#502d26]/30 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:border-[#843c2d]"
                    />
                  </div>
                </div>
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
                  Save Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
