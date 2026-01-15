'use client';

import { useState, useEffect } from 'react';

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sent';
  recipients: number;
  sent?: number;
  opened?: number;
  clicked?: number;
  scheduledDate?: string;
  sentDate?: string;
}

export default function EmailMarketingTab() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'campaigns' | 'templates' | 'subscribers'>('campaigns');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/email-campaigns');
      if (res.ok) {
        const data = await res.json() as { campaigns?: EmailCampaign[] };
        setCampaigns(data.campaigns || []);
      }
    } catch (e) {
      console.error('Failed to fetch email campaigns', e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: EmailCampaign['status']) => {
    switch (status) {
      case 'sent': return 'bg-emerald-500/10 text-emerald-500';
      case 'scheduled': return 'bg-[#b2a491]/10 text-[#ede8df]';
      case 'draft': return 'bg-[#726d6c]/10 text-[#b2a491]';
    }
  };

  const calculateOpenRate = (campaign: EmailCampaign) => {
    if (!campaign.sent || !campaign.opened) return 0;
    return ((campaign.opened / campaign.sent) * 100).toFixed(1);
  };

  const calculateClickRate = (campaign: EmailCampaign) => {
    if (!campaign.sent || !campaign.clicked) return 0;
    return ((campaign.clicked / campaign.sent) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-[#b2a491]">Loading email campaigns...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#ede8df]">Email Marketing</h2>
          <p className="text-sm text-[#b2a491] mt-1">Create and manage email campaigns</p>
        </div>
        <button className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors">
          + New Campaign
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', value: campaigns.length, color: '#3b82f6' },
          { label: 'Emails Sent', value: campaigns.reduce((sum, c) => sum + (c.sent || 0), 0).toLocaleString(), color: '#10b981' },
          { label: 'Avg Open Rate', value: campaigns.filter(c => c.sent).length > 0 ? (campaigns.reduce((sum, c) => sum + Number(calculateOpenRate(c)), 0) / campaigns.filter(c => c.sent).length).toFixed(1) + '%' : '0%', color: '#8b5cf6' },
          { label: 'Avg Click Rate', value: campaigns.filter(c => c.sent).length > 0 ? (campaigns.reduce((sum, c) => sum + Number(calculateClickRate(c)), 0) / campaigns.filter(c => c.sent).length).toFixed(1) + '%' : '0%', color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#302927] rounded-xl p-4">
            <div className="text-sm text-[#b2a491]">{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-[#502d26]">
        {(['campaigns', 'templates', 'subscribers'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeView === view
                ? 'text-[#ede8df] border-b-2 border-[#843c2d]'
                : 'text-[#b2a491] hover:text-[#ede8df]'
            }`}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaigns View */}
      {activeView === 'campaigns' && (
        <>
          {campaigns.length === 0 ? (
            <div className="bg-[#302927] rounded-xl p-12 text-center">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="text-lg font-semibold text-[#ede8df] mb-2">No email campaigns yet</h3>
              <p className="text-[#b2a491] mb-4">Create your first email campaign to engage with your audience</p>
              <button className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors">
                + Create Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <div key={campaign.id} className="bg-[#302927] rounded-xl p-4 hover:bg-[#403633] transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div>
                          <h3 className="text-lg font-semibold text-[#ede8df]">{campaign.name}</h3>
                          <p className="text-sm text-[#b2a491]">{campaign.subject}</p>
                        </div>
                      </div>

                      {/* Campaign Stats */}
                      <div className="flex gap-6 mt-3">
                        <div>
                          <div className="text-xs text-[#b2a491]">Recipients</div>
                          <div className="text-sm font-semibold text-[#ede8df]">{campaign.recipients.toLocaleString()}</div>
                        </div>
                        {campaign.sent !== undefined && (
                          <>
                            <div>
                              <div className="text-xs text-[#b2a491]">Sent</div>
                              <div className="text-sm font-semibold text-[#ede8df]">{campaign.sent.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-[#b2a491]">Open Rate</div>
                              <div className="text-sm font-semibold text-green-500">{calculateOpenRate(campaign)}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-[#b2a491]">Click Rate</div>
                              <div className="text-sm font-semibold text-[#843c2d]">{calculateClickRate(campaign)}%</div>
                            </div>
                          </>
                        )}
                        {campaign.scheduledDate && (
                          <div>
                            <div className="text-xs text-[#b2a491]">Scheduled</div>
                            <div className="text-sm font-semibold text-[#ede8df]">
                              {new Date(campaign.scheduledDate).toLocaleString()}
                            </div>
                          </div>
                        )}
                        {campaign.sentDate && (
                          <div>
                            <div className="text-xs text-[#b2a491]">Sent</div>
                            <div className="text-sm font-semibold text-[#ede8df]">
                              {new Date(campaign.sentDate).toLocaleString()}
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
                        {campaign.status === 'draft' ? 'Edit' : 'View'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Templates View */}
      {activeView === 'templates' && (
        <div className="bg-[#302927] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-[#ede8df] mb-2">Email Templates</h3>
          <p className="text-[#b2a491]">Create reusable email templates for your campaigns</p>
        </div>
      )}

      {/* Subscribers View */}
      {activeView === 'subscribers' && (
        <div className="bg-[#302927] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-[#ede8df] mb-2">Email Subscribers</h3>
          <p className="text-[#b2a491]">Manage your email subscriber list and segments</p>
        </div>
      )}
    </div>
  );
}
