'use client';

import { useState, useEffect } from 'react';

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'social' | 'ads' | 'content';
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  budget?: number;
  spent?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
}

export default function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | Campaign['status']>('all');
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/campaigns');
      if (res.ok) {
        const data = await res.json() as { campaigns?: Campaign[] };
        setCampaigns(data.campaigns || []);
      }
    } catch (e) {
      console.error('Failed to fetch campaigns', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(c => 
    activeFilter === 'all' || c.status === activeFilter
  );

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500';
      case 'paused': return 'bg-yellow-500/10 text-yellow-500';
      case 'completed': return 'bg-blue-500/10 text-blue-500';
      case 'draft': return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getTypeIcon = (type: Campaign['type']) => {
    switch (type) {
      case 'email': return '📧';
      case 'social': return '📱';
      case 'ads': return '🎯';
      case 'content': return '📝';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-[#b2a491]">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#ede8df]">Marketing Campaigns</h2>
          <p className="text-sm text-[#b2a491] mt-1">Manage and track your marketing campaigns</p>
        </div>
        <button
          onClick={() => setShowNewCampaignModal(true)}
          className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Campaigns', value: campaigns.filter(c => c.status === 'active').length, color: '#10b981' },
          { label: 'Total Impressions', value: campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0).toLocaleString(), color: '#3b82f6' },
          { label: 'Total Clicks', value: campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0).toLocaleString(), color: '#8b5cf6' },
          { label: 'Conversions', value: campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0).toLocaleString(), color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#302927] rounded-xl p-4">
            <div className="text-sm text-[#b2a491]">{stat.label}</div>
            <div className="text-2xl font-bold text-[#ede8df] mt-1" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'paused', 'draft', 'completed'] as const).map(filter => (
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

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-[#302927] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-[#ede8df] mb-2">No campaigns yet</h3>
          <p className="text-[#b2a491] mb-4">Create your first marketing campaign to get started</p>
          <button
            onClick={() => setShowNewCampaignModal(true)}
            className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors"
          >
            + Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map(campaign => (
            <div key={campaign.id} className="bg-[#302927] rounded-xl p-4 hover:bg-[#403633] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getTypeIcon(campaign.type)}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-[#ede8df]">{campaign.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#b2a491]">
                        <span>{new Date(campaign.startDate).toLocaleDateString()}</span>
                        {campaign.endDate && (
                          <>
                            <span>→</span>
                            <span>{new Date(campaign.endDate).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Campaign Stats */}
                  <div className="flex gap-6 mt-3">
                    {campaign.impressions !== undefined && (
                      <div>
                        <div className="text-xs text-[#b2a491]">Impressions</div>
                        <div className="text-sm font-semibold text-[#ede8df]">{campaign.impressions.toLocaleString()}</div>
                      </div>
                    )}
                    {campaign.clicks !== undefined && (
                      <div>
                        <div className="text-xs text-[#b2a491]">Clicks</div>
                        <div className="text-sm font-semibold text-[#ede8df]">{campaign.clicks.toLocaleString()}</div>
                      </div>
                    )}
                    {campaign.conversions !== undefined && (
                      <div>
                        <div className="text-xs text-[#b2a491]">Conversions</div>
                        <div className="text-sm font-semibold text-[#ede8df]">{campaign.conversions.toLocaleString()}</div>
                      </div>
                    )}
                    {campaign.budget !== undefined && (
                      <div>
                        <div className="text-xs text-[#b2a491]">Budget</div>
                        <div className="text-sm font-semibold text-[#ede8df]">
                          ${campaign.spent || 0} / ${campaign.budget}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                  <button className="px-3 py-1.5 text-sm text-[#ede8df] bg-[#403633] hover:bg-[#504440] rounded-lg transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Campaign Modal Placeholder */}
      {showNewCampaignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewCampaignModal(false)}>
          <div className="bg-[#302927] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[#ede8df] mb-4">Create New Campaign</h3>
            <p className="text-[#b2a491] mb-4">Campaign creation form will be implemented here</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewCampaignModal(false)}
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
