'use client';

import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PieDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieDataPoint[];
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

// Default color palette
const COLORS = ['#843c2d', '#a85540', '#c17055', '#d4896e', '#e5a48a', '#f2c0a8'];

// Format percentage
function formatPercent(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(0)}%`;
}

export default function PieChart({
  data,
  height = 200,
  showLegend = true,
  innerRadius = 50,
  outerRadius = 80,
}: PieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[150px] text-[#b2a491] text-sm">
        No data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || COLORS[index % COLORS.length]}
                stroke="rgba(0,0,0,0.2)"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1817',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [
              `${value.toLocaleString()} (${formatPercent(value, total)})`,
              '',
            ]}
          />
          {showLegend && (
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ fontSize: '11px', paddingLeft: '10px' }}
              formatter={(value, entry) => {
                const item = data.find(d => d.name === value);
                const percent = item ? formatPercent(item.value, total) : '';
                return (
                  <span style={{ color: '#b2a491' }}>
                    {value} ({percent})
                  </span>
                );
              }}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
