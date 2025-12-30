
"use client";

import { useEffect, useState } from "react";

// Define types for the data
interface Metric {
  label: string;
  value: string;
  trend: string;
  icon: string;
  sublabel?: string;
}

interface TopContent {
  id: number;
  title: string;
  type: string;
  views: string;
  icon: string;
  completionRate?: string;
}

interface FunnelData {
  period: { days: number };
  eventCounts: Array<{ event_type: string; count: number; unique_sessions: number }>;
  funnel: {
    clip_views?: number;
    shop_clicks?: number;
    product_views?: number;
    add_to_carts?: number;
    checkouts?: number;
    purchases?: number;
    revenue_cents?: number;
  };
  topSources: Array<{ source: string; count: number; sessions: number }>;
  dailyTrend: Array<{ date: string; events: number; sessions: number }>;
}

interface ClipWithEngagement {
  id: number;
  title: string;
  view_count: number;
  completion_count: number;
  share_count: number;
  shop_click_count: number;
  engagement_score: number;
}

// Format large numbers
function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// Calculate trend between two values
function calculateTrend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}%`;
}

// Fetch real metrics from API
const fetchMetrics = async (): Promise<{ metrics: Metric[]; funnel: FunnelData | null }> => {
  try {
    // Fetch today's data and yesterday's for comparison
    const [todayRes, yesterdayRes] = await Promise.all([
      fetch('/api/analytics/funnel?days=1'),
      fetch('/api/analytics/funnel?days=2')
    ]);

    if (!todayRes.ok) throw new Error('Failed to fetch analytics');

    const today = await todayRes.json() as FunnelData;
    const yesterday: FunnelData | null = yesterdayRes.ok ? await yesterdayRes.json() as FunnelData : null;

    // Extract counts from event data
    const getCount = (data: FunnelData | null, eventType: string): number => {
      if (!data?.eventCounts) return 0;
      const event = data.eventCounts.find(e => e.event_type === eventType);
      return event?.count || 0;
    };

    const todayViews = today.funnel?.clip_views || getCount(today, 'clip_view');
    const todayShopClicks = today.funnel?.shop_clicks || getCount(today, 'shop_click');
    const todayShares = getCount(today, 'clip_share');
    const todayCompletions = getCount(today, 'clip_complete');

    // Yesterday's counts for trend (rough estimate - subtract today from 2-day total)
    const twoDay = yesterday;
    const yesterdayViews = twoDay ? (twoDay.funnel?.clip_views || 0) - todayViews : 0;
    const yesterdayShopClicks = twoDay ? (twoDay.funnel?.shop_clicks || 0) - todayShopClicks : 0;
    const yesterdayShares = getCount(twoDay, 'clip_share') - todayShares;
    const yesterdayCompletions = getCount(twoDay, 'clip_complete') - todayCompletions;

    return {
      metrics: [
        {
          label: 'Views Today',
          value: formatNumber(todayViews),
          trend: calculateTrend(todayViews, Math.max(0, yesterdayViews)),
          icon: '👁️'
        },
        {
          label: 'Completions',
          value: formatNumber(todayCompletions),
          trend: calculateTrend(todayCompletions, Math.max(0, yesterdayCompletions)),
          icon: '✅',
          sublabel: todayViews > 0 ? `${((todayCompletions / todayViews) * 100).toFixed(0)}% rate` : undefined
        },
        {
          label: 'Shop Clicks',
          value: formatNumber(todayShopClicks),
          trend: calculateTrend(todayShopClicks, Math.max(0, yesterdayShopClicks)),
          icon: '🛍️'
        },
        {
          label: 'Shares',
          value: formatNumber(todayShares),
          trend: calculateTrend(todayShares, Math.max(0, yesterdayShares)),
          icon: '📤'
        }
      ],
      funnel: today
    };
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    return {
      metrics: [
        { label: 'Views Today', value: '--', trend: '--', icon: '👁️' },
        { label: 'Completions', value: '--', trend: '--', icon: '✅' },
        { label: 'Shop Clicks', value: '--', trend: '--', icon: '🛍️' },
        { label: 'Shares', value: '--', trend: '--', icon: '📤' }
      ],
      funnel: null
    };
  }
};

// Fetch top performing clips with engagement data
const fetchTopContent = async (): Promise<TopContent[]> => {
  try {
    const res = await fetch('/api/clips?withEngagement=true&limit=5');
    if (!res.ok) throw new Error('Failed to fetch clips');

    const data = await res.json() as { clips?: ClipWithEngagement[] };
    const clips: ClipWithEngagement[] = data.clips || [];

    return clips.map(clip => ({
      id: clip.id,
      title: clip.title || 'Untitled Clip',
      type: 'Clip',
      views: formatNumber(clip.view_count || 0),
      icon: '🎬',
      completionRate: clip.view_count > 0
        ? `${((clip.completion_count / clip.view_count) * 100).toFixed(0)}%`
        : '0%'
    }));
  } catch (error) {
    console.error('Failed to fetch top content:', error);
    return [];
  }
};

interface AnalyticsTabProps {
  view?: string;
}

export default function AnalyticsContent({ view = 'analytics-overview' }: AnalyticsTabProps) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [topContent, setTopContent] = useState<TopContent[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchMetrics(),
      fetchTopContent()
    ]).then(([metricsResult, content]) => {
      setMetrics(metricsResult.metrics);
      setFunnelData(metricsResult.funnel);
      setTopContent(content);
      setIsLoading(false);
    });
  }, []);

  const renderContent = () => {
    switch (view) {
      case 'analytics-sales':
        return <PlaceholderAnalytics title="Sales Analytics" icon="💰" />;
      case 'analytics-finance':
        return <PlaceholderAnalytics title="Financial Analytics" icon="💳" />;
      case 'analytics-music':
        return <PlaceholderAnalytics title="Music Analytics" icon="🎵" />;
      case 'analytics-video':
        return <PlaceholderAnalytics title="Video Analytics" icon="📹" />;
      case 'analytics-moments':
        return <PlaceholderAnalytics title="Moments Analytics" icon="📸" />;
      case 'analytics-gallery':
        return <PlaceholderAnalytics title="Gallery Analytics" icon="🖼️" />;
      case 'analytics-users':
        return <PlaceholderAnalytics title="User Analytics" icon="👤" />;
      case 'analytics-customers':
        return <PlaceholderAnalytics title="Customer Analytics" icon="👥" />;
      case 'analytics-reports':
        return <PlaceholderAnalytics title="Reports" icon="📄" />;
      case 'analytics-overview':
      default:
        return (
          <>
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ede8df]"></div>
              </div>
            )}

            {!isLoading && (
              <>
                {/* Daily Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg sm:text-xl">{metric.icon}</span>
                        <span className={`text-[10px] sm:text-xs ${
                          metric.trend.startsWith('+') ? 'text-green-400' :
                          metric.trend.startsWith('-') ? 'text-red-400' : 'text-[#b2a491]'
                        }`}>{metric.trend}</span>
                      </div>
                      <div className="text-lg sm:text-xl font-bold text-[#ede8df]">{metric.value}</div>
                      <div className="text-xs sm:text-sm text-[#b2a491]">{metric.label}</div>
                      {metric.sublabel && (
                        <div className="text-[10px] text-[#b2a491]/70 mt-1">{metric.sublabel}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Conversion Funnel */}
                {funnelData?.funnel && (
                  <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                    <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-4">Conversion Funnel</h3>
                    <div className="space-y-3">
                      <FunnelBar label="Clip Views" value={funnelData.funnel.clip_views || 0} max={funnelData.funnel.clip_views || 1} />
                      <FunnelBar label="Shop Clicks" value={funnelData.funnel.shop_clicks || 0} max={funnelData.funnel.clip_views || 1} />
                      <FunnelBar label="Product Views" value={funnelData.funnel.product_views || 0} max={funnelData.funnel.clip_views || 1} />
                      <FunnelBar label="Add to Cart" value={funnelData.funnel.add_to_carts || 0} max={funnelData.funnel.clip_views || 1} />
                      <FunnelBar label="Purchases" value={funnelData.funnel.purchases || 0} max={funnelData.funnel.clip_views || 1} />
                    </div>
                    {(funnelData.funnel.revenue_cents || 0) > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#502d26]/40">
                        <div className="flex justify-between items-center">
                          <span className="text-[#b2a491] text-sm">Revenue</span>
                          <span className="text-[#ede8df] text-lg font-bold">
                            ${((funnelData.funnel.revenue_cents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Top Sources */}
                {funnelData?.topSources && funnelData.topSources.length > 0 && (
                  <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                    <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-3 sm:mb-4">Top Traffic Sources</h3>
                    <div className="space-y-2">
                      {funnelData.topSources.slice(0, 5).map((source, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-[#171616]/50 rounded-lg">
                          <span className="text-[#ede8df] text-sm capitalize">{source.source || 'Direct'}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[#b2a491] text-xs">{source.sessions} sessions</span>
                            <span className="text-[#ede8df] text-sm font-medium">{formatNumber(source.count)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Content */}
                <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                  <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-3 sm:mb-4">Top Performing Clips</h3>
                  {topContent.length === 0 ? (
                    <div className="text-center py-8 text-[#b2a491]">
                      <p>No clip data yet</p>
                      <p className="text-sm mt-1">Engagement will appear as clips get views</p>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {topContent.map((item, index) => (
                        <div key={item.id || index} className="flex items-center justify-between p-2 sm:p-3 bg-[#171616]/50 rounded-lg sm:rounded-xl">
                          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                            <span className="text-sm text-[#b2a491] w-5">#{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[#ede8df] text-xs sm:text-sm font-medium truncate">{item.title}</div>
                              <div className="text-[#b2a491] text-[10px] sm:text-xs">
                                {item.completionRate} completion rate
                              </div>
                            </div>
                          </div>
                          <div className="text-[#ede8df] text-xs sm:text-sm font-medium flex-shrink-0">
                            {item.views} views
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Empty State */}
                {metrics.every(m => m.value === '0' || m.value === '--') && topContent.length === 0 && (
                  <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-4">📊</div>
                    <h3 className="text-lg font-medium text-[#ede8df] mb-2">No Analytics Data Yet</h3>
                    <p className="text-[#b2a491] text-sm">
                      Data will appear here as users view and interact with your clips.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#ede8df]">
          {view === 'analytics-overview' ? 'Web Analytics' : view.replace('analytics-', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </h2>
        <div className="text-sm text-[#b2a491]">Last 30 Days</div>
      </div>
      {renderContent()}
    </div>
  );
}

function PlaceholderAnalytics({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 bg-[#302927]/20 border border-[#502d26]/40 rounded-xl border-dashed">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-medium text-[#ede8df]">{title}</h3>
      <p className="text-[#b2a491] mt-2">Detailed analytics coming soon</p>
    </div>
  );
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const conversionRate = max > 0 && value !== max ? `${((value / max) * 100).toFixed(1)}%` : null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-[#b2a491]">{label}</span>
        <div className="flex items-center gap-2">
          {conversionRate && (
            <span className="text-[10px] text-[#b2a491]/70">{conversionRate}</span>
          )}
          <span className="text-[#ede8df] font-medium">{formatNumber(value)}</span>
        </div>
      </div>
      <div className="h-2 bg-[#171616]/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#843c2d] to-[#a85540] rounded-full transition-all duration-500"
          style={{ width: `${Math.max(percentage, value > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}
