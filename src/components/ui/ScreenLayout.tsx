"use client";

import React from 'react';

type ScreenLayoutProps = React.PropsWithChildren<{
  className?: string;
}>;

/**
 * Full-height, header-aware screen layout. Use inside the app <main> region.
 * Ensures no page-level scrolling and enables only container scrolling.
 */
export default function ScreenLayout({ children, className = '' }: ScreenLayoutProps) {
  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {children}
    </div>
  );
}


