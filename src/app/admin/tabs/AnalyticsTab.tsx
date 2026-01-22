'use client';

import { useEffect, useState, useCallback } from 'react';
import { AreaChart, BarChart, PieChart, MetricCard, FunnelChart } from '@/components/hub/charts';

// ============================================
// Types
// ============================================

interface DashboardData {
  summary: {
    visitors: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  comparison: {
    visitorsChange: number;
    sessionsChange: number;
    pageViewsChange: number;
  } | null;
  dailyTrend: Array<{
    date: string;
    visitors: number;
    sessions: number;
    pageViews: number;
    clipViews: number;
    shopClicks: number;
  }>;
  trafficSources: Array<{
    source: string;
    sessions: number;
    percentage: number;
  }>;
  topPages: Array<{
    path: string;
    views: number;
    avgTime: number;
  }>;
  funnel: {
    clipViews: number;
    clipCompletions: number;
    shopClicks: number;
    productViews: number;
    addToCarts: number;
    checkoutStarts: number;
    purchases: number;
    revenue: number;
  };
  modals: {
    store: { opens: number; avgDurationSeconds: number; bounceRate: number };
    moments: { opens: number; avgDurationSeconds: number; bounceRate: number };
    media: { opens: number; avgDurationSeconds: number; bounceRate: number };
  };
  topClips: Array<{
    id: number;
    title: string;
    views: number;
    completions: number;
    shopClicks: number;
  }>;
  topProducts: Array<{
    handle: string;
    views: number;
    addToCarts: number;
    purchases: number;
  }>;
}

interface InsightsData {
  insights: string[];
  recommendations: string[];
  generatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

// ============================================
// Main Component
// ============================================

interface AnalyticsTabProps {
  view?: string;
}

export default function AnalyticsTab({ view = 'analytics-overview' }: AnalyticsTabProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [period, setPeriod] = useState<7 | 30 | 90>(7);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/analytics/dashboard?days=${period}&compare=true`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json() as DashboardData;
      setDashboardData(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
      console.error('Analytics fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  // Fetch AI insights
  const fetchInsights = useCallback(async () => {
    if (!dashboardData) return;

    setIsLoadingInsights(true);
    try {
      const res = await fetch('/api/analytics/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: `${period} days`,
          metrics: {
            visitors: dashboardData.summary.visitors,
            sessions: dashboardData.summary.sessions,
            pageViews: dashboardData.summary.pageViews,
            clipViews: dashboardData.funnel.clipViews,
            shopClicks: dashboardData.funnel.shopClicks,
            addToCarts: dashboardData.funnel.addToCarts,
            purchases: dashboardData.funnel.purchases,
            revenue: dashboardData.funnel.revenue,
            comparison: dashboardData.comparison,
            topClips: dashboardData.topClips,
            topProducts: dashboardData.topProducts,
            trafficSources: dashboardData.trafficSources,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json() as InsightsData;
        setInsightsData(data);
      }
    } catch (err) {
      console.error('Insights fetch error:', err);
    } finally {
      setIsLoadingInsights(false);
    }
  }, [dashboardData, period]);

  // Fetch on mount and period change
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Handle export
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    const url = `/api/analytics/export?format=${format}&days=${period}&type=summary`;

    if (format === 'json') {
      // Open in new tab for JSON
      window.open(url, '_blank');
    } else {
      // Download CSV
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    }
  }, [period]);

  // Handle generate report
  const handleGenerateReport = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: period === 7 ? 'weekly' : period === 30 ? 'monthly' : 'quarterly' }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Report generated! ID: ${data.reportId}`);
      }
    } catch (err) {
      console.error('Report generation error:', err);
    }
  }, [period]);

  // Render based on view
  if (view !== 'analytics-overview') {
    return <PlaceholderAnalytics view={view} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ede8df]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-red-400 text-lg mb-2">Error loading analytics</div>
        <p className="text-[#b2a491] text-sm">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-[#843c2d] text-white rounded-lg hover:bg-[#a85540] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { summary, comparison, dailyTrend, trafficSources, funnel, modals, topClips, topProducts } = dashboardData;

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-[#ede8df]">Web Analytics</h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden border border-[#502d26]/40">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days as 7 | 30 | 90)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === days
                    ? 'bg-[#843c2d] text-white'
                    : 'bg-[#302927]/60 text-[#b2a491] hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#302927]/60 border border-[#502d26]/40 text-[#b2a491] hover:text-white rounded-lg transition-colors">
              Export
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute right-0 mt-1 w-32 bg-[#1a1817] border border-[#502d26]/40 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExport('csv')}
                className="w-full px-3 py-2 text-left text-xs text-[#b2a491] hover:text-white hover:bg-white/5"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-3 py-2 text-left text-xs text-[#b2a491] hover:text-white hover:bg-white/5"
              >
                Export JSON
              </button>
            </div>
          </div>

          {/* Generate report */}
          <button
            onClick={handleGenerateReport}
            className="px-3 py-1.5 text-xs font-medium bg-[#843c2d] text-white rounded-lg hover:bg-[#a85540] transition-colors"
          >
            Report
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Visitors"
          value={summary.visitors}
          change={comparison?.visitorsChange}
          icon={<span>👤</span>}
        />
        <MetricCard
          label="Sessions"
          value={summary.sessions}
          change={comparison?.sessionsChange}
          icon={<span>📊</span>}
        />
        <MetricCard
          label="Clip Views"
          value={funnel.clipViews}
          icon={<span>🎬</span>}
          sublabel={funnel.clipCompletions > 0 ? `${((funnel.clipCompletions / funnel.clipViews) * 100).toFixed(0)}% completion` : undefined}
        />
        <MetricCard
          label="Revenue"
          value={funnel.revenue}
          format="currency"
          icon={<span>💰</span>}
          sublabel={`${funnel.purchases} orders`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Traffic Trend */}
        <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-4">Traffic & Engagement</h3>
          <AreaChart
            data={dailyTrend}
            lines={[
              { key: 'visitors', name: 'Visitors', color: '#843c2d' },
              { key: 'clipViews', name: 'Clip Views', color: '#a85540' },
              { key: 'shopClicks', name: 'Shop Clicks', color: '#c17055' },
            ]}
            height={220}
          />
        </div>

        {/* Conversion Funnel */}
        <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-4">Conversion Funnel</h3>
          <FunnelChart
            steps={[
              { label: 'Clip Views', value: funnel.clipViews },
              { label: 'Shop Clicks', value: funnel.shopClicks },
              { label: 'Product Views', value: funnel.productViews },
              { label: 'Add to Cart', value: funnel.addToCarts },
              { label: 'Purchases', value: funnel.purchases },
            ]}
          />
        </div>
      </div>

      {/* Modal Engagement & Traffic Sources Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Modal Engagement */}
        <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-4">Modal Engagement</h3>
          <div className="space-y-3">
            {(['store', 'moments', 'media'] as const).map((modalType) => {
              const modal = modals[modalType];
              return (
                <div
                  key={modalType}
                  className="flex items-center justify-between p-3 bg-[#171616]/50 rounded-xl"
                >
                  <div>
                    <div className="text-[#ede8df] font-medium capitalize">{modalType}</div>
                    <div className="text-xs text-[#b2a491] mt-0.5">
                      {formatDuration(modal.avgDurationSeconds)} avg · {modal.bounceRate.toFixed(0)}% bounce
                    </div>
                  </div>
                  <div className="text-lg font-bold text-[#ede8df]">{formatNumber(modal.opens)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-4">Traffic Sources</h3>
          {trafficSources.length > 0 ? (
            <PieChart
              data={trafficSources.slice(0, 6).map((s) => ({
                name: s.source,
                value: s.sessions,
              }))}
              height={180}
              innerRadius={40}
              outerRadius={70}
            />
          ) : (
            <div className="text-center py-8 text-[#b2a491]">No traffic source data</div>
          )}
        </div>
      </div>

      {/* Top Performers Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top Clips */}
        <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-4">Top Performing Clips</h3>
          {topClips.length > 0 ? (
            <div className="space-y-2">
              {topClips.map((clip, idx) => (
                <div key={clip.id} className="flex items-center justify-between p-2 bg-[#171616]/50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm text-[#b2a491] w-5">#{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[#ede8df] text-sm font-medium truncate">{clip.title}</div>
                      <div className="text-[10px] text-[#b2a491]">
                        {clip.shopClicks > 0 && `${clip.shopClicks} shop clicks`}
                      </div>
                    </div>
                  </div>
                  <div className="text-[#ede8df] text-sm font-medium">{formatNumber(clip.views)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#b2a491]">No clip data yet</div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-4">Top Products</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-2">
              {topProducts.map((product, idx) => (
                <div key={product.handle} className="flex items-center justify-between p-2 bg-[#171616]/50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm text-[#b2a491] w-5">#{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[#ede8df] text-sm font-medium truncate">{product.handle}</div>
                      <div className="text-[10px] text-[#b2a491]">
                        {product.addToCarts} carts · {product.purchases} sales
                      </div>
                    </div>
                  </div>
                  <div className="text-[#ede8df] text-sm font-medium">{formatNumber(product.views)} views</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#b2a491]">No product data yet</div>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-[#ede8df] flex items-center gap-2">
            <span>💡</span> AI Insights
          </h3>
          <button
            onClick={fetchInsights}
            disabled={isLoadingInsights}
            className="text-xs text-[#b2a491] hover:text-white transition-colors disabled:opacity-50"
          >
            {isLoadingInsights ? 'Generating...' : 'Regenerate'}
          </button>
        </div>

        {insightsData ? (
          <div className="space-y-4">
            {/* Insights */}
            <div className="space-y-2">
              {insightsData.insights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-[#ede8df]">
                  <span className="text-[#843c2d]">•</span>
                  <span>{insight}</span>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {insightsData.recommendations.length > 0 && (
              <div className="pt-4 border-t border-[#502d26]/40">
                <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-2">Recommendations</div>
                <div className="space-y-2">
                  {insightsData.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-[#b2a491]">
                      <span className="text-[#a85540]">→</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-[#b2a491] text-sm mb-3">Get AI-powered insights about your analytics</p>
            <button
              onClick={fetchInsights}
              disabled={isLoadingInsights}
              className="px-4 py-2 bg-[#843c2d] text-white text-sm rounded-lg hover:bg-[#a85540] transition-colors disabled:opacity-50"
            >
              {isLoadingInsights ? 'Generating...' : 'Generate Insights'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Placeholder for other views
// ============================================

function PlaceholderAnalytics({ view }: { view: string }) {
  const viewNames: Record<string, { title: string; icon: string }> = {
    'analytics-sales': { title: 'Sales Analytics', icon: '💰' },
    'analytics-finance': { title: 'Financial Analytics', icon: '💳' },
    'analytics-music': { title: 'Music Analytics', icon: '🎵' },
    'analytics-video': { title: 'Video Analytics', icon: '📹' },
    'analytics-moments': { title: 'Moments Analytics', icon: '📸' },
    'analytics-gallery': { title: 'Gallery Analytics', icon: '🖼️' },
    'analytics-users': { title: 'User Analytics', icon: '👤' },
    'analytics-customers': { title: 'Customer Analytics', icon: '👥' },
    'analytics-reports': { title: 'Reports', icon: '📄' },
  };

  const { title, icon } = viewNames[view] || { title: 'Analytics', icon: '📊' };

  return (
    <div className="px-3 sm:px-6 py-6">
      <div className="flex flex-col items-center justify-center h-64 bg-[#302927]/20 border border-[#502d26]/40 rounded-xl border-dashed">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-xl font-medium text-[#ede8df]">{title}</h3>
        <p className="text-[#b2a491] mt-2">Detailed analytics coming soon</p>
      </div>
    </div>
  );
}
