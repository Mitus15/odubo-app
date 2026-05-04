"use client";

import { useEffect, useState } from "react";

interface FilmGrainProps {
  opacity?: number;
  className?: string;
}

export default function FilmGrain({ opacity = 0.03, className = "" }: FilmGrainProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsVisible(!mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsVisible(!e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`editorial-grain pointer-events-none fixed inset-0 z-[9999] ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
