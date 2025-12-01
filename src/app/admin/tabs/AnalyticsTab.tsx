
"use client";

import { useEffect, useState } from "react";

// Define types for the data
interface Metric {
  label: string;
  value: string;
  trend: string;
  icon: string;
}

interface TopContent {
  title: string;
  type: string;
  views: string;
  icon: string;
}

// Dummy API functions (replace with actual API calls)
const fetchMetrics = async (): Promise<Metric[]> => {
  return Promise.resolve([
    { label: 'Views Today', value: '2.4K', trend: '+12%', icon: '👁️' },
    { label: 'Likes Today', value: '156', trend: '+8%', icon: '❤️' },
    { label: 'Comments', value: '43', trend: '+15%', icon: '💬' },
    { label: 'Shares', value: '28', trend: '+5%', icon: '📤' }
  ]);
};

const fetchTopContent = async (): Promise<TopContent[]> => {
  return Promise.resolve([
    { title: 'Summer Vibes Album', type: 'Album', views: '12.5K', icon: '🎵' },
    { title: 'Behind the Music', type: 'Video', views: '8.3K', icon: '🎬' },
    { title: 'Live Session #4', type: 'Video', views: '6.1K', icon: '🎬' }
  ]);
};

interface AnalyticsTabProps {
  view?: string;
}

export default function AnalyticsContent({ view = 'analytics-overview' }: AnalyticsTabProps) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [topContent, setTopContent] = useState<TopContent[]>([]);

  useEffect(() => {
    fetchMetrics().then(setMetrics);
    fetchTopContent().then(setTopContent);
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
            {/* Daily Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg sm:text-xl">{metric.icon}</span>
                    <span className="text-[10px] sm:text-xs text-green-400">{metric.trend}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#ede8df]">{metric.value}</div>
                  <div className="text-xs sm:text-sm text-[#b2a491]">{metric.label}</div>
                </div>
              ))}
            </div>

            {/* Top Content */}
            <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
              <h3 className="text-base sm:text-lg font-bold text-[#ede8df] mb-3 sm:mb-4">Top Performing Content</h3>
              <div className="space-y-2 sm:space-y-3">
                {topContent.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 sm:p-3 bg-[#171616]/50 rounded-lg sm:rounded-xl">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                      <span className="text-base sm:text-xl flex-shrink-0">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[#ede8df] text-xs sm:text-sm font-medium truncate">{item.title}</div>
                        <div className="text-[#b2a491] text-[10px] sm:text-xs">{item.type}</div>
                      </div>
                    </div>
                    <div className="text-[#ede8df] text-xs sm:text-sm font-medium flex-shrink-0">{item.views}</div>
                  </div>
                ))}
              </div>
            </div>
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
