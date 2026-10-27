'use client';

import { useMemo, useState } from 'react';
import type { Campaign, Post } from '../page';
import { KIND_LABEL, kindOf, songOf, soundCue, type PostKind } from '@/lib/social/postQueue';
import { Marks, SongDot, dayLabel, timeLabel } from './parts';

/**
 * Library: every post's clip, song by song, in the song's colour. A tap on a
 * clip plays it here; a tap on its caption opens it in Today. Under each, the
 * caption, what it is, where the song starts, and where it stands on each app.
 */

interface LibraryViewProps {
  posts: Post[];
  campaigns: Campaign[];
  now: Date;
  onOpen: (id: string) => void;
}

const FILTERS: { key: 'all' | PostKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reels', label: 'Reels' },
  { key: 'shorts', label: 'Shorts' },
  { key: 'full', label: 'Full songs' },
];

const time = (p: Post) => (p.scheduled_at ? new Date(p.scheduled_at).getTime() : Infinity);

export default function LibraryView({ posts, campaigns, now, onOpen }: LibraryViewProps) {
  const [filter, setFilter] = useState<'all' | PostKind>('all');
  const [playing, setPlaying] = useState<string | null>(null);

  const songs = useMemo(() => {
    const kept = posts.filter((p) => p.media_url && !p.id.startsWith('feed_') && (filter === 'all' || kindOf(p) === filter));
    const groups = new Map<string, { name: string; artist?: string; colour: string; posts: Post[] }>();
    for (const p of kept) {
      const song = songOf(p, campaigns);
      const key = p.campaign_id && song ? p.campaign_id : 'other';
      const g = groups.get(key) || { name: song?.name || 'Other posts', artist: song?.artist, colour: song?.colour || 'var(--rule)', posts: [] };
      g.artist = g.artist || song?.artist;
      g.posts.push(p);
      groups.set(key, g);
    }
    // Songs in the order they first go out, each song's posts in order too
    return [...groups.values()]
      .map((g) => ({ ...g, posts: g.posts.sort((a, b) => time(a) - time(b)) }))
      .sort((a, b) => time(a.posts[0]) - time(b.posts[0]));
  }, [posts, campaigns, filter]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 pb-28">
        <nav className="sticky top-0 z-10 bg-[var(--paper)] flex gap-5 pt-3 pb-1 border-b border-[var(--rule)]" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`min-h-[40px] text-sm ${filter === f.key ? 'text-[var(--ink)] underline underline-offset-[6px] decoration-2' : 'text-[var(--muted)]'}`}
            >
              {f.label}
            </button>
          ))}
        </nav>

        {songs.length === 0 && <p className="studio-display text-2xl mt-10">Nothing here yet.</p>}

        {songs.map((g) => (
          <section key={g.name} className="mt-7">
            <h2 className="flex items-center gap-2 pb-2 border-b-2" style={{ borderColor: g.colour }}>
              <SongDot colour={g.colour} />
              <span className="studio-display text-xl">{g.name}</span>
              {g.artist && <span className="text-sm text-[var(--muted)] truncate">{g.artist}</span>}
              <span className="ml-auto font-mono text-[11px] text-[var(--muted)]">{g.posts.length}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5 mt-3">
              {g.posts.map((p) => {
                const cue = soundCue(p.notes);
                return (
                  <article key={p.id} className="min-w-0">
                    <div className="relative aspect-[9/16] overflow-hidden" style={{ background: g.colour }}>
                      {playing === p.id ? (
                        <video src={p.media_url} poster={p.thumbnail_url} controls autoPlay playsInline className="absolute inset-0 w-full h-full object-contain" />
                      ) : (
                        <button type="button" onClick={() => setPlaying(p.id)} className="absolute inset-0 w-full h-full" aria-label={`Play ${p.caption || 'the clip'}`}>
                          {p.thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                          )}
                        </button>
                      )}
                    </div>
                    <button type="button" onClick={() => onOpen(p.id)} className="mt-2 w-full text-left">
                      <span className="studio-display block text-[17px] leading-tight">{p.caption || p.title || 'Untitled'}</span>
                      <span className="block text-xs text-[var(--muted)] mt-0.5">
                        {KIND_LABEL[kindOf(p)]}
                        {p.scheduled_at && ` · ${dayLabel(p.scheduled_at, now)}, ${timeLabel(p.scheduled_at)}`}
                      </span>
                      {cue && <span className="block font-mono text-[11px] tabular-nums mt-0.5">Sound from {cue.from}</span>}
                      <Marks post={p} className="mt-1" />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
