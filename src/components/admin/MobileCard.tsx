import { ReactNode } from 'react';

interface MobileCardField {
  label: string;
  value: ReactNode;
}

interface MobileCardProps {
  title: string;
  fields: MobileCardField[];
  actions?: ReactNode;
  className?: string;
}

export function MobileCard({ title, fields, actions, className = '' }: MobileCardProps) {
  return (
    <div className={`p-4 bg-[#302927]/40 rounded-lg border border-[#502d26]/30 space-y-2 ${className}`}>
      <div className="flex items-start justify-between">
        <h3 className="text-[#ede8df] font-medium text-base">{title}</h3>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>

      <div className="space-y-1.5">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center text-sm gap-3">
            <span className="text-[#b2a491] flex-shrink-0">{label}</span>
            <span className="text-[#ede8df] text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
