"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import FeaturedInteractive, { FeaturedConfig } from './FeaturedInteractive';

export default function FeaturedHeroClient({ config }: { config: FeaturedConfig }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [fg, setFg] = useState<string>('#ede8df'); // default light text
  const [veil, setVeil] = useState<number>(0.30);   // default veil strength
  // Force no-CORS for video by default to guarantee playback on all devices
  // regardless of R2 CORS headers. We can re-enable CORS later once headers
  // are confirmed stable to support pixel sampling.
  const [useCors, setUseCors] = useState<boolean>(false);

  // Periodically sample background video brightness to pick a contrasting foreground color
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Create tiny canvas for sampling
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 64; canvas.height = 36;

  let raf = 0; let last = 0; let lastLight = false;
    const sample = (t: number) => {
      raf = requestAnimationFrame(sample);
      if (!v || v.readyState < 2) return;
      // downsample roughly ~4 times a second
      if (t - last < 250) return;
      last = t;
      try {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let sum = 0; const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] / 255, g = data[i+1] / 255, b = data[i+2] / 255;
          // relative luminance (sRGB)
          const rl = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055)/1.055, 2.4);
          const gl = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055)/1.055, 2.4);
          const bl = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055)/1.055, 2.4);
          const luminance = 0.2126*rl + 0.7152*gl + 0.0722*bl; // 0..1
          sum += luminance;
        }
        const avg = sum / n; // 0..1 brightness
  // Hysteresis to avoid flicker
  const HI = 0.6, LO = 0.5;
  const isLight = lastLight ? (avg > LO) : (avg > HI);
  lastLight = isLight;
  const next = isLight ? '#0b0a0a' : '#ede8df';
        setFg(prev => prev === next ? prev : next);
        // Map brightness to veil opacity (darker when background is bright)
        const nextVeil = Math.max(0.20, Math.min(0.50, 0.20 + avg * 0.35));
        setVeil(v => Math.abs(v - nextVeil) < 0.01 ? v : nextVeil);
      } catch {
        // Likely CORS-tainted canvas; stop sampling and keep default
        cancelAnimationFrame(raf);
      }
    };
    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, [config.backgroundVideoUrl, useCors]);

  return (
    <div className="relative min-h-screen w-full overflow-y-auto bg-[#0b0a0a]" style={{
      // Expose CSS var for child components to consume
      // This drives text/button color inside FeaturedInteractive
      ['--fg' as any]: fg,
      ['--veil' as any]: veil.toFixed(2),
    }}>
      {config.backgroundVideoUrl ? (
        <video
          key={useCors ? 'cors' : 'nocors'}
          ref={videoRef}
          className="fixed inset-0 h-full w-full object-cover"
          src={config.backgroundVideoUrl}
          autoPlay
          muted
          loop
          playsInline
          crossOrigin={useCors ? 'anonymous' : undefined}
          poster="/odubo_logo_emboss.webp"
          style={{ filter: 'blur(6px) saturate(1.05)', transform: 'scale(1.03)' }}
          onError={() => {
            // If CORS is not available, drop crossOrigin and reload once
            if (useCors) setUseCors(false);
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b0a0a] via-[#1b1210] to-[#2a1a16]" />
      )}

  {/* Soft veil to boost text contrast over video (adaptive via --veil) */}
  <div className="fixed inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,var(--veil,0.30)) 0%, rgba(0,0,0,calc(var(--veil,0.30) + 0.08)) 60%, rgba(0,0,0,var(--veil,0.30)) 100%)' }} />

      {/* Decorative overlays removed to avoid unintended tinted box */}
      {false && (
        <>
          <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-20" style={{ background: 'radial-gradient(800px 400px at 20% 10%, rgba(255,255,255,0.35), transparent), radial-gradient(600px 300px at 80% 80%, rgba(255,200,150,0.25), transparent)'}} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\' viewBox=\'0 0 160 160\' %3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.80\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.8\'/%3E%3C/svg%3E")', backgroundSize: 'cover' }} />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-start justify-center px-4 py-10">
        <FeaturedInteractive config={config} />
      </div>

      {/* Subtle vignette */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.25)_60%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  );
}
