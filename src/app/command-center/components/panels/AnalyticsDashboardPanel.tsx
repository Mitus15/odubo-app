'use client';

import { useState, useEffect, useCallback } from 'react';

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

interface AnalyticsData {
  period: { days: number };
  overview: {
    totalStreams: number;
    totalListeners: number;
    totalSaves: number;
    streamingRevenue: number;
  };
  clips: {
    totalViews: number;
    totalCompletions: number;
    totalShares: number;
    totalShopClicks: number;
    totalLikes: number;
    avgWatchTimeMinutes: number;
    completionRate: number | string;
  };
  funnel: {
    clipViews: number;
    shopClicks: number;
    productViews: number;
    addToCarts: number;
    checkouts: number;
    purchases: number;
    purchaseRevenue: number;
    uniqueSessions: number;
    conversionRates: {
      viewToShop: number;
      shopToCart: number;
      cartToPurchase: number;
      overallConversion: number;
    };
  };
  streamingTrend: Array<{
    date: string;
    streams: number;
    listeners: number;
    revenueCents: number;
  }>;
  topClips: Array<{
    clipId: number;
    title: string;
    artistName: string;
    thumbnailUrl: string;
    views: number;
    completions: number;
    shares: number;
    shopClicks: number;
    likes: number;
  }>;
  topTracks: Array<{
    id: string;
    title: string;
    artistName: string;
    streams: number;
    listeners: number;
    saves: number;
    revenue: number;
  }>;
  platformBreakdown: Array<{
    platform: string;
    streams: number;
    listeners: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    eventType: string;
    clipId: number;
    productHandle: string;
    valueCents: number;
    source: string;
    createdAt: string;
  }>;
}

const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: 365,
};

const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1DB954',
  apple_music: '#FA57C1',
  amazon_music: '#FF9900',
  youtube_music: '#FF0000',
  tidal: '#000000',
  deezer: '#FEAA2D',
  pandora: '#3668FF',
  soundcloud: '#FF5500',
};

const PLATFORM_NAMES: Record<string, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  amazon_music: 'Amazon Music',
  youtube_music: 'YouTube Music',
  tidal: 'Tidal',
  deezer: 'Deezer',
  pandora: 'Pandora',
  soundcloud: 'SoundCloud',
};

export function AnalyticsDashboardPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'clips' | 'streaming' | 'funnel'>(
    'overview'
  );

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const days = TIME_RANGE_DAYS[timeRange];
      const res = await fetch(`/api/command-center/analytics?days=${days}`);
      if (res.ok) {
        const json = (await res.json()) as AnalyticsData;
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs and time range */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {(['overview', 'clips', 'streaming', 'funnel'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-[#302927] text-[#ede8df]'
                    : 'text-[#726d6c] hover:text-[#ede8df]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Time range */}
          <div className="flex items-center gap-1 bg-[#0d0c0a] rounded-lg p-0.5">
            {(['7d', '30d', '90d', '1y', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  timeRange === range
                    ? 'bg-[#302927] text-[#ede8df]'
                    : 'text-[#726d6c] hover:text-[#ede8df]'
                }`}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="font-semibold mb-2">No analytics data</h3>
            <p className="text-sm text-[#726d6c]">Data will appear as your content gets views</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    icon="▶️"
                    label="Total Streams"
                    value={formatNumber(data.overview.totalStreams)}
                    subtitle="DSP plays"
                  />
                  <MetricCard
                    icon="👁️"
                    label="Clip Views"
                    value={formatNumber(data.clips.totalViews)}
                    subtitle={`${data.clips.completionRate}% completion`}
                  />
                  <MetricCard
                    icon="💰"
                    label="Streaming Revenue"
                    value={formatCurrency(data.overview.streamingRevenue)}
                    subtitle="From DSPs"
                  />
                  <MetricCard
                    icon="🛒"
                    label="Shop Revenue"
                    value={formatCurrency(data.funnel.purchaseRevenue)}
                    subtitle={`${data.funnel.purchases} orders`}
                  />
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                  <MiniStat label="Listeners" value={formatNumber(data.overview.totalListeners)} />
                  <MiniStat label="Saves" value={formatNumber(data.overview.totalSaves)} />
                  <MiniStat label="Shares" value={formatNumber(data.clips.totalShares)} />
                  <MiniStat label="Likes" value={formatNumber(data.clips.totalLikes)} />
                  <MiniStat label="Shop Clicks" value={formatNumber(data.clips.totalShopClicks)} />
                  <MiniStat label="Sessions" value={formatNumber(data.funnel.uniqueSessions)} />
                </div>

                {/* Streaming Trend Chart */}
                {data.streamingTrend.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                    <h4 className="text-sm font-medium mb-4">Streaming Trend</h4>
                    <SimpleBarChart
                      data={data.streamingTrend.map((d) => ({
                        label: new Date(d.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        }),
                        value: d.streams,
                      }))}
                    />
                  </div>
                )}

                {/* Platform Breakdown + Top Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Platform Breakdown */}
                  <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                    <h4 className="text-sm font-medium mb-4">Platform Breakdown</h4>
                    {data.platformBreakdown.length > 0 ? (
                      <div className="space-y-3">
                        {data.platformBreakdown.map((p) => (
                          <PlatformRow key={p.platform} platform={p} formatNumber={formatNumber} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#726d6c] text-center py-4">
                        No platform data yet
                      </p>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                    <h4 className="text-sm font-medium mb-4">Recent Activity</h4>
                    {data.recentActivity.length > 0 ? (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {data.recentActivity.map((event, i) => (
                          <ActivityItem key={i} event={event} formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#726d6c] text-center py-4">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Clips Tab */}
            {activeTab === 'clips' && (
              <div className="space-y-6">
                {/* Clip Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    icon="👁️"
                    label="Total Views"
                    value={formatNumber(data.clips.totalViews)}
                  />
                  <MetricCard
                    icon="✅"
                    label="Completions"
                    value={formatNumber(data.clips.totalCompletions)}
                    subtitle={`${data.clips.completionRate}% rate`}
                  />
                  <MetricCard
                    icon="🔗"
                    label="Shares"
                    value={formatNumber(data.clips.totalShares)}
                  />
                  <MetricCard
                    icon="🛍️"
                    label="Shop Clicks"
                    value={formatNumber(data.clips.totalShopClicks)}
                  />
                </div>

                {/* Top Clips */}
                <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                  <h4 className="text-sm font-medium mb-4">Top Performing Clips</h4>
                  {data.topClips.length > 0 ? (
                    <div className="space-y-3">
                      {data.topClips.map((clip, i) => (
                        <div
                          key={clip.clipId}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#171616] transition-colors"
                        >
                          <span className="text-xs text-[#726d6c] w-4">{i + 1}</span>
                          <div className="w-12 h-12 rounded-lg bg-[#171616] overflow-hidden flex-shrink-0">
                            {clip.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={clip.thumbnailUrl}
                                alt={clip.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">
                                🎬
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{clip.title || 'Untitled'}</p>
                            <p className="text-xs text-[#726d6c] truncate">{clip.artistName}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[#726d6c]">
                            <span title="Views">👁️ {formatNumber(clip.views)}</span>
                            <span title="Likes">❤️ {formatNumber(clip.likes)}</span>
                            <span title="Shop Clicks">🛍️ {formatNumber(clip.shopClicks)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#726d6c] text-center py-8">No clip data yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Streaming Tab */}
            {activeTab === 'streaming' && (
              <div className="space-y-6">
                {/* Streaming Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    icon="▶️"
                    label="Total Streams"
                    value={formatNumber(data.overview.totalStreams)}
                  />
                  <MetricCard
                    icon="👥"
                    label="Unique Listeners"
                    value={formatNumber(data.overview.totalListeners)}
                  />
                  <MetricCard
                    icon="💾"
                    label="Saves"
                    value={formatNumber(data.overview.totalSaves)}
                  />
                  <MetricCard
                    icon="💰"
                    label="Revenue"
                    value={formatCurrency(data.overview.streamingRevenue)}
                  />
                </div>

                {/* Top Tracks */}
                <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                  <h4 className="text-sm font-medium mb-4">Top Tracks</h4>
                  {data.topTracks.length > 0 ? (
                    <div className="space-y-3">
                      {data.topTracks.map((track, i) => (
                        <div
                          key={track.id || i}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#171616] transition-colors"
                        >
                          <span className="text-xs text-[#726d6c] w-4">{i + 1}</span>
                          <div className="w-10 h-10 rounded-lg bg-[#171616] flex items-center justify-center text-lg">
                            🎵
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{track.title || 'Unknown'}</p>
                            <p className="text-xs text-[#726d6c] truncate">{track.artistName}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[#726d6c]">
                            <span>▶️ {formatNumber(track.streams)}</span>
                            <span>👥 {formatNumber(track.listeners)}</span>
                            <span className="text-green-400">
                              {formatCurrency(track.revenue)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#726d6c] text-center py-8">
                      No streaming data yet. Connect your DSP accounts to see analytics.
                    </p>
                  )}
                </div>

                {/* Platform Breakdown */}
                <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                  <h4 className="text-sm font-medium mb-4">Streams by Platform</h4>
                  {data.platformBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {data.platformBreakdown.map((p) => (
                        <PlatformRow key={p.platform} platform={p} formatNumber={formatNumber} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#726d6c] text-center py-4">No platform data yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Funnel Tab */}
            {activeTab === 'funnel' && (
              <div className="space-y-6">
                {/* Conversion Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    icon="👁️"
                    label="Clip Views"
                    value={formatNumber(data.funnel.clipViews)}
                    subtitle="Top of funnel"
                  />
                  <MetricCard
                    icon="🛍️"
                    label="Shop Clicks"
                    value={formatNumber(data.funnel.shopClicks)}
                    subtitle={`${data.funnel.conversionRates.viewToShop.toFixed(1)}% of views`}
                  />
                  <MetricCard
                    icon="🛒"
                    label="Add to Cart"
                    value={formatNumber(data.funnel.addToCarts)}
                    subtitle={`${data.funnel.conversionRates.shopToCart.toFixed(1)}% of clicks`}
                  />
                  <MetricCard
                    icon="✅"
                    label="Purchases"
                    value={formatNumber(data.funnel.purchases)}
                    subtitle={formatCurrency(data.funnel.purchaseRevenue)}
                  />
                </div>

                {/* Conversion Funnel Visualization */}
                <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                  <h4 className="text-sm font-medium mb-4">Conversion Funnel</h4>
                  <ConversionFunnel
                    stages={[
                      { label: 'Clip Views', value: data.funnel.clipViews, color: '#726d6c' },
                      { label: 'Shop Clicks', value: data.funnel.shopClicks, color: '#843c2d' },
                      { label: 'Product Views', value: data.funnel.productViews, color: '#9a4a3a' },
                      { label: 'Add to Cart', value: data.funnel.addToCarts, color: '#b85c4c' },
                      { label: 'Checkout', value: data.funnel.checkouts, color: '#d66e5e' },
                      { label: 'Purchase', value: data.funnel.purchases, color: '#1DB954' },
                    ]}
                    formatNumber={formatNumber}
                  />
                </div>

                {/* Conversion Rates */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <RateCard
                    label="View → Shop"
                    rate={data.funnel.conversionRates.viewToShop}
                  />
                  <RateCard
                    label="Shop → Cart"
                    rate={data.funnel.conversionRates.shopToCart}
                  />
                  <RateCard
                    label="Cart → Purchase"
                    rate={data.funnel.conversionRates.cartToPurchase}
                  />
                  <RateCard
                    label="Overall"
                    rate={data.funnel.conversionRates.overallConversion}
                    highlight
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function MetricCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: string;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-[#726d6c]">{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
      {subtitle && <div className="text-xs text-[#726d6c] mt-1">{subtitle}</div>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-[#0d0c0a] border border-[#502d26]/20 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] text-[#726d6c]">{label}</div>
    </div>
  );
}

function RateCard({
  label,
  rate,
  highlight,
}: {
  label: string;
  rate: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        highlight
          ? 'bg-[#843c2d]/10 border-[#843c2d]/40'
          : 'bg-[#0d0c0a] border-[#502d26]/20'
      }`}
    >
      <div className="text-xs text-[#726d6c] mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${highlight ? 'text-[#843c2d]' : ''}`}>
        {rate.toFixed(1)}%
      </div>
    </div>
  );
}

function PlatformRow({
  platform,
  formatNumber,
}: {
  platform: { platform: string; streams: number; listeners: number; revenue: number };
  formatNumber: (n: number) => string;
}) {
  const totalStreams = platform.streams || 1;
  const maxWidth = 100;
  const barWidth = Math.min((platform.streams / totalStreams) * maxWidth, maxWidth);

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: PLATFORM_COLORS[platform.platform] || '#726d6c' }}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">
            {PLATFORM_NAMES[platform.platform] || platform.platform}
          </span>
          <span className="text-xs text-[#726d6c]">{formatNumber(platform.streams)} streams</span>
        </div>
        <div className="h-1.5 bg-[#171616] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${barWidth}%`,
              backgroundColor: PLATFORM_COLORS[platform.platform] || '#726d6c',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SimpleBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const visibleData = data.slice(-14); // Show last 14 data points

  return (
    <div className="flex items-end gap-1 h-32">
      {visibleData.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-[#843c2d] rounded-t transition-all hover:bg-[#9a4a3a]"
            style={{
              height: `${Math.max((d.value / maxValue) * 100, 2)}%`,
            }}
            title={`${d.label}: ${d.value.toLocaleString()}`}
          />
          {i % 2 === 0 && (
            <span className="text-[8px] text-[#726d6c] truncate w-full text-center">
              {d.label.split(' ')[1] || d.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ConversionFunnel({
  stages,
  formatNumber,
}: {
  stages: Array<{ label: string; value: number; color: string }>;
  formatNumber: (n: number) => string;
}) {
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const width = Math.max((stage.value / maxValue) * 100, 5);
        const prevValue = i > 0 ? stages[i - 1].value : stage.value;
        const dropRate = prevValue > 0 ? ((prevValue - stage.value) / prevValue) * 100 : 0;

        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="w-24 text-xs text-[#726d6c] text-right">{stage.label}</div>
            <div className="flex-1 h-8 bg-[#171616] rounded relative overflow-hidden">
              <div
                className="h-full rounded transition-all flex items-center justify-end pr-2"
                style={{
                  width: `${width}%`,
                  backgroundColor: stage.color,
                }}
              >
                <span className="text-xs font-medium text-white">
                  {formatNumber(stage.value)}
                </span>
              </div>
            </div>
            {i > 0 && dropRate > 0 && (
              <div className="w-16 text-xs text-red-400">-{dropRate.toFixed(0)}%</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActivityItem({
  event,
  formatCurrency,
}: {
  event: {
    eventType: string;
    clipId: number;
    productHandle: string;
    valueCents: number;
    source: string;
    createdAt: string;
  };
  formatCurrency: (amount: number) => string;
}) {
  const icons: Record<string, string> = {
    purchase: '✅',
    add_to_cart: '🛒',
    shop_click: '🛍️',
    checkout_start: '💳',
  };

  const labels: Record<string, string> = {
    purchase: 'Purchase',
    add_to_cart: 'Added to cart',
    shop_click: 'Shop click',
    checkout_start: 'Started checkout',
  };

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'just now';
  };

  return (
    <div className="flex items-center gap-2 py-1.5 text-xs">
      <span>{icons[event.eventType] || '📌'}</span>
      <span className="flex-1 truncate">
        {labels[event.eventType] || event.eventType}
        {event.productHandle && (
          <span className="text-[#726d6c]"> · {event.productHandle}</span>
        )}
      </span>
      {event.valueCents > 0 && (
        <span className="text-green-400">{formatCurrency(event.valueCents / 100)}</span>
      )}
      <span className="text-[#502d26]">{timeAgo(event.createdAt)}</span>
    </div>
  );
}
