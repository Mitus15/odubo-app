'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameScore, LeaderboardResponse } from '@/types/game';

interface LeaderboardTickerProps {
  active: boolean;
}

const SHOW_DURATION = 5000; // ms — how long to display
const CYCLE_INTERVAL = 35000; // ms — pause between appearances
const MAX_DISPLAY = 3; // top N scores to show

/**
 * LeaderboardTicker — Ambient top-scores display on the clips feed
 *
 * Positioned above the video title in PosterCard.
 * Fades in via gradient, shows top 3 scores for ~5s, then fades out.
 * Cycles every ~35 seconds. Only renders when clip is active.
 */
export default function LeaderboardTicker({ active }: LeaderboardTickerProps) {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [visible, setVisible] = useState(false);
  const fetchedRef = useRef(false);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch scores once on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetch(`/api/game/scores?limit=${MAX_DISPLAY}`)
      .then(res => res.json())
      .then((data: LeaderboardResponse) => {
        if (data.scores && data.scores.length > 0) {
          setScores(data.scores);
        }
      })
      .catch(() => {});
  }, []);

  // Cycle visibility
  useEffect(() => {
    if (!active || scores.length === 0) {
      setVisible(false);
      return;
    }

    const show = () => {
      setVisible(true);
      hideRef.current = setTimeout(() => setVisible(false), SHOW_DURATION);
    };

    // Initial delay before first show
    const initialDelay = setTimeout(show, 8000);

    // Recurring cycle
    cycleRef.current = setInterval(show, CYCLE_INTERVAL);

    return () => {
      clearTimeout(initialDelay);
      if (cycleRef.current) clearInterval(cycleRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
      setVisible(false);
    };
  }, [active, scores.length]);

  if (scores.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-3"
        >
          <div
            className="rounded-lg px-3 py-2 space-y-0.5"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 100%)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <div className="text-[8px] uppercase tracking-[0.15em] text-[#ede8df]/25 mb-1">Leaderboard</div>
            {scores.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-[10px]">
                <span className="text-[#ede8df]/25 font-mono w-3">{s.rank}</span>
                <span className="text-[#ede8df]/50 truncate flex-1">
                  {s.display_name || s.email.split('@')[0]}
                </span>
                <span className="text-[#ede8df]/35 font-mono">{s.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
