"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  targetDate: Date | string;
  className?: string;
  onComplete?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function CountdownTimer({
  targetDate,
  className = "",
  onComplete,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const target =
      typeof targetDate === "string" ? new Date(targetDate) : targetDate;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = target.getTime() - now;

      if (difference <= 0) {
        setIsComplete(true);
        onComplete?.();
        return null;
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const result = calculateTimeLeft();
      setTimeLeft(result);
      if (!result) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (isComplete) {
    return (
      <div className={`editorial-countdown ${className}`}>
        <span style={{ color: 'var(--editorial-accent)' }}>Starting now</span>
      </div>
    );
  }

  if (!timeLeft) {
    return null;
  }

  const formatNumber = (num: number) => num.toString().padStart(2, "0");

  return (
    <div className={`editorial-countdown ${className}`}>
      {timeLeft.days > 0 && (
        <>
          <div className="editorial-countdown-unit">
            <span className="editorial-countdown-value">{timeLeft.days}</span>
            <span className="editorial-countdown-label">Days</span>
          </div>
          <span>:</span>
        </>
      )}
      <div className="editorial-countdown-unit">
        <span className="editorial-countdown-value">{formatNumber(timeLeft.hours)}</span>
        <span className="editorial-countdown-label">Hrs</span>
      </div>
      <span>:</span>
      <div className="editorial-countdown-unit">
        <span className="editorial-countdown-value">{formatNumber(timeLeft.minutes)}</span>
        <span className="editorial-countdown-label">Min</span>
      </div>
      <span>:</span>
      <div className="editorial-countdown-unit">
        <span className="editorial-countdown-value">{formatNumber(timeLeft.seconds)}</span>
        <span className="editorial-countdown-label">Sec</span>
      </div>
    </div>
  );
}
