
"use client";

import { useEffect, useState } from "react";

// Define types for the data
interface QuickStat {
  label: string;
  value: string;
  change: string;
  icon: string;
}

interface Activity {
  action: string;
  item: string;
  time: string;
  icon: string;
}

interface SystemMetrics {
  database: { status: string; latency?: number; region?: string };
  storage: { status: string; usedFormatted: string; totalFormatted: string };
  cdn: { status: string; requests?: number; cacheHitRate?: number };
  bandwidth: { usedFormatted: string; totalFormatted: string };
  apiCalls: { usedFormatted: string; totalFormatted: string };
  shopify: { status: string; responseTime?: number };
  stream: { status: string; videoCount?: number; storageUsed?: string };
}


interface AdminStats {
  content: {
    albums: number;
    tracks: number;
    videos: number;
    galleries: number;
  };
  commerce: {
    products: number;
    orders: number;
    revenue: number;
    averageOrderValue: number;
  };
  users: {
    total: number;
  };
  activity: {
    recentVideos: number;
    recentGalleries: number;
    recentOrders: number;
  };
}

// Fetch stats from API
const fetchQuickStats = async (): Promise<QuickStat[]> => {
  try {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Stats API error:', res.status, errorText);
      throw new Error(`Failed to fetch stats: ${res.status}`);
    }
    
    const data = await res.json() as { success: boolean; error?: string; stats: AdminStats };
    if (!data.success) throw new Error(data.error);

    const stats: AdminStats = data.stats;
    
    return [
      { 
        label: 'Total Music', 
        value: `${stats.content.albums}`, 
        change: `${stats.content.tracks} tracks`, 
        icon: '🎵' 
      },
      { 
        label: 'Total Videos', 
        value: `${stats.content.videos}`, 
        change: `+${stats.activity.recentVideos} this week`, 
        icon: '🎬' 
      },
      { 
        label: 'Moments', 
        value: `${stats.content.galleries}`, 
        change: `+${stats.activity.recentGalleries} this week`, 
        icon: '📸' 
      },
      { 
        label: 'Total Orders', 
        value: `${stats.commerce.orders}`, 
        change: `$${stats.commerce.revenue.toFixed(2)} revenue`, 
        icon: '📦' 
      }
    ];
  } catch (error) {
    console.error('Failed to fetch quick stats:', error);
    // Return fallback data
    return [
      { label: 'Total Music', value: '0', change: 'Loading...', icon: '🎵' },
      { label: 'Total Videos', value: '0', change: 'Loading...', icon: '🎬' },
      { label: 'Moments', value: '0', change: 'Loading...', icon: '📸' },
      { label: 'Total Orders', value: '0', change: 'Loading...', icon: '📦' }
    ];
  }
};


const fetchRecentActivity = async (): Promise<Activity[]> => {
  try {
    const res = await fetch('/api/admin/recent-activity');
    if (!res.ok) {
      throw new Error('Failed to fetch recent activity');
    }
    const data = await res.json() as { success: boolean; activities: Activity[] };
    if (!data.success) {
      throw new Error('API returned error');
    }
    return data.activities;
  } catch (error) {
    console.error('Failed to fetch recent activity:', error);
    return [];
  }
};


export default function OverviewTab({ onSetActiveTab }: { onSetActiveTab?: (tabId: string) => void }) {
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    fetchQuickStats().then(setQuickStats);
    fetchRecentActivity().then(setRecentActivity);
    fetchSystemMetrics();
  }, []);

  const fetchSystemMetrics = async () => {
    try {
      const res = await fetch('/api/admin/system-metrics');
      if (res.ok) {
        const data = await res.json() as { success: boolean; metrics: SystemMetrics };
        if (data.success) {
          setSystemMetrics(data.metrics);
        }
      }
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
    }
  };

  return (
    <div className="px-3 sm:px-6 py-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {quickStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg sm:text-2xl">{stat.icon}</span>
              <div className="text-right">
                <div className="text-lg sm:text-2xl font-bold text-[#ede8df]">{stat.value}</div>
                <div className="text-[10px] sm:text-xs text-[#726d6c]">{stat.change}</div>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-[#b2a491]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm mb-6">
        <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-3 sm:mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onSetActiveTab?.('arsenal')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ede8df] text-[#171616] font-semibold hover:bg-white/90 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m13.5 9.75h3a2.25 2.25 0 002.25-2.25V9m0 0a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 9m13.5 0a2.25 2.25 0 00-2.25-2.25h-3a2.25 2.25 0 00-2.25 2.25" />
            </svg>
            <span>Upload Clip</span>
          </button>
          <button
            onClick={() => onSetActiveTab?.('moments')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ede8df] text-[#171616] font-semibold hover:bg-white/90 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            <span>Create Gallery</span>
          </button>
          <button
            onClick={() => onSetActiveTab?.('analytics')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ede8df] text-[#171616] font-semibold hover:bg-white/90 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span>View Analytics</span>
          </button>
          <a
            href={process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL ? `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}/admin` : '/admin/store'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ede8df] text-[#171616] font-semibold hover:bg-white/90 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
            </svg>
            <span>Manage Store</span>
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm mb-6">
        <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-3 sm:mb-4">Recent Activity</h3>
        {recentActivity.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-[#171616]/50 rounded-lg sm:rounded-xl">
                <span className="text-base sm:text-xl flex-shrink-0">{activity.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[#ede8df] text-xs sm:text-sm">{activity.action}</div>
                  <div className="text-[#b2a491] text-[10px] sm:text-xs truncate">{activity.item}</div>
                </div>
                <div className="text-[#726d6c] text-[10px] sm:text-xs flex-shrink-0">{activity.time}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm mb-6">
        <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-3 sm:mb-4">System Status</h3>
        {systemMetrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#b2a491] text-sm">Database</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemMetrics.database.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}></div>
                  <span className={`text-xs ${
                    systemMetrics.database.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {systemMetrics.database.status.charAt(0).toUpperCase() + systemMetrics.database.status.slice(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#b2a491] text-sm">Storage</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemMetrics.storage.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}></div>
                  <span className={`text-xs ${
                    systemMetrics.storage.status === 'online' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {systemMetrics.storage.status.charAt(0).toUpperCase() + systemMetrics.storage.status.slice(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#b2a491] text-sm">CDN</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemMetrics.cdn.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}></div>
                  <span className={`text-xs ${
                    systemMetrics.cdn.status === 'active' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {systemMetrics.cdn.status.charAt(0).toUpperCase() + systemMetrics.cdn.status.slice(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#b2a491] text-sm">Shopify API</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemMetrics.shopify.status === 'online' ? 'bg-emerald-500' : 
                    systemMetrics.shopify.status === 'error' ? 'bg-amber-500' : 'bg-gray-500'
                  }`}></div>
                  <span className={`text-xs ${
                    systemMetrics.shopify.status === 'online' ? 'text-emerald-400' : 
                    systemMetrics.shopify.status === 'error' ? 'text-amber-400' : 'text-gray-400'
                  }`}>
                    {systemMetrics.shopify.status.charAt(0).toUpperCase() + systemMetrics.shopify.status.slice(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#b2a491] text-sm">Stream</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemMetrics.stream.status === 'active' ? 'bg-emerald-500' : 
                    systemMetrics.stream.status === 'error' ? 'bg-amber-500' : 'bg-gray-500'
                  }`}></div>
                  <span className={`text-xs ${
                    systemMetrics.stream.status === 'active' ? 'text-emerald-400' : 
                    systemMetrics.stream.status === 'error' ? 'text-amber-400' : 'text-gray-400'
                  }`}>
                    {systemMetrics.stream.status.charAt(0).toUpperCase() + systemMetrics.stream.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#b2a491] text-sm">Storage Used</span>
                <span className="text-[#ede8df] text-sm">
                  {systemMetrics.storage.usedFormatted} / {systemMetrics.storage.totalFormatted}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#b2a491] text-sm">Bandwidth</span>
                <span className="text-[#ede8df] text-sm">
                  {systemMetrics.bandwidth.usedFormatted} / {systemMetrics.bandwidth.totalFormatted}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#b2a491] text-sm">API Calls</span>
                <span className="text-[#ede8df] text-sm">
                  {systemMetrics.apiCalls.usedFormatted} / {systemMetrics.apiCalls.totalFormatted}
                </span>
              </div>
              {systemMetrics.stream.videoCount !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-[#b2a491] text-sm">Stream Videos</span>
                  <span className="text-[#ede8df] text-sm">
                    {systemMetrics.stream.videoCount} videos
                  </span>
                </div>
              )}
              {systemMetrics.stream.storageUsed && (
                <div className="flex items-center justify-between">
                  <span className="text-[#b2a491] text-sm">Stream Storage</span>
                  <span className="text-[#ede8df] text-sm">
                    {systemMetrics.stream.storageUsed}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
