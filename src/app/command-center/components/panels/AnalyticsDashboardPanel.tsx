'use client';

import { useState } from 'react';

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

export function AnalyticsDashboardPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Placeholder metrics
  const metrics = {
    totalStreams: 0,
    listeners: 0,
    saves: 0,
    revenue: 0,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Time Range Selector */}
      <div className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">Overview</h3>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Total Streams', value: metrics.totalStreams, icon: '▶️' },
            { label: 'Listeners', value: metrics.listeners, icon: '👥' },
            { label: 'Saves', value: metrics.saves, icon: '💾' },
            { label: 'Revenue', value: `$${metrics.revenue}`, icon: '💰' },
          ].map((metric) => (
            <div
              key={metric.label}
              className="p-4 rounded-xl bg-[#0d0c0a] border border-[#502d26]/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{metric.icon}</span>
                <span className="text-xs text-[#726d6c]">{metric.label}</span>
              </div>
              <div className="text-xl font-semibold">{metric.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="p-6 rounded-xl border border-dashed border-[#502d26]/40 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="font-semibold mb-2">Streaming Analytics</h3>
          <p className="text-sm text-[#726d6c]">
            Charts and insights coming in Phase 3
          </p>
          <p className="text-xs text-[#502d26] mt-4">
            Platform breakdown • Geographic heatmap • Playlist tracking
          </p>
        </div>
      </div>
    </div>
  );
}
