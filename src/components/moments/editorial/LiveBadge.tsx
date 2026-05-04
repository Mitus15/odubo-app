"use client";

interface LiveBadgeProps {
  count?: number;
  className?: string;
}

export default function LiveBadge({ count, className = '' }: LiveBadgeProps) {
  return (
    <div className={`editorial-live ${className}`}>
      <span className="editorial-live-dot" />
      <span>Live</span>
      {count !== undefined && (
        <span style={{ marginLeft: '0.25rem', opacity: 0.8 }}>
          {count.toLocaleString()}
        </span>
      )}
    </div>
  );
}
