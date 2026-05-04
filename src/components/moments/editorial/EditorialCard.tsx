"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface EditorialCardProps {
  href?: string;
  children: ReactNode;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto";
  onClick?: () => void;
}

const aspectClasses = {
  video: "aspect-video",
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  auto: "",
};

export default function EditorialCard({
  href,
  children,
  className = "",
  aspectRatio = "auto",
  onClick,
}: EditorialCardProps) {
  const cardContent = (
    <div
      className={`editorial-card ${aspectClasses[aspectRatio]} ${className}`}
      onClick={href ? undefined : onClick}
    >
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

interface EditorialCardImageProps {
  src?: string;
  alt?: string;
  children?: ReactNode;
  className?: string;
}

export function EditorialCardImage({
  src,
  alt = "",
  children,
  className = "",
}: EditorialCardImageProps) {
  if (!src) {
    return (
      <div className={`editorial-image bg-[var(--editorial-surface)] flex items-center justify-center ${className}`}>
        <svg
          className="w-12 h-12 text-[var(--editorial-border)]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`editorial-image relative ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      {children}
    </div>
  );
}

interface EditorialCardContentProps {
  children: ReactNode;
  className?: string;
}

export function EditorialCardContent({
  children,
  className = "",
}: EditorialCardContentProps) {
  return (
    <div className={`absolute inset-0 flex flex-col justify-end p-4 ${className}`}>
      {children}
    </div>
  );
}

interface EditorialCardOverlayProps {
  children: ReactNode;
  className?: string;
  intensity?: "light" | "medium" | "heavy";
}

export function EditorialCardOverlay({
  children,
  className = "",
  intensity = "medium",
}: EditorialCardOverlayProps) {
  return (
    <div className={`editorial-overlay ${className}`}>
      {children}
    </div>
  );
}
