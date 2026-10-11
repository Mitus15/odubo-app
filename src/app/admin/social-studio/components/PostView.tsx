'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Post } from '../page';
import {
  PLATFORM_LABEL,
  SAFE_ZONES,
  allPlatformsDone,
  captionFor,
  isPlatformDone,
  queueOf,
  withPlatformMark,
} from '@/lib/social/postQueue';

/**
 * Post: the week's posts in order, one open at a time, posted by hand.
 *
 * For each platform one tap copies that platform's caption and opens the
 * phone's share sheet with the video already attached (Web Share API, files),
 * so the app's own composer opens with it: pick Reels / TikTok / Shorts, paste,
 * post. A successful share ticks the platform; when every planned platform is
 * ticked the post is marked published and the next one opens. Where the
 * browser cannot share files (a desktop), the tap opens the video to save and
 * the caption is still on the clipboard.
 *
 * The video is fetched as soon as a post opens, so the share happens inside
 * the tap: iOS only allows it in direct answer to a tap, and a fetch in
 * between would spend that allowance.
 *
 * Preview: the video at phone proportions, and on request the band each app
 * draws over it (header, caption, buttons), to check the HUD and the moves
 * stay clear.
 */

interface PostViewProps {
  posts: Post[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onViewPost: (postId: string) => void;
}

type FileState = { progress: number; file?: File; error?: string };

function fileName(post: Post): string {
  const base = (post.title || post.id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || post.id}.mp4`;
}

function whenLabel(iso: string | undefined, now: Date): { text: string; late: boolean } {
  if (!iso) return { text: 'No date', late: false };
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  if (sameDay) return { text: `Today · ${time}`, late: false };
  if (d.getTime() < startToday.getTime()) {
    return { text: `Was due ${d.toLocaleDateString([], { weekday: 'short' })} · ${time}`, late: true };
  }
  return { text: `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${time}`, late: false };
}

export default function PostView({ posts, loading, onRefresh, onViewPost }: PostViewProps) {
  const [now] = useState(() => new Date());
  // Ticks made here, ahead of the next refresh: post id -> platform_status
  const [marks, setMarks] = useState<Record<string, Record<string, unknown>>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [zone, setZone] = useState<string>('clean');
  const [files, setFiles] = useState<Record<string, FileState>>({});
  const [toast, setToast] = useState<string | null>(null);
  const fetching = useRef(new Set<string>());

  const withMarks = useMemo(
    () => posts.map((p) => (marks[p.id] ? { ...p, platform_status: marks[p.id] } : p)),
    [posts, marks],
  );
  const queue = useMemo(() => queueOf(withMarks, now), [withMarks, now]);
  const ordered = useMemo(() => [...queue.due, ...queue.later, ...queue.unplanned], [queue]);

  // The first post due opens by itself
  useEffect(() => {
    if (openId === null && ordered.length > 0) setOpenId(ordered[0].id);
  }, [ordered, openId]);

  const flash = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Fetch the open post's video into memory, with progress, so a tap can share it at once
  useEffect(() => {
    const post = ordered.find((p) => p.id === openId);
    if (!post || files[post.id]?.file || fetching.current.has(post.id)) return;
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
        const type = res.headers.get('content-type') || 'video/mp4';
        const file = new File(chunks as BlobPart[], fileName(post), { type });
        setFiles((f) => ({ ...f, [post.id]: { progress: 1, file } }));
      } catch (e) {
        setFiles((f) => ({ ...f, [post.id]: { progress: 0, error: (e as Error).message } }));
      } finally {
        fetching.current.delete(post.id);
      }
    })();
  }, [openId, ordered, files]);

  const mark = useCallback(
    async (post: Post, platform: string, posted: boolean) => {
      const status = withPlatformMark(post.platform_status, platform, posted, new Date().toISOString());
      setMarks((m) => ({ ...m, [post.id]: status }));
      const finished = allPlatformsDone({ platforms: post.platforms, platform_status: status });
      try {
        await fetch(`/api/social/posts/${post.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            finished
              ? { platform_status: status, status: 'published', published_at: new Date().toISOString() }
              : { platform_status: status },
          ),
        });
        if (finished) {
          flash('Posted everywhere. Next one.');
          const next = ordered.find((p) => p.id !== post.id && !allPlatformsDone(p));
          setOpenId(next ? next.id : null);
          setZone('clean');
        }
        await onRefresh();
      } catch {
        flash('That did not save. Try again.');
      }
    },
    [flash, onRefresh, ordered],
  );

  const share = useCallback(
    async (post: Post, platform: string) => {
      const text = captionFor(post, platform);
      // Copy inside the tap, before the share sheet takes over
      try {
        navigator.clipboard?.writeText(text).catch(() => {});
      } catch {
        // clipboard unavailable: the caption is on screen to copy by hand
      }
      const file = files[post.id]?.file;
      const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      if (file && canShareFile) {
        try {
          await navigator.share({ files: [file] });
          await mark(post, platform, true);
        } catch (e) {
          if ((e as DOMException)?.name !== 'AbortError') flash('The share sheet did not open. Use Save video instead.');
        }
        return;
      }
      // No share sheet for files here (a desktop): open the video to save; the caption is copied
      window.open(post.media_url, '_blank', 'noopener');
      flash(`Caption copied. Save the video, then post to ${PLATFORM_LABEL[platform] || platform}.`);
    },
    [files, mark, flash],
  );

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        flash('Caption copied');
      } catch {
        flash('Copy did not work here. Select the caption and copy it.');
      }
    },
    [flash],
  );

  if (loading && posts.length === 0) {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#e8a990]/25 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  const section = (label: string, list: Post[]) =>
    list.length > 0 && (
      <section className="space-y-2">
        <h2 className="text-[10px] uppercase tracking-widest text-[#726d6c] px-1">{label}</h2>
        {list.map((post) => {
          const open = post.id === openId;
          const when = whenLabel(post.scheduled_at, now);
          const fileState = files[post.id];
          return (
            <article
              key={post.id}
              className={`rounded-2xl border ${open ? 'border-[#e8a990]/30 bg-[#0d0c0a]' : 'border-[#302927] bg-[#0d0c0a]/60'} overflow-hidden`}
            >
              {/* the row */}
              <button
                type="button"
                onClick={() => {
                  setOpenId(open ? null : post.id);
                  setZone('clean');
                }}
                className="w-full flex items-center gap-3 p-3 text-left"
                aria-expanded={open}
              >
                <div className="w-11 aspect-[9/16] rounded-lg overflow-hidden bg-black flex-shrink-0">
                  {post.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{post.title || post.caption || 'Untitled'}</div>
                  <div className={`text-xs mt-0.5 ${when.late ? 'text-amber-300' : 'text-[#726d6c]'}`}>{when.text}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {post.platforms.map((p) => (
                      <span
                        key={p}
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          isPlatformDone(post, p)
                            ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                            : 'border-[#302927] text-[#b8b2b1]'
                        }`}
                      >
                        {isPlatformDone(post, p) ? '✓ ' : ''}
                        {PLATFORM_LABEL[p] || p}
                      </span>
                    ))}
                  </div>
                </div>
              </button>

              {open && (
                <div className="px-3 pb-4 space-y-4">
                  {/* preview: the video at phone proportions, with an app's bands on request */}
                  <div className="relative mx-auto w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-[#302927]">
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
                      <div className="pointer-events-none absolute inset-0 text-[9px] uppercase tracking-widest text-white/70">
                        <div className="absolute inset-x-0 top-0 bg-black/45 border-b border-dashed border-white/40 flex items-end justify-center pb-1" style={{ height: `${SAFE_ZONES[zone].top * 100}%` }}>header</div>
                        <div className="absolute inset-x-0 bottom-0 bg-black/45 border-t border-dashed border-white/40 flex items-start justify-center pt-1" style={{ height: `${SAFE_ZONES[zone].bottom * 100}%` }}>caption</div>
                        <div
                          className="absolute right-0 bg-black/45 border-l border-dashed border-white/40 flex items-center justify-center [writing-mode:vertical-rl]"
                          style={{ top: `${SAFE_ZONES[zone].railTop * 100}%`, height: `${(SAFE_ZONES[zone].railBottom - SAFE_ZONES[zone].railTop) * 100}%`, width: `${SAFE_ZONES[zone].right * 100}%` }}
                        >
                          buttons
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center gap-1.5">
                    {['clean', ...post.platforms.filter((p) => SAFE_ZONES[p])].map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setZone(z)}
                        className={`text-[11px] px-3 min-h-[32px] rounded-full border ${zone === z ? 'border-[#e8a990]/50 text-[#e8a990]' : 'border-[#302927] text-[#726d6c]'}`}
                      >
                        {z === 'clean' ? 'Clean' : `${SAFE_ZONES[z].label} view`}
                      </button>
                    ))}
                  </div>

                  {post.notes && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-100/90 leading-relaxed">
                      {post.notes}
                    </div>
                  )}

                  {/* the caption, as it will be pasted */}
                  <button
                    type="button"
                    onClick={() => copy(captionFor(post, post.platforms[0] || ''))}
                    className="w-full text-left p-3 rounded-xl bg-black border border-[#302927]"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-[#726d6c] mb-1">Caption · tap to copy</div>
                    <div className="text-sm text-[#b8b2b1] whitespace-pre-wrap select-text">{captionFor(post, post.platforms[0] || '')}</div>
                  </button>

                  {/* one row per platform: share, then it is ticked */}
                  <div className="space-y-2">
                    {fileState && !fileState.file && !fileState.error && (
                      <div className="h-1 rounded-full bg-[#302927] overflow-hidden" aria-label="Getting the video ready">
                        <div className="h-full bg-[#e8a990]/70 transition-[width]" style={{ width: `${Math.round(fileState.progress * 100)}%` }} />
                      </div>
                    )}
                    {fileState?.error && <p className="text-xs text-red-300/80">{fileState.error}. Save video still works.</p>}
                    {post.platforms.map((p) => {
                      const done = isPlatformDone(post, p);
                      const ready = !!fileState?.file;
                      return (
                        <div key={p} className="flex items-center gap-3">
                          {done ? (
                            <>
                              <div className="flex-1 min-h-[48px] flex items-center px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm">
                                ✓ Posted to {PLATFORM_LABEL[p] || p}
                              </div>
                              <button type="button" onClick={() => mark(post, p, false)} className="min-h-[48px] px-3 text-xs text-[#726d6c]">
                                Undo
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => share(post, p)}
                                disabled={!ready && !fileState?.error}
                                className="flex-1 min-h-[48px] rounded-xl bg-[#ede8df] text-black text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
                              >
                                {ready || fileState?.error ? `Share to ${PLATFORM_LABEL[p] || p}` : 'Getting the video ready'}
                              </button>
                              <button type="button" onClick={() => mark(post, p, true)} className="min-h-[48px] px-3 text-xs text-[#726d6c]">
                                Done
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <a href={post.media_url} target="_blank" rel="noopener noreferrer" className="min-h-[44px] flex items-center text-[#726d6c] hover:text-white">
                      Save video
                    </a>
                    <button type="button" onClick={() => onViewPost(post.id)} className="min-h-[44px] text-[#726d6c] hover:text-white">
                      Details
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    );

  const dueCount = queue.due.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-6 pb-24 space-y-6 max-w-lg mx-auto">
        <header>
          <h1 className="text-xl font-medium text-white">Post</h1>
          <p className="text-sm text-[#726d6c] mt-1">
            {dueCount > 0
              ? `${dueCount} to post today. Tap Share: the caption is copied and the app opens with the video.`
              : ordered.length > 0
              ? 'Nothing due today. The next ones are below.'
              : 'Nothing planned. Plan posts in the calendar.'}
          </p>
        </header>

        {section('Today', queue.due)}
        {section('Coming up', queue.later)}
        {section('No date', queue.unplanned)}

        {queue.postedToday.length > 0 && (
          <section className="space-y-1">
            <h2 className="text-[10px] uppercase tracking-widest text-[#726d6c] px-1">Posted today</h2>
            {queue.postedToday.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-1 text-sm text-emerald-300/80">
                <span>✓</span>
                <span className="truncate">{p.title || p.caption}</span>
              </div>
            ))}
          </section>
        )}
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-2.5 rounded-full bg-[#1a1714] border border-[#302927] text-sm text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
