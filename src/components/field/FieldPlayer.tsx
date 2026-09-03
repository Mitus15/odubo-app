'use client';

/**
 * The stem field — a song you mix by dragging.
 *
 * Five stems play in lockstep from one AudioContext, each through its own gain
 * node. Where you stand on the disc decides the level of every part: the
 * centre is the record as mixed, and each edge is one part alone.
 *
 * ── Why it is built this way ────────────────────────────────────────────
 *
 * ONE start time for all five. They are separate buffers but the same
 * performance, so they are scheduled against a single instant. Nothing is ever
 * started or stopped individually — silencing a part is a gain of zero, not a
 * stopped source, because a restarted source can never be re-aligned
 * sample-accurately with the others.
 *
 * The FORMAT is chosen by the device, not by us. A 187-byte Opus probe is
 * decoded first: if it works the stems come as Opus (17MB), if not as AAC
 * (26MB). Safari's Opus support through decodeAudioData has been unreliable
 * and this is meant to work on a phone, so it asks rather than assumes.
 *
 * Loading is EXPLICIT. Seventeen megabytes must never start downloading
 * because somebody scrolled past.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { blendAt, clampToDisc, type FieldPack, type Vec2 } from '@/lib/field/blend';

type Phase = 'idle' | 'loading' | 'ready' | 'error';

const MEDIA = '/api/media/audio/';
const PACK_PREFIX = 'warehouse/field/newspeak';
const PROBE = `${MEDIA}warehouse/field/probe.opus`;

/** Can this browser decode Opus? Ask with 187 bytes rather than 17MB. */
async function pickFormat(ctx: AudioContext): Promise<'opus' | 'm4a'> {
  try {
    const bytes = await fetch(PROBE).then((r) => r.arrayBuffer());
    await ctx.decodeAudioData(bytes.slice(0));
    return 'opus';
  } catch {
    return 'm4a';
  }
}

export default function FieldPlayer({ title }: { title: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [format, setFormat] = useState<'opus' | 'm4a' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [zone, setZone] = useState<string>('');
  const [point, setPoint] = useState<Vec2>([0, 0]);
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState<FieldPack | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const packRef = useRef<FieldPack | null>(null);
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const gainsRef = useRef<Map<string, GainNode>>(new Map());
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const offsetRef = useRef(0);
  const startedAtRef = useRef(0);
  const svgRef = useRef<SVGSVGElement | null>(null);

  /** Move every voice toward its level for this point. */
  const applyLevels = useCallback((p: Vec2) => {
    const ctx = ctxRef.current;
    const current = packRef.current;
    if (!ctx || !current) return;
    const { levels, dominant } = blendAt(p, current);
    // Exponential approach rather than a ramp: responds immediately so a drag
    // feels attached to the sound, but never steps, so fast movement across
    // the disc produces no zipper noise.
    for (const [id, gain] of gainsRef.current) {
      gain.gain.setTargetAtTime(levels[id] ?? 0, ctx.currentTime, 0.045);
    }
    setZone(current.zones[dominant]?.label ?? '');
  }, []);

  const load = async () => {
    setPhase('loading');
    setError(null);
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      ctxRef.current = ctx;
      // Created inside the click: iOS will not start a context otherwise.
      await ctx.resume();

      const chosen = await pickFormat(ctx);
      setFormat(chosen);

      const loaded: FieldPack = await fetch(`${MEDIA}${PACK_PREFIX}/pack.json`).then((r) => {
        if (!r.ok) throw new Error(`pack: ${r.status}`);
        return r.json();
      });
      packRef.current = loaded;
      setPack(loaded);

      let done = 0;
      await Promise.all(
        loaded.loops.map(async (loop) => {
          const url = `${MEDIA}${PACK_PREFIX}/${loop.src ?? loop.id}.${chosen}`;
          const bytes = await fetch(url).then((r) => {
            if (!r.ok) throw new Error(`${loop.id}: ${r.status}`);
            return r.arrayBuffer();
          });
          const buf = await ctx.decodeAudioData(bytes.slice(0));
          buffersRef.current.set(loop.id, buf);
          done += 1;
          setProgress(done / loaded.loops.length);
        })
      );

      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      for (const loop of loaded.loops) {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(master);
        gainsRef.current.set(loop.id, g);
      }

      setPhase('ready');
      applyLevels(point);
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  const stopSources = useCallback(() => {
    for (const s of sourcesRef.current) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    sourcesRef.current = [];
  }, []);

  const play = async () => {
    const ctx = ctxRef.current;
    const current = packRef.current;
    if (!ctx || !current) return;
    await ctx.resume();
    stopSources();

    // One instant for all five. Separate buffers, one performance.
    const at = ctx.currentTime + 0.06;
    for (const loop of current.loops) {
      const buf = buffersRef.current.get(loop.id);
      const gain = gainsRef.current.get(loop.id);
      if (!buf || !gain) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      src.start(at, offsetRef.current);
      sourcesRef.current.push(src);
    }
    startedAtRef.current = at - offsetRef.current;
    setPlaying(true);
    applyLevels(point);
  };

  const pause = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    offsetRef.current = Math.max(0, ctx.currentTime - startedAtRef.current);
    stopSources();
    setPlaying(false);
  };

  useEffect(() => () => stopSources(), [stopSources]);

  /** Pointer position → disc coordinates, y-up. */
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || phase !== 'ready') return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const p = clampToDisc([x, y]);
    setPoint(p);
    applyLevels(p);
  };

  const R = 140;
  const ringLoops = pack?.loops.filter((l) => l.role !== 'aux') ?? [];

  return (
    <div className="rounded-2xl border border-[#502d26]/60 bg-[#1c1a19] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-[#ede8df] text-sm font-semibold tracking-wide uppercase">
            The field
          </h3>
          <p className="text-[#726d6c] text-xs mt-1">
            {title} in five parts. Drag to remix it — the centre is the record.
          </p>
        </div>
        {phase === 'ready' && (
          <button
            onClick={playing ? pause : play}
            className="shrink-0 rounded-xl border border-[#843c2d] bg-[#843c2d] px-4 py-2 text-xs font-medium text-[#ede8df] hover:bg-[#9a4736]"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      {phase === 'idle' && (
        <button
          onClick={load}
          className="w-full rounded-xl border border-[#502d26]/60 py-6 text-sm text-[#b2a491] hover:text-[#ede8df] hover:border-[#843c2d] transition-colors"
        >
          Load the field
          <span className="block text-[10px] text-[#726d6c] mt-1">
            about 17 MB — five stems, downloaded once
          </span>
        </button>
      )}

      {phase === 'loading' && (
        <div className="py-6">
          <div className="h-1 w-full rounded-full bg-[#302927] overflow-hidden">
            <div
              className="h-full bg-[#843c2d] transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-[#726d6c] text-xs mt-2 text-center">
            {format ? `${format.toUpperCase()} · ` : ''}
            {Math.round(progress * 100)}%
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className="py-4">
          <p className="text-red-300 text-xs">{error}</p>
          <button onClick={load} className="text-[#b2a491] text-xs underline mt-2">
            try again
          </button>
        </div>
      )}

      {phase === 'ready' && pack && (
        <>
          {/* Wider than tall: the side labels sit at 1.13r and run outward
              from there, so a square viewBox clips "BASS" and "VOX" in half. */}
          <svg
            ref={svgRef}
            viewBox="-200 -172 400 344"
            className="w-full max-w-[380px] mx-auto touch-none select-none cursor-pointer"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              move(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) move(e);
            }}
          >
            <circle cx="0" cy="0" r={R} fill="#0d0c0a" stroke="#502d26" strokeWidth="1" />
            <circle cx="0" cy="0" r={R * 0.66} fill="none" stroke="#502d26" strokeWidth="0.5" opacity="0.4" />
            <circle cx="0" cy="0" r={R * 0.33} fill="none" stroke="#502d26" strokeWidth="0.5" opacity="0.4" />

            {/* One label per ring loop, at its own edge — the same
                rhythm-to-atmosphere ordering the pack was laid out in. */}
            {ringLoops.map((l, i) => {
              const a = Math.PI / 2 + (i * 2 * Math.PI) / ringLoops.length;
              return (
                <text
                  key={l.id}
                  x={Math.cos(a) * R * 1.13}
                  y={Math.sin(a) * R * 1.13}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-[#726d6c]"
                  style={{ fontSize: 11, letterSpacing: '0.08em' }}
                >
                  {(l.label ?? l.id).toUpperCase()}
                </text>
              );
            })}

            <circle
              cx={point[0] * R}
              cy={-point[1] * R}
              r="11"
              fill="#843c2d"
              stroke="#ede8df"
              strokeWidth="1.5"
            />
          </svg>

          <p className="text-center text-[#b2a491] text-xs mt-3">
            {zone}
            {format && <span className="text-[#726d6c]"> · {format.toUpperCase()}</span>}
          </p>
        </>
      )}
    </div>
  );
}
