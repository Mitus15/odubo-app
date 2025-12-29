'use client';

import { type ReactNode } from 'react';
import { useCommandCenter, PANEL_META, type PanelId, type PanelSize } from '@/contexts/CommandCenterContext';

interface PanelContainerProps {
  panelId: PanelId;
  size: PanelSize;
  isExpanded?: boolean;
  children: ReactNode;
}

export function PanelContainer({ panelId, size, isExpanded = false, children }: PanelContainerProps) {
  const { closePanel, minimizePanel, expandPanel, collapsePanel } = useCommandCenter();
  const meta = PANEL_META[panelId];

  // Size classes for grid layout
  const sizeClasses: Record<PanelSize, string> = {
    small: 'min-h-[300px]',
    medium: 'min-h-[400px]',
    large: 'min-h-[500px] lg:col-span-2',
    full: 'h-full',
  };

  return (
    <div
      className={`bg-[#171616] rounded-xl border border-[#502d26]/30 flex flex-col overflow-hidden ${
        isExpanded ? 'h-full' : sizeClasses[size]
      }`}
    >
      {/* Panel Header */}
      <div className="flex-shrink-0 h-11 border-b border-[#502d26]/30 flex items-center justify-between px-3 bg-[#0d0c0a]/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{meta.icon}</span>
          <h3 className="font-medium text-sm truncate">{meta.name}</h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Minimize */}
          {!isExpanded && (
            <button
              onClick={() => minimizePanel(panelId)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927] transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          )}

          {/* Expand/Collapse */}
          <button
            onClick={() => (isExpanded ? collapsePanel() : expandPanel(panelId))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927] transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                />
              </svg>
            )}
          </button>

          {/* Close */}
          <button
            onClick={() => closePanel(panelId)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#726d6c] hover:text-red-400 hover:bg-red-900/20 transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
