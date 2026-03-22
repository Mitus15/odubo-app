'use client';

import { useEffect, useState } from 'react';
import type { GameScore, LeaderboardResponse } from '@/types/game';

interface LeaderboardProps {
  highlightRank: number | null;
  compact?: boolean;
}

export default function Leaderboard({ highlightRank, compact = false }: LeaderboardProps) {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/game/scores?limit=${compact ? 10 : 20}`)
      .then(res => res.json())
      .then((data: LeaderboardResponse) => setScores(data.scores || []))
      .catch(() => setScores([]))
      .finally(() => setLoading(false));
  }, [compact]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-5 h-5 border-2 border-[#843c2d]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-[#ede8df]/30">No scores yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center px-3 py-2 text-[9px] uppercase tracking-widest text-[#ede8df]/25 border-b border-white/5">
        <span className="w-8">#</span>
        <span className="flex-1">Player</span>
        <span className="w-16 text-right">Score</span>
      </div>

      {/* Rows */}
      <div className={compact ? 'max-h-[240px] overflow-y-auto' : 'max-h-[360px] overflow-y-auto'}>
        {scores.map((s) => {
          const isHighlighted = highlightRank !== null && s.rank === highlightRank;
          return (
            <div
              key={s.id}
              className={`flex items-center px-3 py-2 text-xs transition-colors ${
                isHighlighted
                  ? 'bg-[#843c2d]/15 border-l-2 border-[#843c2d]'
                  : 'border-l-2 border-transparent'
              }`}
            >
              <span className={`w-8 font-mono ${isHighlighted ? 'text-[#ede8df]/80' : 'text-[#ede8df]/30'}`}>
                {s.rank}
              </span>
              <span className={`flex-1 truncate ${isHighlighted ? 'text-[#ede8df]' : 'text-[#ede8df]/60'}`}>
                {s.display_name || s.email.split('@')[0]}
              </span>
              <span className={`w-16 text-right font-mono ${isHighlighted ? 'text-[#ede8df]' : 'text-[#ede8df]/50'}`}>
                {s.score.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
