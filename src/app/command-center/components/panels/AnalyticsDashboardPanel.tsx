'use client';

import { useState, useEffect, useCallback } from 'react';

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';
type TabType = 'overview' | 'social' | 'streaming' | 'crossplatform' | 'funnel';

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

interface ComprehensiveAnalytics {
  period: { days: number };
  social: {
    overview: {
      totalViews: number;
      totalImpressions: number;
      totalReach: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      totalSaves: number;
      totalFollows: number;
      totalLinkClicks: number;
      totalWatchTimeHours: number;
      overallEngagementRate: string;
    };
    platforms: Array<{
      platform: string;
      name: string;
      color: string;
      contentCount: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      follows: number;
      linkClicks: number;
      avgEngagementRate: string;
      avgWatchPercent: number;
    }>;
    bestPlatform: any;
    contentTypes: Array<{
      content_type: string;
      contentCount: number;
      views: number;
      likes: number;
      shares: number;
      avgEngagementRate: number;
    }>;
    topContent: Array<{
      id: string;
      platform: string;
      content_type: string;
      title: string;
      external_url: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      linkClicks: number;
      engagementRate: number;
    }>;
  };
  attribution: {
    events: Array<{
      source_platform: string;
      event_type: string;
      eventCount: number;
      uniqueUsers: number;
      valueCents: number;
    }>;
    conversionRates: Array<{
      platform: string;
      name: string;
      color: string;
      sessions: number;
      purchases: number;
      revenue: number;
      conversionRate: string;
    }>;
    bestConvertingPlatform: any;
    funnelByPlatform: Array<{
      platform: string;
      name: string;
      color: string;
      visits: number;
      clipViews: number;
      musicPlays: number;
      streamClicks: number;
      shopViews: number;
      productViews: number;
      addToCarts: number;
      purchases: number;
      revenue: number;
      uniqueSessions: number;
      visitToClip: string;
      clipToShop: string;
      shopToPurchase: string;
      overallConversion: string;
    }>;
  };
  socialToStreaming: Array<{
    platform: string;
    socialViews: number;
    streamClicks: number;
    socialToStreamRate: number;
  }>;
  longform: Array<{
    platform: string;
    videoCount: number;
    views: number;
    watchTimeMinutes: number;
    likes: number;
    comments: number;
    subscribersGained: number;
    revenue: number;
    avgViewPercent: number;
  }>;
  trendingAudio: Array<{
    platform: string;
    audio_name: string;
    audio_author: string;
    uses_count: number;
    uses_change_24h: number;
    uses_change_7d: number;
    is_trending: number;
    trending_rank: number;
  }>;
  insights: Array<{
    type: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: 365,
};

// DSP Platform colors
const DSP_COLORS: Record<string, string> = {
  spotify: '#1DB954',
  apple_music: '#FA57C1',
  amazon_music: '#FF9900',
  youtube_music: '#FF0000',
  tidal: '#000000',
  deezer: '#FEAA2D',
  pandora: '#3668FF',
  soundcloud: '#FF5500',
};

const DSP_NAMES: Record<string, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  amazon_music: 'Amazon Music',
  youtube_music: 'YouTube Music',
  tidal: 'Tidal',
  deezer: 'Deezer',
  pandora: 'Pandora',
  soundcloud: 'SoundCloud',
};

// Social Platform colors
const SOCIAL_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  tiktok: '#000000',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  threads: '#000000',
  organic: '#726d6c',
  direct: '#843c2d',
};

const SOCIAL_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
  threads: 'Threads',
  organic: 'Organic',
  direct: 'Direct',
};

const SOCIAL_ICONS: Record<string, string> = {
  instagram: '📸',
  tiktok: '🎵',
  youtube: '▶️',
  twitter: '🐦',
  facebook: '👤',
  threads: '🧵',
};

const CONTENT_TYPE_NAMES: Record<string, string> = {
  clip: 'Clips/Reels',
  long_form: 'Long-form',
  story: 'Stories',
  post: 'Posts',
  live: 'Lives',
  premiere: 'Premieres',
};

export function AnalyticsDashboardPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [comprehensiveData, setComprehensiveData] = useState<ComprehensiveAnalytics | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const days = TIME_RANGE_DAYS[timeRange];

      // Fetch both basic and comprehensive analytics in parallel
      const [basicRes, compRes] = await Promise.all([
        fetch(`/api/command-center/analytics?days=${days}`),
        fetch(`/api/command-center/analytics/comprehensive?days=${days}`),
      ]);

      if (basicRes.ok) {
        const json = (await basicRes.json()) as AnalyticsData;
        setData(json);
      }

      if (compRes.ok) {
        const compJson = (await compRes.json()) as ComprehensiveAnalytics;
        setComprehensiveData(compJson);
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
            {(
              [
                { key: 'overview', label: 'Overview' },
                { key: 'social', label: 'Social' },
                { key: 'streaming', label: 'Streaming' },
                { key: 'crossplatform', label: 'Attribution' },
                { key: 'funnel', label: 'Funnel' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#302927] text-[#ede8df]'
                    : 'text-[#726d6c] hover:text-[#ede8df]'
                }`}
              >
                {tab.label}
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

            {/* Social Tab */}
            {activeTab === 'social' && (
              <div className="space-y-6">
                {comprehensiveData?.social ? (
                  <>
                    {/* Social Overview Metrics */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <MetricCard
                        icon="👁️"
                        label="Total Views"
                        value={formatNumber(comprehensiveData.social.overview.totalViews)}
                        subtitle="Across all platforms"
                      />
                      <MetricCard
                        icon="📊"
                        label="Reach"
                        value={formatNumber(comprehensiveData.social.overview.totalReach)}
                        subtitle="Unique accounts"
                      />
                      <MetricCard
                        icon="💬"
                        label="Engagement"
                        value={comprehensiveData.social.overview.overallEngagementRate}
                        subtitle="Avg engagement rate"
                      />
                      <MetricCard
                        icon="👥"
                        label="New Follows"
                        value={formatNumber(comprehensiveData.social.overview.totalFollows)}
                        subtitle="Profile follows"
                      />
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                      <MiniStat
                        label="Likes"
                        value={formatNumber(comprehensiveData.social.overview.totalLikes)}
                      />
                      <MiniStat
                        label="Comments"
                        value={formatNumber(comprehensiveData.social.overview.totalComments)}
                      />
                      <MiniStat
                        label="Shares"
                        value={formatNumber(comprehensiveData.social.overview.totalShares)}
                      />
                      <MiniStat
                        label="Saves"
                        value={formatNumber(comprehensiveData.social.overview.totalSaves)}
                      />
                      <MiniStat
                        label="Link Clicks"
                        value={formatNumber(comprehensiveData.social.overview.totalLinkClicks)}
                      />
                      <MiniStat
                        label="Watch Time"
                        value={`${Math.round(comprehensiveData.social.overview.totalWatchTimeHours)}h`}
                      />
                    </div>

                    {/* Platform Breakdown */}
                    <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                      <h4 className="text-sm font-medium mb-4">Performance by Platform</h4>
                      {comprehensiveData.social.platforms.length > 0 ? (
                        <div className="space-y-4">
                          {comprehensiveData.social.platforms.map((platform) => (
                            <div key={platform.platform} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor:
                                        SOCIAL_COLORS[platform.platform] || '#726d6c',
                                    }}
                                  />
                                  <span className="text-sm font-medium">
                                    {SOCIAL_NAMES[platform.platform] || platform.platform}
                                  </span>
                                  <span className="text-xs text-[#726d6c]">
                                    {platform.contentCount} posts
                                  </span>
                                </div>
                                <span className="text-sm text-[#843c2d] font-medium">
                                  {platform.avgEngagementRate} eng
                                </span>
                              </div>
                              <div className="grid grid-cols-5 gap-2 text-xs">
                                <div className="text-center p-1.5 bg-[#171616] rounded">
                                  <div className="font-medium">
                                    {formatNumber(platform.views)}
                                  </div>
                                  <div className="text-[#726d6c]">views</div>
                                </div>
                                <div className="text-center p-1.5 bg-[#171616] rounded">
                                  <div className="font-medium">
                                    {formatNumber(platform.likes)}
                                  </div>
                                  <div className="text-[#726d6c]">likes</div>
                                </div>
                                <div className="text-center p-1.5 bg-[#171616] rounded">
                                  <div className="font-medium">
                                    {formatNumber(platform.comments)}
                                  </div>
                                  <div className="text-[#726d6c]">comments</div>
                                </div>
                                <div className="text-center p-1.5 bg-[#171616] rounded">
                                  <div className="font-medium">
                                    {formatNumber(platform.shares)}
                                  </div>
                                  <div className="text-[#726d6c]">shares</div>
                                </div>
                                <div className="text-center p-1.5 bg-[#171616] rounded">
                                  <div className="font-medium">
                                    {formatNumber(platform.follows)}
                                  </div>
                                  <div className="text-[#726d6c]">follows</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[#726d6c] text-center py-4">
                          No social data yet. Connect your social accounts.
                        </p>
                      )}
                    </div>

                    {/* Content Type Performance */}
                    {comprehensiveData.social.contentTypes.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                        <h4 className="text-sm font-medium mb-4">Performance by Content Type</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          {comprehensiveData.social.contentTypes.map((ct) => (
                            <div
                              key={ct.content_type}
                              className="p-3 bg-[#171616] rounded-lg"
                            >
                              <div className="text-sm font-medium mb-1">
                                {CONTENT_TYPE_NAMES[ct.content_type] || ct.content_type}
                              </div>
                              <div className="flex items-center justify-between text-xs text-[#726d6c]">
                                <span>{ct.contentCount} posts</span>
                                <span>{formatNumber(ct.views)} views</span>
                              </div>
                              <div className="mt-2 text-sm text-[#843c2d] font-medium">
                                {ct.avgEngagementRate.toFixed(1)}% eng
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Social Content */}
                    {comprehensiveData.social.topContent.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                        <h4 className="text-sm font-medium mb-4">Top Performing Content</h4>
                        <div className="space-y-3">
                          {comprehensiveData.social.topContent.slice(0, 10).map((content, i) => (
                            <div
                              key={content.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#171616] transition-colors"
                            >
                              <span className="text-xs text-[#726d6c] w-4">{i + 1}</span>
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                style={{
                                  backgroundColor:
                                    SOCIAL_COLORS[content.platform] || '#726d6c',
                                }}
                              >
                                {SOCIAL_ICONS[content.platform] || '📱'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {content.title || 'Untitled'}
                                </p>
                                <p className="text-xs text-[#726d6c]">
                                  {SOCIAL_NAMES[content.platform]} ·{' '}
                                  {CONTENT_TYPE_NAMES[content.content_type] || content.content_type}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[#726d6c]">
                                <span>👁️ {formatNumber(content.views)}</span>
                                <span>❤️ {formatNumber(content.likes)}</span>
                                <span className="text-[#843c2d]">
                                  {content.engagementRate.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">📱</div>
                    <h3 className="font-semibold mb-2">No social analytics data</h3>
                    <p className="text-sm text-[#726d6c]">
                      Social metrics will appear once content is tracked
                    </p>
                  </div>
                )}
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

            {/* Cross-Platform Attribution Tab */}
            {activeTab === 'crossplatform' && (
              <div className="space-y-6">
                {comprehensiveData?.attribution ? (
                  <>
                    {/* Insights Banner */}
                    {comprehensiveData.insights.length > 0 && (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-[#843c2d]/20 to-transparent border border-[#843c2d]/30">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <span>💡</span> Insights
                        </h4>
                        <div className="space-y-2">
                          {comprehensiveData.insights.slice(0, 3).map((insight, i) => (
                            <div
                              key={i}
                              className={`text-xs p-2 rounded-lg ${
                                insight.priority === 'high'
                                  ? 'bg-[#843c2d]/30 text-[#ede8df]'
                                  : insight.priority === 'medium'
                                    ? 'bg-[#502d26]/30 text-[#ede8df]/80'
                                    : 'bg-[#171616] text-[#726d6c]'
                              }`}
                            >
                              {insight.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Conversion by Platform */}
                    <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                      <h4 className="text-sm font-medium mb-4">Conversion Rate by Source Platform</h4>
                      {comprehensiveData.attribution.conversionRates.length > 0 ? (
                        <div className="space-y-3">
                          {comprehensiveData.attribution.conversionRates.map((platform) => {
                            const convRate = parseFloat(platform.conversionRate) || 0;
                            return (
                              <div key={platform.platform} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{
                                        backgroundColor:
                                          SOCIAL_COLORS[platform.platform] || '#726d6c',
                                      }}
                                    />
                                    <span className="text-sm font-medium">
                                      {SOCIAL_NAMES[platform.platform] || platform.platform}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs">
                                    <span className="text-[#726d6c]">
                                      {formatNumber(platform.sessions)} sessions
                                    </span>
                                    <span className="text-[#726d6c]">
                                      {platform.purchases} orders
                                    </span>
                                    <span className="text-green-400 font-medium">
                                      {formatCurrency(platform.revenue)}
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2 bg-[#171616] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(convRate * 10, 100)}%`,
                                      backgroundColor:
                                        SOCIAL_COLORS[platform.platform] || '#726d6c',
                                    }}
                                  />
                                </div>
                                <div className="text-right text-xs text-[#843c2d] font-medium">
                                  {platform.conversionRate} conversion
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-[#726d6c] text-center py-4">
                          No attribution data yet
                        </p>
                      )}
                    </div>

                    {/* Social to Streaming Correlation */}
                    {comprehensiveData.socialToStreaming.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                        <h4 className="text-sm font-medium mb-4">Social → Streaming Attribution</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {comprehensiveData.socialToStreaming.map((item) => (
                            <div
                              key={item.platform}
                              className="p-3 bg-[#171616] rounded-lg flex items-center gap-3"
                            >
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor:
                                    SOCIAL_COLORS[item.platform] || '#726d6c',
                                }}
                              >
                                {SOCIAL_ICONS[item.platform] || '📱'}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium">
                                  {SOCIAL_NAMES[item.platform] || item.platform}
                                </div>
                                <div className="text-xs text-[#726d6c]">
                                  {formatNumber(item.socialViews)} views → {formatNumber(item.streamClicks)} stream clicks
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-[#843c2d]">
                                  {item.socialToStreamRate.toFixed(1)}%
                                </div>
                                <div className="text-[10px] text-[#726d6c]">
                                  social→stream
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full Funnel by Platform */}
                    {comprehensiveData.attribution.funnelByPlatform.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                        <h4 className="text-sm font-medium mb-4">Full Funnel by Platform</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[#726d6c] border-b border-[#502d26]/20">
                                <th className="text-left py-2 px-2">Platform</th>
                                <th className="text-right py-2 px-2">Visits</th>
                                <th className="text-right py-2 px-2">Clips</th>
                                <th className="text-right py-2 px-2">Shop</th>
                                <th className="text-right py-2 px-2">Cart</th>
                                <th className="text-right py-2 px-2">Purchase</th>
                                <th className="text-right py-2 px-2">Revenue</th>
                                <th className="text-right py-2 px-2">Conv %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comprehensiveData.attribution.funnelByPlatform.map((funnel) => (
                                <tr
                                  key={funnel.platform}
                                  className="border-b border-[#502d26]/10 hover:bg-[#171616]"
                                >
                                  <td className="py-2 px-2">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                          backgroundColor:
                                            SOCIAL_COLORS[funnel.platform] || '#726d6c',
                                        }}
                                      />
                                      <span className="font-medium">
                                        {SOCIAL_NAMES[funnel.platform] || funnel.platform}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="text-right py-2 px-2">
                                    {formatNumber(funnel.visits)}
                                  </td>
                                  <td className="text-right py-2 px-2">
                                    {formatNumber(funnel.clipViews)}
                                  </td>
                                  <td className="text-right py-2 px-2">
                                    {formatNumber(funnel.shopViews)}
                                  </td>
                                  <td className="text-right py-2 px-2">
                                    {formatNumber(funnel.addToCarts)}
                                  </td>
                                  <td className="text-right py-2 px-2 text-green-400">
                                    {funnel.purchases}
                                  </td>
                                  <td className="text-right py-2 px-2 text-green-400 font-medium">
                                    {formatCurrency(funnel.revenue)}
                                  </td>
                                  <td className="text-right py-2 px-2 text-[#843c2d] font-medium">
                                    {funnel.overallConversion}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Long-form Video Performance */}
                    {comprehensiveData.longform.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                        <h4 className="text-sm font-medium mb-4">Long-form Video Performance</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {comprehensiveData.longform.map((lf) => (
                            <div
                              key={lf.platform}
                              className="p-3 bg-[#171616] rounded-lg"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center bg-red-600"
                                >
                                  ▶️
                                </div>
                                <div>
                                  <div className="font-medium">
                                    {lf.platform === 'youtube' ? 'YouTube' : lf.platform}
                                  </div>
                                  <div className="text-xs text-[#726d6c]">
                                    {lf.videoCount} videos
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="text-center p-1.5 bg-[#0d0c0a] rounded">
                                  <div className="font-medium">
                                    {formatNumber(lf.views)}
                                  </div>
                                  <div className="text-[#726d6c]">views</div>
                                </div>
                                <div className="text-center p-1.5 bg-[#0d0c0a] rounded">
                                  <div className="font-medium">
                                    {Math.round(lf.watchTimeMinutes / 60)}h
                                  </div>
                                  <div className="text-[#726d6c]">watch time</div>
                                </div>
                                <div className="text-center p-1.5 bg-[#0d0c0a] rounded">
                                  <div className="font-medium">
                                    {lf.avgViewPercent.toFixed(0)}%
                                  </div>
                                  <div className="text-[#726d6c]">avg viewed</div>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs">
                                <span className="text-[#726d6c]">
                                  +{lf.subscribersGained} subs
                                </span>
                                <span className="text-green-400 font-medium">
                                  {formatCurrency(lf.revenue)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trending Audio (if using your sounds) */}
                    {comprehensiveData.trendingAudio?.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20">
                        <h4 className="text-sm font-medium mb-4">Your Sounds on Social</h4>
                        <div className="space-y-2">
                          {comprehensiveData.trendingAudio.map((audio, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 p-2 bg-[#171616] rounded-lg"
                            >
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor:
                                    SOCIAL_COLORS[audio.platform] || '#726d6c',
                                }}
                              >
                                🎵
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {audio.audio_name}
                                </p>
                                <p className="text-xs text-[#726d6c]">
                                  {SOCIAL_NAMES[audio.platform] || audio.platform}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {formatNumber(audio.uses_count)} uses
                                </div>
                                {audio.uses_change_24h !== 0 && (
                                  <div
                                    className={`text-xs ${audio.uses_change_24h > 0 ? 'text-green-400' : 'text-red-400'}`}
                                  >
                                    {audio.uses_change_24h > 0 ? '+' : ''}
                                    {audio.uses_change_24h} today
                                  </div>
                                )}
                              </div>
                              {audio.is_trending === 1 && (
                                <div className="px-2 py-0.5 bg-[#843c2d] rounded text-[10px] font-medium">
                                  #{audio.trending_rank} Trending
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">🔗</div>
                    <h3 className="font-semibold mb-2">No cross-platform data</h3>
                    <p className="text-sm text-[#726d6c]">
                      Attribution tracking will show how your social content drives actions
                    </p>
                  </div>
                )}
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
  maxStreams,
}: {
  platform: { platform: string; streams: number; listeners: number; revenue: number };
  formatNumber: (n: number) => string;
  maxStreams?: number;
}) {
  const max = maxStreams || platform.streams || 1;
  const barWidth = Math.min((platform.streams / max) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: DSP_COLORS[platform.platform] || '#726d6c' }}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">
            {DSP_NAMES[platform.platform] || platform.platform}
          </span>
          <span className="text-xs text-[#726d6c]">{formatNumber(platform.streams)} streams</span>
        </div>
        <div className="h-1.5 bg-[#171616] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${barWidth}%`,
              backgroundColor: DSP_COLORS[platform.platform] || '#726d6c',
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
