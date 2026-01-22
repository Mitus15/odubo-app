'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDataPoint[];
  height?: number;
  horizontal?: boolean;
  barColor?: string;
}

// Format large numbers
function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default function BarChart({
  data,
  height = 200,
  horizontal = true,
  barColor = '#843c2d',
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[150px] text-[#b2a491] text-sm">
        No data available
      </div>
    );
  }

  return (
    <div style={{ height, minWidth: 0, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
        >
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: '#b2a491', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatNumber}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#ede8df', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={80}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fill: '#ede8df', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#b2a491', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatNumber}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1817',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#ede8df' }}
            formatter={(value: number) => [formatNumber(value), '']}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar
            dataKey="value"
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={20}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || barColor}
                fillOpacity={0.8 + (index * 0.02)}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
