"use client";

import Link from "next/link";
import CountdownTimer from "./CountdownTimer";
import LiveBadge from "./LiveBadge";

type EventStatus = "upcoming" | "live" | "past";

interface EventCardProps {
  id: number | string;
  title: string;
  subtitle?: string;
  startsAt?: string;
  endsAt?: string;
  status?: EventStatus;
  captureCount?: number;
  previewImage?: string;
  className?: string;
  featured?: boolean;
  onClick?: () => void;
}

export default function EventCard({
  id,
  title,
  subtitle,
  startsAt,
  endsAt,
  status = "upcoming",
  captureCount,
  previewImage,
  className = "",
  featured = false,
  onClick,
}: EventCardProps) {
  const startsDate = startsAt ? new Date(startsAt) : null;
  const endsDate = endsAt ? new Date(endsAt) : null;
  const now = new Date();

  const isLive = status === "live" || (startsDate && endsDate && now >= startsDate && now <= endsDate);
  const isPast = status === "past" || (endsDate && now > endsDate);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Link
      href={`/moments/event/${id}`}
      className={`
        editorial-card block group
        ${featured ? "col-span-2 sm:col-span-2" : ""}
        ${className}
      `}
      onClick={onClick}
    >
      <div className={`relative ${featured ? "aspect-[21/9]" : "aspect-[4/5]"}`}>
        {/* Background Image */}
        {previewImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
            <div className="editorial-overlay" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--editorial-surface)] to-[var(--editorial-bg)] flex items-center justify-center">
            <svg
              className="w-16 h-16 text-[var(--editorial-border)]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
              />
            </svg>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-4 left-4">
          {isLive ? (
            <LiveBadge count={captureCount} />
          ) : isPast ? (
            <span className="editorial-label" style={{ color: "var(--editorial-text-muted)" }}>
              Ended
            </span>
          ) : (
            <span className="editorial-label" style={{ color: "var(--editorial-accent)" }}>
              Upcoming
            </span>
          )}
        </div>

        {/* Featured Badge */}
        {featured && (
          <div className="absolute top-4 right-4">
            <span
              className="px-3 py-1 text-[10px] font-semibold tracking-widest uppercase"
              style={{
                background: "var(--editorial-accent)",
                color: "var(--editorial-bg)",
              }}
            >
              Featured
            </span>
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <h3
            className={`editorial-heading text-white mb-2 ${
              featured ? "text-2xl sm:text-3xl" : "text-base"
            }`}
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
          >
            {title}
          </h3>

          {subtitle && (
            <p className="text-sm text-white/70 mb-3 line-clamp-1">{subtitle}</p>
          )}

          {/* Date/Time or Countdown */}
          <div className="flex items-center gap-4">
            {isPast ? (
              <span className="text-xs text-white/50">
                {startsDate && formatDate(startsDate)}
              </span>
            ) : isLive ? (
              <span className="text-sm text-white/80">
                {captureCount?.toLocaleString() || "0"} captures
              </span>
            ) : startsDate ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/80">
                  {formatDate(startsDate)} at {formatTime(startsDate)}
                </span>
                {startsDate > now && (
                  <CountdownTimer
                    targetDate={startsDate}
                    className="text-xs"
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

interface EventCardSkeletonProps {
  featured?: boolean;
  className?: string;
}

export function EventCardSkeleton({ featured = false, className = "" }: EventCardSkeletonProps) {
  return (
    <div
      className={`editorial-card animate-pulse ${featured ? "col-span-2" : ""} ${className}`}
    >
      <div className={`bg-[var(--editorial-border-subtle)] ${featured ? "aspect-[21/9]" : "aspect-[4/5]"}`} />
    </div>
  );
}
