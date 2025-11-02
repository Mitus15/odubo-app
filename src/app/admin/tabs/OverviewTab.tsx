
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

// Dummy API functions (replace with actual API calls)
const fetchQuickStats = async (): Promise<QuickStat[]> => {
  // In a real app, you'd fetch this from your API
  return Promise.resolve([
    { label: 'Total Albums', value: '24', change: '+3 this week', icon: '🎵' },
    { label: 'Total Videos', value: '156', change: '+12 this week', icon: '🎬' },
    { label: 'Active Users', value: '1.2K', change: '+8% this month', icon: '👥' },
    { label: 'Total Streams', value: '45.6K', change: '+15% this month', icon: '📈' }
  ]);
};

const fetchRecentActivity = async (): Promise<Activity[]> => {
  // In a real app, you'd fetch this from your API
  return Promise.resolve([
    { action: 'New album created', item: 'Midnight Dreams', time: '2 hours ago', icon: '🎵' },
    { action: 'Video uploaded', item: 'Behind the Scenes', time: '5 hours ago', icon: '🎬' },
    { action: 'User registered', item: 'john.doe@example.com', time: '1 day ago', icon: '👥' }
  ]);
};


export default function OverviewTab() {
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  useEffect(() => {
    fetchQuickStats().then(setQuickStats);
    fetchRecentActivity().then(setRecentActivity);
  }, []);

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
            href="/featured/manage"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ede8df] text-[#171616] font-semibold hover:bg-white/90 transition"
          >
            <span>⭐</span>
            <span>Manage Featured</span>
          </a>
          <a
            href="/featured/manage/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#302927] border border-[#502d26]/40 text-[#ede8df] hover:bg-[#502d26]/40 transition"
          >
            <span>➕</span>
            <span>New Featured Project</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#b2a491] text-sm">Database</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-400 text-xs">Healthy</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#b2a491] text-sm">Storage</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-400 text-xs">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#b2a491] text-sm">CDN</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-400 text-xs">Active</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#b2a491] text-sm">Storage Used</span>
              <span className="text-[#ede8df] text-sm">2.4 GB / 10 GB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#b2a491] text-sm">Bandwidth</span>
              <span className="text-[#ede8df] text-sm">156 GB / 500 GB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#b2a491] text-sm">API Calls</span>
              <span className="text-[#ede8df] text-sm">12.3K / 50K</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
