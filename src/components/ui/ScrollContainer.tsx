"use client";

import React from 'react';

type ScrollContainerProps = React.PropsWithChildren<{
  className?: string;
}>;

/**
 * Scrollable container that fills available space and provides momentum scrolling.
 */
export default function ScrollContainer({ children, className = '' }: ScrollContainerProps) {
  return (
    <div className={`flex-1 min-h-0 overflow-y-auto scrollable-container ${className}`}>
      {children}
    </div>
  );
}


