'use client';

import { useState, useCallback } from 'react';
import type { ScoreSubmitResponse } from '@/types/game';

interface ScoreSubmissionProps {
  score: number;
  level: number;
  linesCleared: number;
  durationSeconds: number;
  onSubmitted: (rank: number) => void;
}

export default function ScoreSubmission({
  score,
  level,
  linesCleared,
  durationSeconds,
  onSubmitted,
}: ScoreSubmissionProps) {
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/game/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          instagram_handle: instagram.trim() || undefined,
          score,
          level,
          lines_cleared: linesCleared,
          game_duration_seconds: durationSeconds,
        }),
      });

      const data = await res.json() as ScoreSubmitResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit score');
      }

      onSubmitted(data.rank);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }, [email, instagram, score, level, linesCleared, durationSeconds, submitting, onSubmitted]);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[280px] space-y-3">
      <p className="text-xs text-[#ede8df]/40 text-center">Save your score to the leaderboard</p>

      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(null); }}
        placeholder="Your email"
        required
        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-[#ede8df] text-sm placeholder:text-[#ede8df]/25 outline-none focus:border-[#843c2d]/40 transition-colors"
      />

      <input
        type="text"
        value={instagram}
        onChange={(e) => setInstagram(e.target.value)}
        placeholder="@instagram (optional)"
        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-[#ede8df] text-sm placeholder:text-[#ede8df]/25 outline-none focus:border-[#843c2d]/40 transition-colors"
      />

      {error && (
        <p className="text-xs text-red-400/70 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-xl text-sm font-medium text-[#ede8df]/80 transition-all active:scale-95 disabled:opacity-50 bg-white/5 border border-white/8 hover:bg-white/10"
      >
        {submitting ? 'Saving...' : 'Save Score'}
      </button>
    </form>
  );
}
