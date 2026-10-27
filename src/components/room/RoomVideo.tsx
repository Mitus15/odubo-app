'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { attachHls, type HlsHandle } from '@/lib/hlsPlayer';
import RoomHud, { type HudSpec } from './RoomHud';

/**
 * A level in its room: the video, silent (lib/levels: the site never plays
 * the song), contained and unframed, so its field runs into the room's own
 * colour behind it (lib/room) and only the dancer is seen.
 *
 * The still is there at first paint, before any script: the copy's first
 * frame at full size (lib/levels). The video takes its place only once it
 * plays sharp, so the visitor never sees a blurry start; on a connection too
 * slow for that, it takes over anyway after a few seconds. Only a room near
 * the one on screen holds a stream, and only the one on screen plays, so a
 * long feed costs one video; the one on screen keeps half a minute ahead, the
 * ones beside it only their start (lib/hlsPlayer). A tap pauses or plays;
 * with reduced motion asked for, it waits for the tap.
 *
 * The room a visitor lands in (`early`) starts its stream from the page
 * itself, on Apple's player, before any of the site's code has come: on a weak
 * line that code is seconds of waiting, and he stands still through all of
 * it. The component takes the stream over as it is once the code is there.
 */
/** How long the still waits for a sharp picture before the video takes over regardless */
const SHARP_WAIT_MS = 5000;

/**
 * The page's own start for the room it opens on, run as the page is read: on
 * Apple's player (iPhone, iPad, Safari, the apps' browsers), silent, from the
 * still's moment. Everywhere else the stream waits for hls.js (lib/hlsPlayer).
 */
function earlyStart(hls: string, startAt: number): string {
  return `(function(v){try{if(!v||!/apple/i.test(navigator.vendor||'')||!v.canPlayType('application/vnd.apple.mpegurl')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;var at=${Number(startAt) || 0};v.muted=true;if(at)v.addEventListener('loadedmetadata',function(){if(v.currentTime<at)v.currentTime=at},{once:true});v.src=${JSON.stringify(hls)};v.play().catch(function(){})}catch(e){}})(document.currentScript&&document.currentScript.previousElementSibling)`;
}

/** Sharp enough to replace the still: most of the height the frame is drawn at on this screen (a 720p level on a phone) */
function playsSharp(video: HTMLVideoElement): boolean {
  if (!video.videoHeight) return false;
  return video.videoHeight >= Math.min(1080, video.clientHeight * (window.devicePixelRatio || 1) * 0.75);
}

export default function RoomVideo({
  hls,
  poster,
  title,
  active = true,
  near = true,
  className = 'relative',
  style,
  tapToPause = true,
  hud,
  startAt = 0,
  early = false,
  onShown,
}: {
  /** Null: there is no site copy yet, so the still alone, and nothing streams */
  hls: string | null;
  poster: string;
  title: string;
  /** On screen: plays */
  active?: boolean;
  /** Next to the one on screen: holds its stream, ready */
  near?: boolean;
  /** Positioned: 'relative' with a size, or 'absolute' with its edges */
  className?: string;
  style?: CSSProperties;
  /** False: a tap belongs to what holds the video (the main page opens the focused view) */
  tapToPause?: boolean;
  /** The game's layer, drawn by the site over the clean copy (the focused view); none on the main page */
  hud?: HudSpec;
  /** Seconds in the still is from, where the video starts (the level's posterAt) */
  startAt?: number;
  /** The room the page opens on: its stream starts from the page, before the code (above) */
  early?: boolean;
  /** Once the video has taken the still's place on screen */
  onShown?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const stream = useRef<HlsHandle | null>(null);
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(false);
  /** How far through the piece is (0..1), for the HUD's line */
  const [progress, setProgress] = useState(0);
  /** Reduced motion: nothing moves until the tap, so the play button is there from the start */
  const [waitsForTap, setWaitsForTap] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    userPaused.current = true;
    setWaitsForTap(true);
  }, []);

  // The stream, while near
  useEffect(() => {
    const video = ref.current;
    if (!video || !near || !hls) return;
    let handle: HlsHandle | null = null;
    let gone = false;
    attachHls(video, hls, false, { sharp: true, startAt }).then((h) => {
      if (gone) return h?.destroy();
      handle = h;
      stream.current = h;
      h?.onScreen?.(activeRef.current);
      // Started from the page before the code came (`early`): it may be playing already, its events gone by
      if (!video.paused && video.readyState >= 2) {
        setPlaying(true);
        reveal(video);
      }
      if (activeRef.current && !userPaused.current) video.play().catch(() => {});
    });
    return () => {
      gone = true;
      stream.current = null;
      handle?.destroy();
      window.clearTimeout(waited.current);
      waited.current = undefined;
      setShown(false);
      setPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hls, near]);

  // Playing, while on screen
  useEffect(() => {
    const video = ref.current;
    if (!video || !near || !hls) return;
    stream.current?.onScreen?.(active);
    if (active && !userPaused.current) video.play().catch(() => {});
    if (!active) video.pause();
  }, [active, near, hls]);

  // The still gives way once the picture is sharp, or after a while regardless
  const waited = useRef<number | undefined>(undefined);
  const reveal = useCallback((video: HTMLVideoElement) => {
    if (playsSharp(video)) {
      window.clearTimeout(waited.current);
      setShown(true);
    } else if (waited.current === undefined) {
      waited.current = window.setTimeout(() => setShown(true), SHARP_WAIT_MS);
    }
  }, []);
  useEffect(() => () => window.clearTimeout(waited.current), []);
  // ...said again whenever it comes back on screen already shown
  useEffect(() => {
    if (shown && active) onShownRef.current?.();
  }, [shown, active]);

  const toggle = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  }, []);

  return (
    <div className={`flex items-center justify-center [container-type:size] ${className}`} style={style}>
      {/* Exactly the video's 9:16, as large as the space allows, its edges feathered into the room */}
      <div className="relative aspect-[9/16] w-[min(100cqw,56.25cqh)] [container-type:inline-size]">
      <div className="room-feather absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt={title} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        {hls && <video
          ref={ref}
          muted
          playsInline
          loop
          preload="metadata"
          aria-label={title}
          onPlaying={(e) => {
            setPlaying(true);
            reveal(e.currentTarget);
          }}
          onResize={(e) => {
            if (!e.currentTarget.paused) reveal(e.currentTarget);
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={hud?.progress ? (e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0) : undefined}
          onClick={tapToPause ? toggle : undefined}
          className={`absolute inset-0 h-full w-full ${tapToPause ? 'cursor-pointer' : 'pointer-events-none'} object-cover transition-opacity duration-500 ${shown ? 'opacity-100' : 'opacity-0'}`}
        />}
        {/* right after the video, which it starts */}
        {hls && early && <script dangerouslySetInnerHTML={{ __html: earlyStart(hls, startAt) }} />}
      </div>
      {hud && <RoomHud {...hud} progress={hud.progress ? progress : null} />}
      </div>
      {hls && tapToPause && active && !playing && (shown || waitsForTap) && (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Play ${title}`}
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-current"
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l10.5-6.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}
