'use client';

import { useState, useEffect } from 'react';
import MetricCard from './widgets/MetricCard';

interface OverviewMetrics {
  streams: {
    total: number;
    change: number;
    trend: 'up' | 'down' | 'neutral';
  };
  revenue: {
    total: number;
    change: number;
    trend: 'up' | 'down' | 'neutral';
  };
  clipViews: {
    total: number;
    change: number;
    trend: 'up' | 'down' | 'neutral';
  };
  fans: {
    total: number;
    change: number;
    trend: 'up' | 'down' | 'neutral';
  };
}

interface PlatformConnection {
  platform: string;
  accountName: string;
  status: 'active' | 'error' | 'expired' | 'disconnected';
  lastSync: string | null;
}

interface RecentInsight {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

interface DashboardData {
  metrics: OverviewMetrics;
  connections: PlatformConnection[];
  recentInsights: RecentInsight[];
  lastUpdated: string;
}

export default function IntelDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/intel/overview?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const result: DashboardData = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Set mock data for now since API doesn't exist yet
      setData({
        metrics: {
          streams: { total: 0, change: 0, trend: 'neutral' },
          revenue: { total: 0, change: 0, trend: 'neutral' },
          clipViews: { total: 0, change: 0, trend: 'neutral' },
          fans: { total: 0, change: 0, trend: 'neutral' },
        },
        connections: [],
        recentInsights: [],
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Intelligence Dashboard</h1>
          <p className="text-white/60 text-sm mt-1">
            Cross-platform analytics and insights
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
          {/* Refresh Button */}
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Streams"
          value={formatNumber(data?.metrics.streams.total || 0)}
          change={data?.metrics.streams.change || 0}
          trend={data?.metrics.streams.trend || 'neutral'}
          icon="streams"
          loading={loading}
        />
        <MetricCard
          title="Revenue"
          value={formatCurrency(data?.metrics.revenue.total || 0)}
          change={data?.metrics.revenue.change || 0}
          trend={data?.metrics.revenue.trend || 'neutral'}
          icon="revenue"
          loading={loading}
        />
        <MetricCard
          title="Clip Views"
          value={formatNumber(data?.metrics.clipViews.total || 0)}
          change={data?.metrics.clipViews.change || 0}
          trend={data?.metrics.clipViews.trend || 'neutral'}
          icon="clips"
          loading={loading}
        />
        <MetricCard
          title="Fans"
          value={formatNumber(data?.metrics.fans.total || 0)}
          change={data?.metrics.fans.change || 0}
          trend={data?.metrics.fans.trend || 'neutral'}
          icon="fans"
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform Connections */}
        <div className="lg:col-span-1 bg-white/5 rounded-xl p-5">
          <h2 className="text-lg font-medium mb-4">Connected Platforms</h2>
          {data?.connections.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <p className="text-white/60 text-sm mb-4">No platforms connected yet</p>
              <button className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors">
                Connect Platform
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.connections.map((conn, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      conn.status === 'active' ? 'bg-green-400' :
                      conn.status === 'error' ? 'bg-red-400' :
                      conn.status === 'expired' ? 'bg-yellow-400' : 'bg-gray-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium capitalize">{conn.platform.replace('_', ' ')}</p>
                      <p className="text-xs text-white/40">{conn.accountName}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    conn.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    conn.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    conn.status === 'expired' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {conn.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Insights */}
        <div className="lg:col-span-2 bg-white/5 rounded-xl p-5">
          <h2 className="text-lg font-medium mb-4">Recent Insights</h2>
          {data?.recentInsights.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
              </div>
              <p className="text-white/60 text-sm mb-2">No insights yet</p>
              <p className="text-white/40 text-xs max-w-sm mx-auto">
                Connect platforms and import data to start seeing cross-domain insights and correlations.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.recentInsights.map((insight) => (
                <div key={insight.id} className="p-4 bg-white/5 rounded-lg border-l-2 border-l-green-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-xs text-white/60 mt-1">{insight.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ml-3 ${
                      insight.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      insight.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {insight.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white/5 rounded-xl p-5">
        <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionCard
            title="Import Streaming Data"
            description="Upload CSV from your distributor"
            icon="upload"
            href="/admin?tab=dist-import"
          />
          <QuickActionCard
            title="Connect Platform"
            description="Link Spotify, YouTube, or Instagram"
            icon="connect"
            href="/admin?tab=intel-connections"
          />
          <QuickActionCard
            title="View Fan Profiles"
            description="Explore your audience"
            icon="fans"
            href="/admin?tab=intel-fans"
          />
          <QuickActionCard
            title="Generate Report"
            description="Export analytics data"
            icon="report"
            href="/admin?tab=analytics-reports"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between text-xs text-white/40">
        <span>
          Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '—'}
        </span>
        <span>
          Intelligence Dashboard v1.0
        </span>
      </div>
    </div>
  );
}

// Quick Action Card Component
function QuickActionCard({
  title,
  description,
  icon,
  href,
}: {
  title: string;
  description: string;
  icon: 'upload' | 'connect' | 'fans' | 'report';
  href: string;
}) {
  const icons = {
    upload: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    connect: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    fans: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    report: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  };

  return (
    <a
      href={href}
      className="p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group"
    >
      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-white/20 transition-colors">
        {icons[icon]}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-white/40 mt-1">{description}</p>
    </a>
  );
}
