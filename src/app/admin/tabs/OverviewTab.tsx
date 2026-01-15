
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
  // TODO: Implement real activity tracking
  return Promise.resolve([
    { action: 'New video uploaded', item: 'Recent content', time: '2 hours ago', icon: '🎬' },
    { action: 'Gallery created', item: 'Moments', time: '5 hours ago', icon: '📸' },
    { action: 'Order received', item: 'E-commerce', time: '1 day ago', icon: '📦' }
  ]);
};


export default function OverviewTab() {
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
          <a
            href="/social-ops"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ede8df] text-[#171616] font-semibold hover:bg-white/90 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            <span>Social Ops</span>
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm mb-6">
        <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-3 sm:mb-4">Recent Activity</h3>
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
