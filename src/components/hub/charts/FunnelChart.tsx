'use client';

interface FunnelStep {
  label: string;
  value: number;
  color?: string;
}

interface FunnelChartProps {
  steps: FunnelStep[];
  showConversionRate?: boolean;
}

// Format large numbers
function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function FunnelChart({ steps, showConversionRate = true }: FunnelChartProps) {
  if (!steps || steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-[100px] text-[#b2a491] text-sm">
        No funnel data available
      </div>
    );
  }

  const maxValue = Math.max(...steps.map(s => s.value), 1);

  return (
    <div className="space-y-3">
      {steps.map((step, idx) => {
        const percentage = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
        const prevValue = idx > 0 ? steps[idx - 1].value : null;
        const conversionRate = prevValue && prevValue > 0 ? ((step.value / prevValue) * 100).toFixed(1) : null;

        return (
          <div key={step.label} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#b2a491]">{step.label}</span>
              <div className="flex items-center gap-2">
                {showConversionRate && conversionRate && (
                  <span className="text-[10px] text-[#b2a491]/70">{conversionRate}%</span>
                )}
                <span className="text-[#ede8df] font-medium">{formatNumber(step.value)}</span>
              </div>
            </div>
            <div className="h-2 bg-[#171616]/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(percentage, step.value > 0 ? 2 : 0)}%`,
                  background: step.color || `linear-gradient(90deg, #843c2d 0%, #a85540 100%)`,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Overall conversion rate */}
      {showConversionRate && steps.length >= 2 && steps[0].value > 0 && (
        <div className="pt-2 mt-2 border-t border-[#502d26]/40 flex justify-between text-xs">
          <span className="text-[#b2a491]">Overall Conversion</span>
          <span className="text-[#ede8df] font-medium">
            {((steps[steps.length - 1].value / steps[0].value) * 100).toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
