import { ReactNode } from 'react';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveContainer({ children, className = '' }: ResponsiveContainerProps) {
  return (
    <div className={`max-w-full md:max-w-[1600px] p-3 sm:p-4 md:p-6 ${className}`}>
      {children}
    </div>
  );
}
