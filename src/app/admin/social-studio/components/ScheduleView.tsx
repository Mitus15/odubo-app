'use client';

import { useMemo, useState } from 'react';
import type { Campaign, Post } from '../page';
import { KIND_LABEL, kindOf, songOf } from '@/lib/social/postQueue';
import { Marks, Thumb, dayKey, dayLabel, timeLabel } from './parts';

/**
 * Schedule: every planned post, day by day, from today on (the days before
 * one tap away). Each row is the time, the song's colour, the clip, the
 * caption and a mark per app; a tap opens the post in Today, where it is
 * posted.
 */

interface ScheduleViewProps {
  posts: Post[];
  campaigns: Campaign[];
  now: Date;
  onOpen: (id: string) => void;
}

/** Imported from an app's feed, not planned here: shown on the post they belong to, not as posts of their own */
const isFeedCopy = (p: Post) => p.id.startsWith('feed_');

export default function ScheduleView({ posts, campaigns, now, onOpen }: ScheduleViewProps) {
  const [earlier, setEarlier] = useState(false);
  const today = dayKey(now.toISOString());

  const days = useMemo(() => {
    const planned = posts
      .filter((p) => p.scheduled_at && !isFeedCopy(p))
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    const map = new Map<string, Post[]>();
    for (const p of planned) {
      const k = dayKey(p.scheduled_at!);
      map.set(k, [...(map.get(k) || []), p]);
    }
    return [...map.entries()];
  }, [posts]);

  const past = days.filter(([k]) => k < today);
  const shown = earlier ? days : days.filter(([k]) => k >= today);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 pb-28">
        {past.length > 0 && (
          <button type="button" onClick={() => setEarlier(!earlier)} className="mt-3 min-h-[44px] text-sm text-[var(--muted)] underline underline-offset-4">
            {earlier ? 'Hide the days before today' : `The days before today (${past.length})`}
          </button>
        )}
        {shown.length === 0 && <p className="studio-display text-2xl mt-10">Nothing planned.</p>}
        {shown.map(([k, list]) => (
          <section key={k}>
            <h2 className="sticky top-0 z-10 bg-[var(--paper)] pt-4 pb-1 border-b border-[var(--ink)] flex items-baseline justify-between">
              <span className="text-[11px] tracking-[0.2em] uppercase">{dayLabel(list[0].scheduled_at!, now)}</span>
              <span className="font-mono text-[11px] text-[var(--muted)]">{list.length}</span>
            </h2>
            {list.map((p) => {
              const song = songOf(p, campaigns);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="w-full flex items-center gap-3 py-2 border-b border-[var(--rule)] text-left min-h-[72px]"
                >
                  <span className="font-mono text-xs tabular-nums w-[58px] text-[var(--muted)]">{timeLabel(p.scheduled_at!)}</span>
                  <span className="w-1 self-stretch flex-shrink-0" style={{ background: song?.colour || 'var(--rule)' }} />
                  <Thumb src={p.thumbnail_url} colour={song?.colour || 'var(--wash)'} className="w-9" />
                  <span className="flex-1 min-w-0">
                    <span className="studio-display block text-[17px] leading-tight truncate">{p.caption || p.title || 'Untitled'}</span>
                    <span className="block text-xs text-[var(--muted)] truncate mt-0.5">
                      {song ? `${song.name} · ` : ''}
                      {KIND_LABEL[kindOf(p)]}
                    </span>
                  </span>
                  <Marks post={p} className="flex-col items-end gap-0.5" />
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
