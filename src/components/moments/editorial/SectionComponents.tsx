"use client";

import { ReactNode } from "react";

interface SectionHeaderProps {
  label?: string;
  title: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export default function SectionHeader({
  label,
  title,
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between mb-6 ${className}`}>
      <div>
        {label && <p className="editorial-label mb-1">{label}</p>}
        <h2 className="editorial-heading text-lg">{title}</h2>
      </div>
      {action && (
        action.href ? (
          <a
            href={action.href}
            className="text-xs text-[var(--editorial-text-secondary)] hover:text-[var(--editorial-text)] transition-colors uppercase tracking-wider"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="text-xs text-[var(--editorial-text-secondary)] hover:text-[var(--editorial-text)] transition-colors uppercase tracking-wider"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}

interface EditorialDividerProps {
  label?: string;
  className?: string;
}

export function EditorialDivider({ label, className = "" }: EditorialDividerProps) {
  return (
    <div className={`editorial-divider ${className}`}>
      {label && <span className="editorial-divider-label">{label}</span>}
    </div>
  );
}

interface EditorialSpotlightProps {
  children: ReactNode;
  className?: string;
}

export function EditorialSpotlight({ children, className = "" }: EditorialSpotlightProps) {
  return (
    <div className={`editorial-spotlight ${className}`}>
      {children}
    </div>
  );
}

interface EditorialScrollProps {
  children: ReactNode;
  className?: string;
}

export function EditorialScroll({ children, className = "" }: EditorialScrollProps) {
  return (
    <div className={`editorial-scroll ${className}`}>
      {children}
    </div>
  );
}

interface EditorialScrollItemProps {
  children: ReactNode;
  className?: string;
}

export function EditorialScrollItem({ children, className = "" }: EditorialScrollItemProps) {
  return (
    <div className={`editorial-scroll-item ${className}`}>
      {children}
    </div>
  );
}
