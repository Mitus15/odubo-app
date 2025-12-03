"use client";
import { useEffect, useState, useRef } from 'react';
import { clearHlsCache } from '@/lib/hlsPrefetch';

interface PerformanceMetrics {
  fps: number;
  memoryMB: number;
  bufferHealth: number;
  activeConnections: number;
  scrollJank: number;
  timeToPlay: number;
}

/**
 * TikTok-style Performance Debugger
 * 
 * Shows real-time metrics for:
 * - FPS (frames per second)
 * - Memory usage
 * - HLS buffer health
 * - Scroll jank detection
 * - Time-to-play measurements
 * 
 * Usage: Add <PerformanceDebugger /> to ClipsPage during development
 */
export default function PerformanceDebugger() {
  const [visible, setVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memoryMB: 0,
    bufferHealth: 0,
    activeConnections: 0,
    scrollJank: 0,
    timeToPlay: 0,
  });
  
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const animFrameRef = useRef<number | null>(null);
  const [clearing, setClearing] = useState(false);

  // FPS Counter
  useEffect(() => {
    if (!visible) return;
    
    const measureFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      
      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        setMetrics(prev => ({ ...prev, fps }));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      animFrameRef.current = requestAnimationFrame(measureFPS);
    };
    
    animFrameRef.current = requestAnimationFrame(measureFPS);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [visible]);

  // Memory Monitor
  useEffect(() => {
    if (!visible) return;
    
    const measureMemory = () => {
      try {
        const perf = performance as any;
        if (perf.memory) {
          const memoryMB = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
          setMetrics(prev => ({ ...prev, memoryMB }));
        }
      } catch {}
    };
    
    const timer = setInterval(measureMemory, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  // Buffer Health Monitor
  useEffect(() => {
    if (!visible) return;
    
    const checkBuffers = () => {
      try {
        const videos = document.querySelectorAll('video');
        let totalBuffer = 0;
        let activeCount = 0;
        
        videos.forEach(v => {
          if (v.buffered.length > 0) {
            const buffered = v.buffered.end(v.buffered.length - 1) - v.currentTime;
            totalBuffer += buffered;
            if (!v.paused) activeCount++;
          }
        });
        
        const avgBuffer = videos.length > 0 ? totalBuffer / videos.length : 0;
        setMetrics(prev => ({ 
          ...prev, 
          bufferHealth: Math.round(avgBuffer * 10) / 10,
          activeConnections: activeCount 
        }));
      } catch {}
    };
    
    const timer = setInterval(checkBuffers, 500);
    return () => clearInterval(timer);
  }, [visible]);

  // Scroll Jank Detector
  useEffect(() => {
    if (!visible) return;
    
    let lastScrollTime = performance.now();
    let jankCount = 0;
    
    const detectJank = () => {
      const now = performance.now();
      const delta = now - lastScrollTime;
      
      // Detect frame drops (> 20ms between frames = < 50fps)
      if (delta > 20) {
        jankCount++;
      }
      
      lastScrollTime = now;
    };
    
    const updateJank = () => {
      setMetrics(prev => ({ ...prev, scrollJank: jankCount }));
      jankCount = 0;
    };
    
    document.addEventListener('scroll', detectJank, { passive: true });
    const timer = setInterval(updateJank, 1000);
    
    return () => {
      document.removeEventListener('scroll', detectJank as any);
      clearInterval(timer);
    };
  }, [visible]);

  // Time-to-Play Monitor (via Performance Observer)
  useEffect(() => {
    if (!visible) return;
    
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'video-play') {
            setMetrics(prev => ({ 
              ...prev, 
              timeToPlay: Math.round(entry.duration) 
            }));
          }
        });
      });
      
      observer.observe({ entryTypes: ['measure'] });
      return () => observer.disconnect();
    } catch {}
  }, [visible]);

  // Toggle visibility with keyboard shortcut (Cmd+Shift+P)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setVisible(v => !v);
      }
    };
    
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed top-20 right-4 z-50 px-2 py-1 rounded bg-black/50 text-white text-xs border border-white/20 hover:bg-black/70 transition-colors"
        title="Show Performance Metrics (⌘⇧P)"
      >
        📊
      </button>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-50 w-64 p-3 rounded-lg bg-black/90 backdrop-blur-md border border-white/20 text-white text-xs font-mono">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">Performance Metrics</h3>
        <button 
          onClick={() => setVisible(false)}
          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-1.5">
        <MetricRow 
          label="FPS" 
          value={metrics.fps} 
          suffix="" 
          good={metrics.fps >= 55} 
          warn={metrics.fps >= 30 && metrics.fps < 55}
        />
        <MetricRow 
          label="Memory" 
          value={metrics.memoryMB} 
          suffix="MB" 
          good={metrics.memoryMB < 150} 
          warn={metrics.memoryMB >= 150 && metrics.memoryMB < 300}
        />
        <MetricRow 
          label="Buffer" 
          value={metrics.bufferHealth} 
          suffix="s" 
          good={metrics.bufferHealth >= 3} 
          warn={metrics.bufferHealth >= 1 && metrics.bufferHealth < 3}
        />
        <MetricRow 
          label="Active Videos" 
          value={metrics.activeConnections} 
          suffix="" 
          good={metrics.activeConnections === 1}
          warn={metrics.activeConnections > 1}
        />
        <MetricRow 
          label="Scroll Jank" 
          value={metrics.scrollJank} 
          suffix="/s" 
          good={metrics.scrollJank === 0} 
          warn={metrics.scrollJank > 0 && metrics.scrollJank < 5}
        />
        {metrics.timeToPlay > 0 && (
          <MetricRow 
            label="Time-to-Play" 
            value={metrics.timeToPlay} 
            suffix="ms" 
            good={metrics.timeToPlay < 200} 
            warn={metrics.timeToPlay >= 200 && metrics.timeToPlay < 500}
          />
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-white/10 text-[10px] opacity-60">
        Press ⌘⇧P to toggle
      </div>
      
      <button
        onClick={async () => {
          setClearing(true);
          const success = await clearHlsCache();
          setTimeout(() => setClearing(false), 1000);
          if (success) {
            alert('HLS cache cleared! Reload page for fresh content.');
          }
        }}
        disabled={clearing}
        className="mt-2 w-full px-3 py-1.5 rounded bg-red-600/80 hover:bg-red-600 disabled:bg-red-600/50 text-white text-xs transition-colors"
      >
        {clearing ? 'Clearing...' : 'Clear HLS Cache'}
      </button>
    </div>
  );
}

function MetricRow({ 
  label, 
  value, 
  suffix, 
  good, 
  warn 
}: { 
  label: string; 
  value: number; 
  suffix: string; 
  good: boolean; 
  warn: boolean;
}) {
  const color = good ? 'text-green-400' : warn ? 'text-yellow-400' : 'text-red-400';
  
  return (
    <div className="flex items-center justify-between">
      <span className="opacity-75">{label}:</span>
      <span className={`font-bold ${color}`}>
        {value}{suffix}
      </span>
    </div>
  );
}
