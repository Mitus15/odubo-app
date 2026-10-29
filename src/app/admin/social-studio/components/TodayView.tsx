'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Campaign, Post } from '../page';
import {
  KIND_LABEL,
  PLATFORM_LABEL,
  SAFE_ZONES,
  allPlatformsDone,
  captionFor,
  kindOf,
  platformState,
  queueOf,
  sendsByApi,
  songOf,
  soundCue,
} from '@/lib/social/postQueue';
import { youtubeDetails } from '@/lib/social/appLink';
import { Marks, SongDot, Thumb, countLabel, dayKey, dayLabel, timeLabel } from './parts';

/**
 * Today: the front door. The next post to make, one at a time: the video at
 * phone size, where to start the song, the caption to paste, and one button
 * for the app it goes to next. Then what comes after, as a short list.
 *
 * Instagram Reels, TikTok and YouTube Shorts are posted by hand with the app's
 * own sound: the button copies the caption and opens the phone's share sheet
 * with the video attached (the video is fetched when the post opens, because
 * iOS lets a page share only in direct answer to a tap). A TikTok can instead
 * go to his TikTok drafts through Post for Me, and a full song (the song laid
 * in) is scheduled on YouTube the same way, after he confirms its title.
 * What goes out by hand is ticked by the share, or by the app's feed once the
 * Studio sees it (api/social/feeds).
 */

export interface SendDetails {
  title?: string;
  description?: string;
}

interface TodayViewProps {
  posts: Post[];
  campaigns: Campaign[];
  loading: boolean;
  now: Date;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onMark: (post: Post, platform: string, posted: boolean) => Promise<boolean>;
  onSend: (post: Post, platform: string, details?: SendDetails) => Promise<{ ok: boolean; error?: string }>;
  onDetails: (id: string) => void;
  onSchedule: () => void;
}

type FileState = { progress: number; file?: File; error?: string };

/** The note's standard instruction, said shorter: the cue above already gives the time. */
const STANDARD_HOW = /^Add the song in the app from that time/;
/** The note's last line: the day it was filmed and the file it came from */
const FILE_LINE = /^[A-Z][a-z]{2} \d{1,2} · \d{4}-/;

function fileName(post: Post): string {
  const base = (post.title || post.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base || post.id}.mp4`;
}

export default function TodayView({
  posts,
  campaigns,
  loading,
  now,
  openId,
  onOpen,
  onMark,
  onSend,
  onDetails,
  onSchedule,
}: TodayViewProps) {
  const [zone, setZone] = useState('clean');
  const [files, setFiles] = useState<Record<string, FileState>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [youtubeSheet, setYoutubeSheet] = useState<SendDetails | null>(null);
  const fetching = useRef(new Set<string>());
  const scroller = useRef<HTMLDivElement>(null);

  const queue = useMemo(() => queueOf(posts, now), [posts, now]);
  const ordered = useMemo(() => [...queue.due, ...queue.later, ...queue.unplanned], [queue]);
  // One opened from the Schedule, the Library or Out today may be out already: it opens all the same, to Undo a tick
  const post =
    ordered.find((p) => p.id === openId) ||
    posts.find((p) => p.id === openId && p.media_url) ||
    ordered.find((p) => !allPlatformsDone(p)) ||
    null;

  const flash = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2600);
  }, []);

  // A new post opens at its video
  useEffect(() => {
    setZone('clean');
    setCopied(false);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [post?.id]);

  // The open post's video, fetched into memory so a tap can share it at once.
  // Once per post: a failed fetch stays failed (Save video still works)
  // rather than trying again on every render.
  useEffect(() => {
    if (!post || post.media_type !== 'video' || allPlatformsDone(post) || files[post.id] || fetching.current.has(post.id)) return;
    if (post.platforms.every((p) => sendsByApi(post, p))) return; // nothing to share by hand
    fetching.current.add(post.id);
    (async () => {
      try {
        // Stream's download link redirects without the cross-origin header; the
        // server resolves it to the signed link, which the browser can fetch.
        let src = post.media_url;
        try {
          const r = await fetch(`/api/social/media?src=${encodeURIComponent(src)}`);
          if (r.ok) src = ((await r.json()) as { url?: string }).url || src;
        } catch {
          // fall back to the link itself
        }
        const res = await fetch(src);
        if (!res.ok || !res.body) throw new Error(`The video did not load (${res.status})`);
        const total = Number(res.headers.get('content-length')) || 0;
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          got += value.length;
          if (total) setFiles((f) => ({ ...f, [post.id]: { progress: got / total } }));
        }
        const file = new File(chunks as BlobPart[], fileName(post), { type: res.headers.get('content-type') || 'video/mp4' });
        setFiles((f) => ({ ...f, [post.id]: { progress: 1, file } }));
      } catch (e) {
        setFiles((f) => ({ ...f, [post.id]: { progress: 0, error: (e as Error).message } }));
      } finally {
        fetching.current.delete(post.id);
      }
    })();
  }, [post, files]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      flash('Copy did not work here. Hold the caption to copy it.');
    }
  }, [flash]);

  const tick = useCallback(
    async (p: Post, platform: string, posted: boolean) => {
      const ok = await onMark(p, platform, posted);
      if (!ok) return flash('That did not save. Try again.');
      const after = { ...p, platform_status: { ...(p.platform_status || {}), [platform]: { posted } } };
      if (posted && allPlatformsDone(after)) {
        flash('Out everywhere. Next one.');
        const next = ordered.find((x) => x.id !== p.id && !allPlatformsDone(x));
        onOpen(next ? next.id : null);
      }
    },
    [onMark, onOpen, ordered, flash],
  );

  const share = useCallback(
    async (p: Post, platform: string) => {
      // Copy inside the tap, before the share sheet takes over
      navigator.clipboard?.writeText(captionFor(p, platform)).catch(() => {});
      const file = files[p.id]?.file;
      if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          await tick(p, platform, true);
        } catch (e) {
          if ((e as DOMException)?.name !== 'AbortError') flash('The share sheet did not open. Save the video instead.');
        }
        return;
      }
      // No share sheet for files here (a desktop): open the video to save; the caption is copied
      window.open(p.media_url, '_blank', 'noopener');
      flash(`Caption copied. Save the video, then post it to ${PLATFORM_LABEL[platform] || platform}.`);
    },
    [files, tick, flash],
  );

  const send = useCallback(
    async (p: Post, platform: string, details?: SendDetails) => {
      setBusy(platform);
      if (platform === 'tiktok') navigator.clipboard?.writeText(captionFor(p, platform)).catch(() => {});
      const result = await onSend(p, platform, details);
      setBusy(null);
      setYoutubeSheet(null);
      flash(
        result.ok
          ? platform === 'tiktok'
            ? 'In your TikTok drafts. Caption copied.'
            : 'Scheduled on YouTube.'
          : result.error || 'The app did not take it.',
      );
    },
    [onSend, flash],
  );

  if (loading && posts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--rule)] border-t-[var(--text)] animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-10 pb-24">
          <p className="studio-eyebrow">{dayLabel(now.toISOString(), now)}</p>
          <h1 className="studio-display text-3xl mt-2">Nothing to post.</h1>
          <button type="button" onClick={onSchedule} className="mt-6 min-h-[44px] text-sm underline underline-offset-4">
            See the schedule
          </button>
        </div>
      </div>
    );
  }

  const song = songOf(post, campaigns);
  const colour = song?.colour || 'var(--text)';
  const kind = kindOf(post);
  const cue = soundCue(post.notes);
  const lines = (cue ? cue.rest : (post.notes || '').split('\n'))
    .map((l) => l.trim())
    .filter((l) => l && !FILE_LINE.test(l) && !(song && l.startsWith(`${song.name} · `)));
  const file = files[post.id];
  const ready = !!file?.file || !!file?.error;
  const firstTodo = post.platforms.find((p) => platformState(post, p).kind === 'todo' || platformState(post, p).kind === 'failed');
  const caption = captionFor(post, post.platforms[0] || '');
  const due = post.scheduled_at ? new Date(post.scheduled_at) : null;

  // What comes after: everything due, then the next three days
  const horizon = new Date(now);
  horizon.setDate(now.getDate() + 3);
  horizon.setHours(23, 59, 59, 999);
  const after = ordered.filter(
    (p) => p.id !== post.id && !allPlatformsDone(p) && p.scheduled_at && new Date(p.scheduled_at).getTime() <= horizon.getTime(),
  );
  const days = new Map<string, Post[]>();
  for (const p of after) {
    const k = dayKey(p.scheduled_at!);
    days.set(k, [...(days.get(k) || []), p]);
  }

  return (
    <div ref={scroller} className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 pt-5 pb-28">
        <header className="flex items-baseline justify-between gap-3">
          <p className="studio-eyebrow">
            {post.scheduled_at ? dayLabel(post.scheduled_at, now) : 'No date'}
          </p>
          <p className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {post.scheduled_at && `${timeLabel(post.scheduled_at)} · `}
            {KIND_LABEL[kind]}
          </p>
        </header>

        {/* the video at phone size, on the song's colour */}
        <div className="mt-4 mx-auto w-[min(68vw,300px)]">
          <div className="relative aspect-[9/16] overflow-hidden" style={{ background: colour }}>
            {post.media_type === 'video' ? (
              <video
                key={post.id}
                src={post.media_url}
                poster={post.thumbnail_url}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.media_url} alt="" className="absolute inset-0 w-full h-full object-contain" />
            )}
            {SAFE_ZONES[zone] && (
              <div className="pointer-events-none absolute inset-0 text-[9px] uppercase tracking-widest text-white/80">
                <div className="absolute inset-x-0 top-0 bg-black/45 border-b border-dashed border-white/50 flex items-end justify-center pb-1" style={{ height: `${SAFE_ZONES[zone].top * 100}%` }}>header</div>
                <div className="absolute inset-x-0 bottom-0 bg-black/45 border-t border-dashed border-white/50 flex items-start justify-center pt-1" style={{ height: `${SAFE_ZONES[zone].bottom * 100}%` }}>caption</div>
                <div
                  className="absolute right-0 bg-black/45 border-l border-dashed border-white/50 flex items-center justify-center [writing-mode:vertical-rl]"
                  style={{ top: `${SAFE_ZONES[zone].railTop * 100}%`, height: `${(SAFE_ZONES[zone].railBottom - SAFE_ZONES[zone].railTop) * 100}%`, width: `${SAFE_ZONES[zone].right * 100}%` }}
                >
                  buttons
                </div>
              </div>
            )}
          </div>
          {post.platforms.some((p) => SAFE_ZONES[p]) && (
            <div className="flex justify-center gap-4 mt-1 text-[11px]">
              {['clean', ...post.platforms.filter((p) => SAFE_ZONES[p])].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZone(z)}
                  aria-pressed={zone === z}
                  className={`min-h-[36px] ${zone === z ? 'text-[var(--text)] underline underline-offset-4' : 'text-[var(--text-muted)]'}`}
                >
                  {z === 'clean' ? 'Clean' : `As on ${SAFE_ZONES[z].label}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* the caption, as it will be pasted: tap to copy */}
        <button type="button" onClick={() => copy(caption)} className="mt-5 w-full text-left group" aria-label="Copy the caption">
          <span className="studio-display block text-[30px] leading-[1.1] select-text whitespace-pre-wrap">{caption || 'No caption'}</span>
          <span className="studio-eyebrow block mt-1">{copied ? 'Copied' : 'Tap to copy'}</span>
        </button>
        {song && (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <SongDot colour={song.colour} />
            <span>{song.name}{song.artist && <span className="text-[var(--text-muted)]"> · {song.artist}</span>}</span>
          </p>
        )}

        {/* where the song starts */}
        {cue && (
          <div className="mt-5 pt-4 border-t border-[var(--rule)]">
            <p className="studio-eyebrow">Start the sound at</p>
            <p className="flex items-baseline gap-3">
              <span className="studio-display text-[64px] leading-none tabular-nums select-text">{cue.from}</span>
              {cue.to && <span className="font-mono text-sm tabular-nums text-[var(--text-muted)]">to {cue.to}</span>}
            </p>
            {cue.extra && <p className="text-xs text-[var(--text-muted)] mt-1">{cue.extra}</p>}
          </div>
        )}
        {lines.length > 0 && (
          <div className="mt-3 text-sm text-[var(--text-muted)] space-y-0.5">
            {lines.map((l, i) => (
              <p key={i}>{STANDARD_HOW.test(l) ? 'Then the original sound to 0.' : l.replace(/^Song laid in: (\S+ to \S+).*$/, 'The song is in the video, $1.')}</p>
            ))}
          </div>
        )}

        {/* the apps, in order: the next one is the one drawn button */}
        <div className="mt-6 border-t border-[var(--rule)]">
          {file && !file.file && !file.error && (
            <div className="h-0.5 bg-[var(--rule)]" aria-label="Getting the video ready">
              <div className="h-full bg-[var(--text)] transition-[width]" style={{ width: `${Math.round(file.progress * 100)}%` }} />
            </div>
          )}
          {post.platforms.map((p) => {
            const state = platformState(post, p);
            const label = PLATFORM_LABEL[p] || p;
            const api = sendsByApi(post, p);
            const primary = p === firstTodo;
            if (state.kind === 'posted') {
              return (
                <div key={p} className="flex items-center gap-3 min-h-[56px] border-b border-[var(--rule)]">
                  <span className="flex-1 text-[15px]">
                    <span className="text-[var(--ok)]">✓</span> {label}
                    {state.at && <span className="text-[var(--text-muted)] text-sm"> · {timeLabel(state.at)}</span>}
                    {state.views !== undefined && <span className="text-[var(--text-muted)] text-sm"> · {countLabel(state.views)} views</span>}
                  </span>
                  {state.url && (
                    <a href={state.url} target="_blank" rel="noopener noreferrer" className="min-h-[44px] flex items-center text-sm underline underline-offset-4">
                      Open
                    </a>
                  )}
                  <button type="button" onClick={() => tick(post, p, false)} className="min-h-[44px] text-sm text-[var(--text-muted)]">
                    Undo
                  </button>
                </div>
              );
            }
            if (state.kind === 'scheduled' || state.kind === 'drafted') {
              return (
                <div key={p} className="flex items-center gap-3 min-h-[56px] border-b border-[var(--rule)]">
                  <span className="flex-1 text-[15px]">
                    <span className="text-[var(--text-muted)]">◷</span> {label}
                    <span className="text-[var(--text-muted)] text-sm">
                      {state.kind === 'scheduled'
                        ? ` · goes out ${state.at ? `${dayLabel(state.at, now)}, ${timeLabel(state.at)}` : 'soon'}`
                        : ' · in your drafts: add the sound, post'}
                    </span>
                  </span>
                  <button type="button" onClick={() => tick(post, p, true)} className="min-h-[44px] text-sm text-[var(--text-muted)]">
                    It’s out
                  </button>
                </div>
              );
            }
            return (
              <div key={p} className="py-3 border-b border-[var(--rule)]">
                {state.kind === 'failed' && <p className="text-sm text-[var(--warn)] mb-2">{label} did not take it: {state.error}</p>}
                <div className="flex items-center gap-3">
                  {api ? (
                    <button
                      type="button"
                      disabled={busy === p}
                      onClick={() => setYoutubeSheet(youtubeDetails(post, campaigns))}
                      className={primary ? 'flex-1 min-h-[52px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[15px] font-medium active:scale-[0.98] transition-transform disabled:opacity-50' : 'flex-1 min-h-[44px] text-left text-[15px] underline underline-offset-4'}
                    >
                      {busy === p ? 'Sending…' : `Schedule on ${label}${due ? ` · ${timeLabel(due.toISOString())}` : ''}`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => share(post, p)}
                      disabled={!ready}
                      className={primary ? 'flex-1 min-h-[52px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[15px] font-medium active:scale-[0.98] transition-transform disabled:opacity-50' : 'flex-1 min-h-[44px] text-left text-[15px] underline underline-offset-4 disabled:opacity-50'}
                    >
                      {ready ? `Post to ${label}` : 'Getting the video ready…'}
                    </button>
                  )}
                  <button type="button" onClick={() => tick(post, p, true)} className="min-h-[44px] text-sm text-[var(--text-muted)]">
                    Posted
                  </button>
                </div>
                {p === 'tiktok' && !api && (
                  <button type="button" disabled={busy === p} onClick={() => send(post, p)} className="mt-1 min-h-[40px] text-sm text-[var(--text-muted)] underline underline-offset-4 disabled:opacity-50">
                    {busy === p ? 'Sending to TikTok…' : 'Or send it to your TikTok drafts'}
                  </button>
                )}
              </div>
            );
          })}
          {file?.error && <p className="mt-2 text-xs text-[var(--text-muted)]">{file.error}. Save video still works.</p>}
        </div>

        <div className="flex items-center gap-6 mt-2 text-sm text-[var(--text-muted)]">
          <a href={post.media_url} target="_blank" rel="noopener noreferrer" className="min-h-[44px] flex items-center">
            Save video
          </a>
          <button type="button" onClick={() => onDetails(post.id)} className="min-h-[44px]">
            Details
          </button>
        </div>

        {/* what comes after */}
        {days.size > 0 && (
          <section className="mt-8">
            <h2 className="studio-eyebrow">Next</h2>
            {[...days.entries()].map(([k, list]) => (
              <div key={k} className="mt-3">
                <p className="studio-eyebrow pb-1 border-b border-[var(--text)] !text-[var(--text)]">{dayLabel(list[0].scheduled_at!, now)}</p>
                {list.map((p) => {
                  const s = songOf(p, campaigns);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpen(p.id)}
                      className="w-full flex items-center gap-3 py-2 border-b border-[var(--rule)] text-left min-h-[56px]"
                    >
                      <span className="font-mono text-xs tabular-nums w-[58px] text-[var(--text-muted)]">{timeLabel(p.scheduled_at!)}</span>
                      <Thumb src={p.thumbnail_url} colour={s?.colour || 'var(--raised)'} className="w-8" />
                      <span className="flex-1 min-w-0">
                        <span className="studio-display block text-base truncate">{p.caption || p.title}</span>
                        <span className="block text-xs text-[var(--text-muted)] truncate">
                          {s?.name}
                          {s && ' · '}
                          {KIND_LABEL[kindOf(p)]}
                        </span>
                      </span>
                      <Marks post={p} />
                    </button>
                  );
                })}
              </div>
            ))}
            <button type="button" onClick={onSchedule} className="mt-4 min-h-[44px] text-sm underline underline-offset-4">
              The whole schedule
            </button>
          </section>
        )}

        {queue.postedToday.length > 0 && (
          <section className="mt-8">
            <h2 className="studio-eyebrow">Out today</h2>
            {queue.postedToday.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p.id)}
                className="w-full flex items-center gap-2 py-2 border-b border-[var(--rule)] text-sm text-left min-h-[44px]"
              >
                <span className="text-[var(--ok)]">✓</span>
                <span className="flex-1 truncate">{p.caption || p.title}</span>
                <Marks post={p} />
              </button>
            ))}
          </section>
        )}
      </div>

      {youtubeSheet && (
        <YouTubeSheet
          details={youtubeSheet}
          when={due && due.getTime() > Date.now() ? `${dayLabel(due.toISOString(), now)}, ${timeLabel(due.toISOString())}` : 'now'}
          busy={busy === 'youtube'}
          onChange={setYoutubeSheet}
          onClose={() => setYoutubeSheet(null)}
          onConfirm={() => send(post, 'youtube', youtubeSheet)}
        />
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 px-4 py-2.5 rounded-full bg-[var(--text)] text-[var(--ground)] text-sm shadow-lg max-w-[90vw] text-center" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/** What goes up on YouTube, to read and change before it is sent. Public, at the post's time. */
function YouTubeSheet({
  details,
  when,
  busy,
  onChange,
  onClose,
  onConfirm,
}: {
  details: SendDetails;
  when: string;
  busy: boolean;
  onChange: (d: SendDetails) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="Schedule on YouTube">
      <div className="studio w-full sm:max-w-md bg-[var(--ground)] px-4 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <p className="studio-eyebrow">YouTube · public · {when}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 flex items-center justify-center text-xl">
            ×
          </button>
        </div>
        <label className="block mt-2 text-xs text-[var(--text-muted)]" htmlFor="yt-title">Title</label>
        <input
          id="yt-title"
          value={details.title || ''}
          maxLength={100}
          onChange={(e) => onChange({ ...details, title: e.target.value })}
          className="studio-display w-full text-xl bg-transparent border-b border-[var(--rule)] py-2 outline-none focus:border-[var(--text)]"
        />
        <label className="block mt-4 text-xs text-[var(--text-muted)]" htmlFor="yt-description">Description</label>
        <textarea
          id="yt-description"
          value={details.description || ''}
          rows={3}
          onChange={(e) => onChange({ ...details, description: e.target.value })}
          className="w-full text-[15px] bg-transparent border-b border-[var(--rule)] py-2 outline-none focus:border-[var(--text)] resize-none"
        />
        <button
          type="button"
          disabled={busy || !details.title?.trim()}
          onClick={onConfirm}
          className="mt-5 w-full min-h-[52px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[15px] font-medium disabled:opacity-50"
        >
          {busy ? 'Sending to YouTube…' : 'Schedule it'}
        </button>
      </div>
    </div>
  );
}
