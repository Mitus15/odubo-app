'use client';

import { useMemo } from 'react';

interface MetricCardProps {
  label: string;
  value: number | string;
  change?: number; // Percentage change
  sublabel?: string;
  icon?: React.ReactNode;
  format?: 'number' | 'currency' | 'percent' | 'time';
}

// Format large numbers
function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// Format currency
function formatCurrency(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

// Format time (seconds to human readable)
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Format change percentage
function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}%`;
}

export default function MetricCard({
  label,
  value,
  change,
  sublabel,
  icon,
  format = 'number',
}: MetricCardProps) {
  const formattedValue = useMemo(() => {
    if (typeof value === 'string') return value;
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'time':
        return formatTime(value);
      case 'number':
      default:
        return formatNumber(value);
    }
  }, [value, format]);

  return (
    <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        {icon && <span className="text-lg sm:text-xl">{icon}</span>}
        {change !== undefined && (
          <span
            className={`text-[10px] sm:text-xs font-medium ${
              change > 0
                ? 'text-green-400'
                : change < 0
                  ? 'text-red-400'
                  : 'text-[#b2a491]'
            }`}
          >
            {formatChange(change)}
          </span>
        )}
      </div>
      <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#ede8df]">
        {formattedValue}
      </div>
      <div className="text-xs sm:text-sm text-[#b2a491] mt-0.5">{label}</div>
      {sublabel && (
        <div className="text-[10px] text-[#b2a491]/70 mt-1">{sublabel}</div>
      )}
    </div>
  );
}
