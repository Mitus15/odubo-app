import { ReactNode } from 'react';

interface ResponsiveGridProps {
  children: ReactNode;
  cols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 2 | 3 | 4 | 6;
  className?: string;
}

export function ResponsiveGrid({
  children,
  cols = {},
  gap = 4,
  className = ''
}: ResponsiveGridProps) {
  const { sm = 2, md = 3, lg = 4, xl = 4 } = cols;

  // Build grid classes dynamically
  const gridClasses = [
    'grid',
    'grid-cols-1', // Mobile first
    sm ? `sm:grid-cols-${sm}` : '',
    md ? `md:grid-cols-${md}` : '',
    lg ? `lg:grid-cols-${lg}` : '',
    xl ? `xl:grid-cols-${xl}` : '',
    `gap-${gap}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
}
