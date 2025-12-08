"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ScreenLayout from "@/components/ui/ScreenLayout";
import ScrollContainer from "@/components/ui/ScrollContainer";
import { motion, AnimatePresence } from "framer-motion";

import { createPortal } from "react-dom";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ClipsManager from './ClipsManager';

// --- Types ---
type Video = {
  id: number;
  title: string;
  description: string;
  url: string;
  uid?: string;
  poster_url?: string;
  thumbnail?: string;
  duration: string;
  category: string;
  is_public: boolean;
  status: string;
  created_at?: string;
  artist_name?: string;
  mood?: string;
  type?: string;
  ai_description?: string | any;
  shopify_product_id?: string;
  shopify_product_handle?: string;
};

const getVideoUid = (video: Video) => {
  if (video.uid) return video.uid;
  // Fallback: extract from URL
  // Format: https://customer-xyz.cloudflarestream.com/<UID>/manifest/video.m3u8
  const match = video.url.match(/cloudflarestream\.com\/([a-f0-9]+)\/manifest/);
  if (match) return match[1];
  // Fallback: try to extract from iframe src if stored in url (legacy)
  const iframeMatch = video.url.match(/iframe\.videodelivery\.net\/([a-f0-9]+)/);
  if (iframeMatch) return iframeMatch[1];
  return '';
};

type ProcessingStep = 'upload' | 'transcribe' | 'thumbnails' | 'description' | 'complete' | 'error';

// --- Components ---

const EditableMarkerRow = ({ marker, onSave, onDelete, onSelect, selected }: {
  marker: { id: number; timestamp: number; label?: string };
  onSave: (updates: { timestamp?: number; label?: string }) => void;
  onDelete: () => void;
  onSelect: () => void;
  selected: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [tsInput, setTsInput] = useState<string>(String(marker.timestamp.toFixed(2)));
  const [labelInput, setLabelInput] = useState<string>(marker.label || '');

  useEffect(() => {
    setTsInput(String(marker.timestamp.toFixed(2)));
    setLabelInput(marker.label || '');
  }, [marker.id, marker.timestamp, marker.label]);

  const parseInput = (s: string): number | null => {
    const t = s.trim();
    if (/^\d+(?:\.\d+)?$/.test(t)) return parseFloat(t);
    const m = t.match(/^(\d+):(\d{1,2})(?:\.(\d+))?$/);
    if (m) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseFloat('0.' + m[3]) : 0;
      return min * 60 + sec + frac;
    }
    return null;
  };

  const save = () => {
    const ts = parseInput(tsInput);
    if (ts === null || ts < 0) {
      alert('Enter seconds or mm:ss');
      return;
    }
    onSave({ timestamp: ts, label: labelInput });
    setEditing(false);
  };

  return (
    <div className={`flex items-center justify-between bg-[#000]/20 border ${selected ? 'border-yellow-300/50' : 'border-[#b2a491]/10'} rounded px-3 py-2`} onClick={onSelect}>
      {editing ? (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input
            value={tsInput}
            onChange={e => setTsInput(e.target.value)}
            placeholder="Time (s or mm:ss)"
            className="w-32 bg-[#302927]/30 border border-[#b2a491]/20 rounded px-2 py-1 text-[#ede8df] text-xs"
          />
          <input
            value={labelInput}
            onChange={e => setLabelInput(e.target.value)}
            placeholder="Label"
            className="flex-1 bg-[#302927]/30 border border-[#b2a491]/20 rounded px-2 py-1 text-[#ede8df] text-xs"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[11px] font-mono text-[#b2a491]">{formatDuration(marker.timestamp)}</span>
          <span className="text-xs text-[#ede8df] truncate">{marker.label || '—'}</span>
        </div>
      )}
      <div className="flex items-center gap-2 ml-3">
        {editing ? (
          <>
            <button onClick={save} className="text-[11px] text-green-300 hover:text-green-200">Save</button>
            <button onClick={() => setEditing(false)} className="text-[11px] text-[#b2a491] hover:text-[#ede8df]">Cancel</button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="text-[11px] text-indigo-300 hover:text-indigo-200">Edit</button>
        )}
        <button onClick={onDelete} className="text-[11px] text-red-300 hover:text-red-200">Delete</button>
      </div>
    </div>
  );
};

const formatDuration = (duration?: string | number) => {
  if (!duration) return '';
  if (typeof duration === 'string' && duration.includes(':')) return duration;
  const seconds = typeof duration === 'string' ? parseFloat(duration) : duration;
  if (isNaN(seconds)) return String(duration);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoCard = ({ video, onClick }: { video: Video; onClick: () => void }) => (
  <motion.div 
    layoutId={`card-${video.id}`}
    className="group relative aspect-video bg-[#171616] rounded-xl overflow-hidden border border-[#b2a491]/10 hover:border-[#b2a491]/40 transition-colors cursor-pointer"
    onClick={onClick}
  >
    {video.poster_url ? (
      <img src={video.poster_url} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-[#b2a491]/30">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      </div>
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
      <h3 className="text-[#ede8df] font-medium truncate">{video.title}</h3>
      <div className="flex items-center gap-2 text-xs text-[#b2a491] mt-1">
        <span className={`w-2 h-2 rounded-full ${video.is_public ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span>{video.status || 'Ready'}</span>
        {video.duration && (
          <>
            <span>•</span>
            <span>{formatDuration(video.duration)}</span>
          </>
        )}
      </div>
    </div>
  </motion.div>
);

const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
};

const AddVideoModal = ({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) => {
  const [uid, setUid] = useState('');
  const [step, setStep] = useState<ProcessingStep>('upload'); // reusing 'upload' as 'input' phase
  const [logs, setLogs] = useState<string[]>([]);
  const [videoDetails, setVideoDetails] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const fetchDetails = async () => {
    if (!uid || uid.length < 32) return;
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/videos/stream/details?uid=${uid}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Video not found');
      const data: any = await res.json();
      setVideoDetails(data.video);
    } catch (e) {
      setVideoDetails(null);
      // Don't alert, just let user know via UI state if needed
    } finally {
      setIsFetching(false);
    }
  };

  // Auto-fetch when UID looks valid
  useEffect(() => {
    if (uid.length === 32) fetchDetails();
  }, [uid]);

  const startProcess = async () => {
    if (!uid) return;
    setStep('upload'); // Using 'upload' state to mean 'processing start'
    setLogs([]);
    addLog('Initializing...');
    
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // 1. Create Record
      addLog('Creating video record...');
      const payload = {
        title: videoDetails?.title || 'Untitled Video',
        uid,
        url: `https://customer-tpkm273r1u0s40no.cloudflarestream.com/${uid}/manifest/video.m3u8`,
        duration: videoDetails?.duration || 0,
        thumbnail: videoDetails?.thumbnail || '',
        poster_url: videoDetails?.thumbnail || '',
        is_public: false
      };

      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders } as HeadersInit,
        body: JSON.stringify(payload),
      });
      
      if (!createRes.ok) throw new Error('Failed to create video record');
      
      // Wait for DB consistency
      await new Promise(r => setTimeout(r, 1000));
      
      // Fetch the new video ID
      const listRes = await fetch(`/api/videos?uid=${uid}`, { headers: authHeaders as HeadersInit });
      const listData: any = await listRes.json().catch(() => ({}));
      const newVideo = listData.videos.find((v: any) => v.uid === uid);
      
      if (!newVideo) throw new Error('Could not find new video record');
      
      // 2. Start Analysis Pipeline
      await runAnalysisPipeline(newVideo.id, uid, authHeaders);
      
      setStep('complete');
      setTimeout(onComplete, 1500);
      
    } catch (e: any) {
      console.error(e);
      addLog(`Error: ${e.message}`);
      setStep('error');
    }
  };

  const runAnalysisPipeline = async (videoId: number, videoUid: string, headers: any) => {
    // Step 1: Gemini Analysis
    setStep('transcribe'); // Using 'transcribe' slot for 'analysis' to keep UI simple for now
    addLog('Running Gemini Deep Semantic Analysis (this may take a minute)...');
    try {
      const res = await fetch('/api/analyze-video-now', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...headers } as HeadersInit,
        body: JSON.stringify({ videoId, cfVideoId: videoUid })
      });
      
      if (!res.ok) {
        let errText = await res.text();
        try { const j = JSON.parse(errText); errText = j.error || errText; } catch {}
        throw new Error(errText || 'Analysis failed');
      }
      
      const data: any = await res.json().catch(() => ({}));
      addLog('Analysis complete.');
      
      // Reload clips list
      const token = localStorage.getItem('token');
      const pollHeaders: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const clipsRes = await fetch(`/api/videos/${videoId}/clips`, { headers: pollHeaders });
      const clipsJson: any = await clipsRes.json().catch(() => ({}));
      setClips(clipsJson.clips || []);
      addLog(`Generated ${clipsJson.clips?.length || 0} clips.`);
      
    } catch (e: any) { 
      addLog(`Analysis failed: ${e.message}`); 
    }

    // Step 2: Thumbnails (Legacy/Backup)
    setStep('thumbnails');
    addLog('Generating thumbnails...');
    try {
      await fetch('/api/videos/thumbnail/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ videoId })
      });
      addLog('Thumbnails generated.');
    } catch (e) { addLog('Thumbnail generation failed.'); }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-[#171616] border border-[#b2a491]/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-[#ede8df] mb-6">Add Video</h2>
          
          {logs.length === 0 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-[#b2a491] mb-2">Cloudflare Stream Video ID</label>
                <div className="flex gap-2">
                  <input 
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    placeholder="e.g. 5d5bc37..."
                    className="flex-1 bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-3 text-[#ede8df] focus:outline-none focus:border-[#ede8df] font-mono text-sm"
                  />
                </div>
              </div>

              {isFetching && <div className="text-xs text-[#b2a491] animate-pulse">Fetching details...</div>}

              {videoDetails && (
                <div className="bg-[#302927]/30 rounded-lg p-3 flex gap-3 items-center border border-[#b2a491]/20">
                  <img src={videoDetails.thumbnail} className="w-16 h-10 object-cover rounded bg-black" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#ede8df] truncate">{videoDetails.title}</div>
                    <div className="text-xs text-[#b2a491]">{formatDuration(videoDetails.duration)} • {videoDetails.width}x{videoDetails.height}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-3 rounded-lg bg-[#302927] text-[#b2a491] hover:bg-[#302927]/80">Cancel</button>
                <button 
                  onClick={startProcess} 
                  disabled={!uid || !videoDetails} 
                  className="flex-1 py-3 rounded-lg bg-[#ede8df] text-[#171616] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#d9d3c9]"
                >
                  Add & Analyze
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-sm text-[#b2a491] mb-2">
                <span className="capitalize">{step.replace('_', ' ')}...</span>
              </div>
              
              {/* Progress Bar */}
              <div className="h-2 bg-[#302927] rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-[#ede8df]" 
                  initial={{ width: 0 }}
                  animate={{ 
                    width: step === 'upload' ? '10%' : 
                           step === 'transcribe' ? '40%' :
                           step === 'thumbnails' ? '70%' :
                           step === 'description' ? '90%' : '100%'
                  }}
                />
              </div>

              {/* Logs */}
              <div className="h-48 overflow-y-auto bg-[#000]/30 rounded-lg p-3 text-xs font-mono text-[#b2a491] space-y-1">
                {logs.map((log, i) => <div key={i}>&gt; {log}</div>)}
              </div>

              {step === 'complete' && (
                <div className="text-center text-green-400 font-medium">
                  All done! Closing...
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </Portal>
  );
};

const DetailModal = ({ video, onClose, onUpdate }: { video: Video; onClose: () => void; onUpdate: () => void }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [socialReady, setSocialReady] = useState(false);
  const [transcript, setTranscript] = useState<any>(null);
  const [clips, setClips] = useState<Video[]>([]);
  const [markers, setMarkers] = useState<Array<{ id: number; timestamp: number; label?: string }>>([]);
  const [newMarkerTs, setNewMarkerTs] = useState<string>("");
  const [newMarkerLabel, setNewMarkerLabel] = useState<string>("");
  const [draggingMarkerId, setDraggingMarkerId] = useState<number | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null);
  const dragActiveRef = useRef(false);
  const [undoStack, setUndoStack] = useState<Array<Array<{ id: number; timestamp: number; label?: string }>>>([]);
  const [redoStack, setRedoStack] = useState<Array<Array<{ id: number; timestamp: number; label?: string }>>>([]);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [shopifyProducts, setShopifyProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const pushHistory = (prev: Array<{ id: number; timestamp: number; label?: string }>) => {
    // Push a shallow copy of previous markers state onto undo stack and clear redo
    setUndoStack(s => [...s, prev.map(m => ({ ...m }))]);
    setRedoStack([]);
  };

  const persistMarkersReplace = async (newMarkers: Array<{ timestamp: number; label?: string }>) => {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      const res = await fetch(`/api/videos/${video.id}/markers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ replace: true, markers: newMarkers })
      });
      if (!res.ok) throw new Error(await res.text());
      const data: any = await res.json().catch(() => ({}));
      setMarkers(data.markers || []);
    } catch (e: any) {
      alert(`Failed to persist markers: ${e.message || e}`);
    }
  };
  const [activeTab, setActiveTab] = useState<'details' | 'ai' | 'clips'>('details');
  const [formData, setFormData] = useState({ 
    title: video.title, 
    artist_name: video.artist_name || '',
    description: video.description,
    is_public: Boolean(video.is_public),
    status: video.status || 'draft',
    type: video.type || video.category || 'music-video',
    mood: video.mood || '',
    category: video.category || 'music-video',
    duration: video.duration || '',
    ai_description: video.ai_description || null,
    shopify_product_id: video.shopify_product_id || '',
    shopify_product_handle: video.shopify_product_handle || ''
  });
  const [currentTime, setCurrentTime] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const durationSeconds = useMemo(() => {
    const d = formData.duration;
    if (typeof d === 'number') return d;
    const n = parseFloat(String(d));
    return Number.isFinite(n) ? n : 0;
  }, [formData.duration]);
  const playerFrameRef = useRef<HTMLIFrameElement | null>(null);

  const analysisData = useMemo(() => {
    if (!formData.ai_description) return null;
    try {
      return typeof formData.ai_description === 'string' ? JSON.parse(formData.ai_description) : formData.ai_description;
    } catch {
      return null;
    }
  }, [formData.ai_description]);

  // Load transcript and clips on mount
  useEffect(() => {
    const loadData = async () => {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // Load Analysis
      const res = await fetch(`/api/videos/${video.id}/analysis`, { headers: headers as HeadersInit });
      if (res.ok) {
        const data: any = await res.json().catch(() => ({}));
        if (data.analysis?.transcript_json) {
          setTranscript(data.analysis.transcript_json);
        }
      }

      // Load Clips
      const clipsRes = await fetch(`/api/videos/${video.id}/clips`, { headers: headers as HeadersInit });
      if (clipsRes.ok) {
        const data: any = await clipsRes.json().catch(() => ({}));
        setClips(data.clips || []);
      }

      // Load Markers
      const mkRes = await fetch(`/api/videos/${video.id}/markers`, { headers: headers as HeadersInit });
      if (mkRes.ok) {
        const data: any = await mkRes.json().catch(() => ({}));
        setMarkers(data.markers || []);
      }
    };
    loadData();
  }, [video.id]);

  // Fetch Shopify products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await fetch('/api/products');
        const data: any = await res.json();
        if (data.success && data.products) {
          setShopifyProducts(data.products);
        }
      } catch (e) {
        console.error('Failed to fetch products', e);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  // Subscribe to time updates from Cloudflare Stream iframe (if supported)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      const msg = e.data;
      if (msg.event === 'timeupdate' && typeof msg.currentTime === 'number') {
        setCurrentTime(msg.currentTime);
      }
    };
    window.addEventListener('message', handler);
    // Try a ping to request time updates (Cloudflare may ignore; safe fallback is manual input)
    try { playerFrameRef.current?.contentWindow?.postMessage({ event: 'subscribe', data: ['timeupdate'] }, '*'); } catch {}
    return () => window.removeEventListener('message', handler);
  }, []);

  // Click on timeline to add marker at position
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || durationSeconds <= 0) return;
    // Ignore clicks when dragging a marker or when click originated on a marker
    const target = e.target as HTMLElement | null;
    if (draggingMarkerId || dragActiveRef.current) return;
    if (target && target.closest('[data-marker="1"]')) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // If click is close to an existing marker, just select it
    if (markers.length) {
      const thresholdPx = 10; // clickable buffer around marker
      let nearest: { id: number; dist: number } | null = null;
      for (const m of markers) {
        const mX = (m.timestamp / durationSeconds) * rect.width;
        const dist = Math.abs(mX - x);
        if (nearest === null || dist < nearest.dist) nearest = { id: m.id, dist };
      }
      if (nearest && nearest.dist <= thresholdPx) {
        setSelectedMarkerId(nearest.id);
        return; // do not create a new marker when clicking near an existing one
      }
    }
    const ratio = Math.min(Math.max(x / rect.width, 0), 1);
    const ts = ratio * durationSeconds;
    // Update input for visibility, but post immediately with computed ts
    setNewMarkerTs(ts.toFixed(2));
    void addMarkerAt(ts, newMarkerLabel || undefined);
  };

  const addMarkerAtCurrent = () => {
    if (durationSeconds <= 0) return;
    const ts = Math.max(0, Math.min(currentTime, durationSeconds));
    setNewMarkerTs(ts.toFixed(2));
    void addMarkerAt(ts, newMarkerLabel || undefined);
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Saving video:', video.id, formData);
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } as HeadersInit,
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data: any = await res.json();
        throw new Error(data.error || 'Failed to update video');
      }

      console.log('Save successful');
      await onUpdate();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    }
  };

  const handleReprocess = async () => {
    if (!confirm('Re-run full analysis (Gemini + Thumbnails)?')) return;
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const uid = getVideoUid(video);
      
      // 1. Queue Analysis Job
      const res = await fetch('/api/analyze-video-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ videoId: video.id, cfVideoId: uid })
      });
      const data: any = await res.json();
      if (!data.success || !data.jobId) throw new Error(data.error || 'Failed to queue job');

      // 2. Poll for completion
      const jobId = data.jobId as string;
      let attempts = 0;
      while (attempts < 60) { // 3 minutes max
        await new Promise(r => setTimeout(r, 3000));
        const jobRes = await fetch(`/api/jobs/${jobId}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        const jobData: any = await jobRes.json();
        if (jobData.job?.status === 'COMPLETED') break;
        if (jobData.job?.status === 'FAILED') throw new Error(jobData.job?.errorDetails || 'Job failed');
        attempts++;
      }

      // 3. Also run thumbnails (optional, can be async)
      await fetch('/api/videos/thumbnail/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ videoId: video.id, uid })
      });

      onUpdate();
      onClose(); // Close to refresh list
      alert('Analysis complete!');
    } catch (e: any) {
      console.error(e);
      alert(`Analysis failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncMetadata = async () => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const uid = getVideoUid(video);
      if (!uid) throw new Error('No UID found');

      const res = await fetch(`/api/videos/stream/details?uid=${uid}`, {
        headers: (token ? { 'Authorization': `Bearer ${token}` } : {}) as HeadersInit
      });
      
      if (!res.ok) throw new Error('Failed to fetch details');
      
      const data: any = await res.json().catch(() => ({}));
      if (data.video) {
        setFormData(prev => ({
          ...prev,
          duration: data.video.duration || prev.duration,
          // Only update if missing or explicit sync requested
        }));
        alert(`Synced! Duration: ${data.video.duration}s`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Sync failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (clipId: number, title: string) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // 1. Get Download URL
      const res = await fetch(`/api/videos/${clipId}/download`, { headers: headers as HeadersInit });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse download response', e);
        throw new Error(`Server returned ${res.status}: ${text.slice(0, 200)}`);
      }
      
      if (!res.ok) throw new Error(data.error || 'Download failed');
      
      if (data.status === 'pending') {
        alert('Download is being prepared by Cloudflare. Please try again in 10-20 seconds.');
        return;
      } 
      
      if (!data.url) throw new Error('No download URL returned');

      let downloadUrl = data.url;

      // 2. If Social Ready, use Crop API
      if (socialReady) {
        // We need to fetch the cropped version
        // The crop API returns a stream, so we fetch it directly
        const cropRes = await fetch('/api/videos/crop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: downloadUrl })
        });
        
        if (!cropRes.ok) {
          const errText = await cropRes.text();
          throw new Error(`Cropping failed: ${cropRes.status} ${errText}`);
        }
        
        const blob = await cropRes.blob();
        if (blob.size < 1000) throw new Error('Cropped file is too small (likely failed)');

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeTitle}_9x16.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return;
      }

      // 3. Normal Download
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) throw new Error('Failed to fetch video file');
      
      const blob = await downloadRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `${safeTitle}_clip.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (e: any) {
      console.error(e);
      alert(`Download error: ${e.message}`);
    }
  };

  const handleDownloadAll = async () => {
    if (!clips.length) return;
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Process sequentially to avoid rate limits
      for (const clip of clips) {
        try {
          // Get URL
          const res = await fetch(`/api/videos/${clip.id}/download`, { headers: headers as HeadersInit });
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error(`Failed to parse response for clip ${clip.id}`, e);
            continue;
          }
          
          if (data.url) {
            let blob;
            let filename = `${clip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;

            if (socialReady) {
              const cropRes = await fetch('/api/videos/crop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: data.url })
              });
              if (cropRes.ok) {
                blob = await cropRes.blob();
                if (blob.size > 1000) {
                  filename = filename.replace('.mp4', '_9x16.mp4');
                } else {
                  // Fallback if crop failed silently
                  blob = undefined;
                }
              }
            } 
            
            if (!blob) {
              const vidRes = await fetch(data.url);
              blob = await vidRes.blob();
            }

            zip.file(filename, blob);
          }
        } catch (e) {
          console.error(`Failed to download clip ${clip.id}`, e);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${video.title.replace(/[^a-z0-9]/gi, '_')}_clips.zip`);

    } catch (e: any) {
      console.error(e);
      alert('Failed to create zip');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const parseTimeInput = (input: string): number | null => {
    if (!input) return null;
    const s = input.trim();
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    // mm:ss(.ms)
    const m = s.match(/^(\d+):(\d{1,2})(?:\.(\d+))?$/);
    if (m) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseFloat('0.' + m[3]) : 0;
      return min * 60 + sec + frac;
    }
    return null;
  };

  const addMarkerAt = async (ts: number, label?: string) => {
    if (!Number.isFinite(ts) || ts < 0) return;
    try {
      pushHistory(markers);
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      const res = await fetch(`/api/videos/${video.id}/markers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ timestamp: ts, label: label ?? null })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      const data: any = await res.json().catch(() => ({}));
      setMarkers(data.markers || []);
      setNewMarkerTs("");
      setNewMarkerLabel("");
    } catch (e: any) {
      alert(`Failed to add marker: ${e.message || e}`);
    }
  };

  const addMarker = async () => {
    const ts = parseTimeInput(newMarkerTs);
    if (ts === null || ts < 0) { alert('Enter seconds or mm:ss'); return; }
    await addMarkerAt(ts, newMarkerLabel || undefined);
  };

  const updateMarker = async (markerId: number, updates: { timestamp?: number; label?: string }) => {
    try {
      pushHistory(markers);
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      const res = await fetch(`/api/videos/${video.id}/markers`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ markerId, ...updates })
      });
      if (!res.ok) throw new Error(await res.text());
      const data: any = await res.json().catch(() => ({}));
      setMarkers(data.markers || []);
    } catch (e: any) {
      alert(`Failed to update marker: ${e.message || e}`);
    }
  };

  // Drag-to-move: attach listeners during drag
  useEffect(() => {
    if (!draggingMarkerId) return;
    dragActiveRef.current = true;

    const handleMove = (e: MouseEvent) => {
      if (!timelineRef.current || durationSeconds <= 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const ratio = rect.width > 0 ? x / rect.width : 0;
      const ts = Math.max(0, Math.min(durationSeconds, ratio * durationSeconds));
      setMarkers(prev => prev.map(m => m.id === draggingMarkerId ? { ...m, timestamp: ts } : m));
    };
    const handleUp = async () => {
      if (!dragActiveRef.current) return;
      dragActiveRef.current = false;
      const m = markers.find(mm => mm.id === draggingMarkerId);
      if (m) await updateMarker(m.id, { timestamp: m.timestamp });
      setDraggingMarkerId(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      dragActiveRef.current = false;
    };
  }, [draggingMarkerId, durationSeconds, markers]);

  const deleteMarker = async (markerId: number) => {
    try {
      pushHistory(markers);
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      const res = await fetch(`/api/videos/${video.id}/markers`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ markerId })
      });
      if (!res.ok) throw new Error(await res.text());
      setMarkers(m => m.filter(x => x.id !== markerId));
    } catch (e: any) {
      alert(`Failed to delete marker: ${e.message || e}`);
    }
  };

  const resetAllMarkers = async () => {
    if (!confirm('Reset all markers for this video?')) return;
    try {
      pushHistory(markers);
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      const res = await fetch(`/api/videos/${video.id}/markers`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ all: true })
      });
      if (!res.ok) throw new Error(await res.text());
      setMarkers([]);
      setSelectedMarkerId(null);
    } catch (e: any) {
      alert(`Failed to reset markers: ${e.message || e}`);
    }
  };

  const undo = async () => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, markers.map(m => ({ ...m }))]);
    setMarkers(prev.map(m => ({ ...m })));
    // Persist replacement: timestamps/labels only
    await persistMarkersReplace(prev.map(m => ({ timestamp: m.timestamp, label: m.label })));
  };

  const redo = async () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s, markers.map(m => ({ ...m }))]);
    setMarkers(next.map(m => ({ ...m })));
    await persistMarkersReplace(next.map(m => ({ timestamp: m.timestamp, label: m.label })));
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <motion.div layoutId={`card-${video.id}`} className="w-full max-w-4xl bg-[#171616] border border-[#b2a491]/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header / Player */}
          <div className={`bg-black relative group transition-all duration-300 ease-in-out ${isPlayerMinimized ? 'h-14 shrink-0' : 'aspect-video shrink-0'}`}>
            <div className={`w-full h-full transition-opacity duration-300 ${isPlayerMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <iframe 
                ref={playerFrameRef}
                src={`https://iframe.videodelivery.net/${getVideoUid(video)}?autoplay=true&muted=true`}
                className="w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" 
                allowFullScreen
              />
            </div>
            
            <div className="absolute top-3 right-4 flex items-center gap-2 z-20">
              <button 
                onClick={() => setIsPlayerMinimized(!isPlayerMinimized)} 
                className="px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-lg text-xs text-[#ede8df] hover:bg-black/80 border border-white/10 transition-colors"
              >
                {isPlayerMinimized ? 'Expand Player' : 'Minimize'}
              </button>
              <button onClick={onClose} className="w-8 h-8 bg-black/50 backdrop-blur-md rounded-full text-white flex items-center justify-center hover:bg-black/80 border border-white/10">✕</button>
            </div>
            
            {isPlayerMinimized && (
               <div className="absolute inset-0 flex items-center px-6 pointer-events-none">
                  <span className="text-[#ede8df] font-medium text-sm">{video.title}</span>
               </div>
            )}
          </div>

          {/* Interactive Timeline */}
          <div className="px-6 pt-3 pb-4 bg-[#121111] border-b border-[#b2a491]/10">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-mono text-[#b2a491]">
                {formatDuration(currentTime)} / {formatDuration(durationSeconds)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addMarkerAtCurrent}
                  disabled={durationSeconds <= 0}
                  className="text-[11px] px-2 py-1 rounded bg-[#ede8df] text-[#171616] disabled:opacity-40 hover:bg-[#d9d3c9]"
                >Add Marker @ Now</button>
                  <button
                    onClick={undo}
                    disabled={!undoStack.length}
                    className="text-[11px] px-2 py-1 rounded bg-[#302927] text-[#ede8df] disabled:opacity-30 hover:bg-[#403834]"
                  >Undo</button>
                  <button
                    onClick={redo}
                    disabled={!redoStack.length}
                    className="text-[11px] px-2 py-1 rounded bg-[#302927] text-[#ede8df] disabled:opacity-30 hover:bg-[#403834]"
                  >Redo</button>
                  <button
                    onClick={resetAllMarkers}
                    className="text-[11px] px-2 py-1 rounded bg-red-600/20 text-red-300 hover:bg-red-600/30"
                  >Reset Markers</button>
                <button
                  onClick={handleReprocess}
                  className="text-[11px] px-2 py-1 rounded bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
                >Re-Analyze w/ Markers</button>
              </div>
            </div>
            <div
              ref={timelineRef}
              onClick={handleTimelineClick}
              className="relative h-8 rounded bg-[#302927]/40 cursor-pointer select-none group"
            >
              {/* Progress Playhead */}
              {durationSeconds > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-[#ede8df]"
                  style={{ left: `${(currentTime / durationSeconds) * 100}%` }}
                />
              )}
              {/* Markers */}
              {durationSeconds > 0 && markers.map(m => {
                const pos = (m.timestamp / durationSeconds) * 100;
                return (
                  <div
                    key={m.id}
                    className={`absolute top-0 bottom-0 w-[8px] -ml-[4px] rounded cursor-ew-resize ${selectedMarkerId === m.id ? 'bg-yellow-400' : 'bg-indigo-400 hover:bg-indigo-300'}`}
                    style={{ left: `${pos}%` }}
                    data-marker="1"
                    data-id={m.id}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedMarkerId(m.id); setDraggingMarkerId(m.id); }}
                    onClick={(e) => { e.stopPropagation(); setSelectedMarkerId(m.id); }}
                    title={`${formatDuration(m.timestamp)}${m.label ? ' • ' + m.label : ''}`}
                  />
                );
              })}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-60 text-[10px] text-[#b2a491] transition-opacity">Click to add marker</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#b2a491]/10">
            <button onClick={() => setActiveTab('details')} className={`flex-1 py-4 text-sm font-medium ${activeTab === 'details' ? 'text-[#ede8df] border-b-2 border-[#ede8df]' : 'text-[#b2a491]'}`}>Details</button>
            <button onClick={() => setActiveTab('ai')} className={`flex-1 py-4 text-sm font-medium ${activeTab === 'ai' ? 'text-[#ede8df] border-b-2 border-[#ede8df]' : 'text-[#b2a491]'}`}>AI Analysis</button>
            <button onClick={() => setActiveTab('clips')} className={`flex-1 py-4 text-sm font-medium ${activeTab === 'clips' ? 'text-[#ede8df] border-b-2 border-[#ede8df]' : 'text-[#b2a491]'}`}>Clips ({clips.length})</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'details' ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button 
                    onClick={handleSyncMetadata}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5 bg-[#302927] text-[#b2a491] rounded hover:bg-[#302927]/80 flex items-center gap-2"
                  >
                    <svg className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Sync Metadata from Cloudflare
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-[#b2a491] mb-1">Title</label>
                  <input 
                    value={formData.title} 
                    onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                    className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#b2a491] mb-1">Artist Name</label>
                  <input 
                    value={formData.artist_name} 
                    onChange={e => setFormData(f => ({ ...f, artist_name: e.target.value }))}
                    placeholder="e.g. The Weeknd"
                    className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#b2a491] mb-1">Duration (seconds)</label>
                  <input 
                    value={formData.duration} 
                    onChange={e => setFormData(f => ({ ...f, duration: e.target.value }))}
                    placeholder="e.g. 203.3"
                    className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#b2a491] mb-1">Description</label>
                  <textarea 
                    value={formData.description} 
                    onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                    rows={4}
                    className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#b2a491] mb-1">Associated Product</label>
                  <select
                    value={formData.shopify_product_id}
                    onChange={e => {
                      const pid = e.target.value;
                      const prod = shopifyProducts.find(p => p.id === pid);
                      setFormData(f => ({ 
                        ...f, 
                        shopify_product_id: pid,
                        shopify_product_handle: prod ? prod.handle : ''
                      }));
                    }}
                    className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                  >
                    <option value="">-- None --</option>
                    {loadingProducts ? (
                      <option disabled>Loading products...</option>
                    ) : (
                      shopifyProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))
                    )}
                  </select>
                </div>
                
                <div className="bg-[#302927]/20 rounded-lg p-4 border border-[#b2a491]/10 space-y-3">
                  <h3 className="text-xs font-medium text-[#b2a491] uppercase tracking-wider">Visibility & Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#b2a491] mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}
                        className="w-full bg-[#302927]/50 border border-[#b2a491]/20 rounded-lg px-3 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#b2a491] mb-1">Type</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData(f => ({ ...f, type: e.target.value, category: e.target.value }))}
                        className="w-full bg-[#302927]/50 border border-[#b2a491]/20 rounded-lg px-3 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                      >
                        <option value="music-video">Music Video</option>
                        <option value="film">Film</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-[#b2a491] mb-1">Mood</label>
                      <input 
                        value={formData.mood} 
                        onChange={e => setFormData(f => ({ ...f, mood: e.target.value }))}
                        placeholder="e.g. Energetic, Dark, Chill"
                        className="w-full bg-[#302927]/50 border border-[#b2a491]/20 rounded-lg px-3 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                      />
                    </div>
                    <div className="col-span-2 flex items-center pt-2">
                      <label className="flex items-center gap-3 cursor-pointer select-none w-full">
                        <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${formData.is_public ? 'bg-green-500/80' : 'bg-[#302927] border border-[#b2a491]/20'}`}>
                          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${formData.is_public ? 'translate-x-5' : ''}`} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[#ede8df]">Publicly Visible</span>
                          <span className="text-[10px] text-[#b2a491]">Show on media page</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={formData.is_public} 
                          onChange={e => setFormData(f => ({ ...f, is_public: e.target.checked }))}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'clips' ? (
              <ClipsManager videoId={video.id} videoTitle={video.title} videoArtist={video.artist_name || 'Unknown'} />
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[#ede8df] font-medium">AI Analysis</h3>
                  <button onClick={handleReprocess} disabled={isProcessing} className="text-xs px-3 py-1.5 bg-indigo-600/20 text-indigo-300 rounded hover:bg-indigo-600/30">
                    {isProcessing ? 'Processing...' : 'Re-Analyze Video'}
                  </button>
                </div>
                
                {analysisData ? (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="bg-[#302927]/20 rounded-lg p-4 border border-[#b2a491]/10">
                      <h4 className="text-xs text-[#b2a491] uppercase tracking-wider mb-2">Summary (Editable)</h4>
                      <textarea 
                        value={analysisData.description || analysisData.title || ''}
                        onChange={(e) => {
                          const newVal = e.target.value;
                          const newJson = { ...analysisData, description: newVal };
                          setFormData(f => ({ ...f, ai_description: JSON.stringify(newJson) }));
                        }}
                        rows={4}
                        className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-3 py-2 text-[#ede8df] text-sm focus:outline-none focus:border-[#ede8df]"
                      />
                      {analysisData.tags && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {analysisData.tags.map((t: string) => (
                            <span key={t} className="text-xs px-2 py-1 bg-[#b2a491]/10 text-[#b2a491] rounded-full">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Suggested Clips */}
                    {analysisData.suggestedClips && (
                      <div>
                        <h4 className="text-xs text-[#b2a491] uppercase tracking-wider mb-3">Suggested Clips</h4>
                        <div className="grid gap-3">
                          {analysisData.suggestedClips.map((clip: any, i: number) => (
                            <div key={i} className="bg-[#302927]/20 rounded-lg p-3 border border-[#b2a491]/10 flex justify-between items-center">
                              <div>
                                <div className="text-sm font-medium text-[#ede8df]">{clip.priority}</div>
                                <div className="text-xs text-[#b2a491]">{clip.reason}</div>
                              </div>
                              <div className="text-xs font-mono text-[#b2a491] bg-[#000]/30 px-2 py-1 rounded">
                                {clip.startTime}s - {clip.endTime}s
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sections */}
                    {analysisData.sections && (
                      <div>
                        <h4 className="text-xs text-[#b2a491] uppercase tracking-wider mb-3">Timeline</h4>
                        <div className="space-y-2">
                          {analysisData.sections.map((sec: any, i: number) => (
                            <div key={i} className="flex gap-3 text-sm">
                              <div className="w-16 font-mono text-[#b2a491] text-xs pt-1">{sec.startTime}</div>
                              <div className="flex-1">
                                <div className="text-[#ede8df]">{sec.musicalPhase}</div>
                                <div className="text-xs text-[#b2a491]">{sec.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#000]/30 rounded-lg p-4 text-sm text-[#b2a491] font-mono max-h-60 overflow-y-auto">
                    {transcript ? (transcript.text || JSON.stringify(transcript, null, 2)) : 'No analysis available.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#b2a491]/10 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[#b2a491] hover:bg-[#302927]">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-[#ede8df] text-[#171616] font-medium hover:bg-[#d9d3c9]">Save Changes</button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
};

// --- Main Page ---

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos?limit=100&t=${Date.now()}`, { cache: 'no-store' });
      const data: any = await res.json();
      // Filter out clips from the main view
      const mainVideos = (data.videos || []).filter((v: Video) => v.type !== 'clip');
      setVideos(mainVideos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  return (
    <ScreenLayout>
      <ScrollContainer>
        <div className="max-w-7xl mx-auto p-6 sm:p-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-3xl font-bold text-[#ede8df] tracking-tight">Video Library</h1>
              <p className="text-[#b2a491] mt-1">Manage, analyze, and publish your content.</p>
            </div>
            <button 
              onClick={() => setIsUploading(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[#ede8df] text-[#171616] rounded-full font-medium hover:bg-[#d9d3c9] transition-transform hover:scale-105 shadow-lg shadow-[#ede8df]/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Video
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => <div key={i} className="aspect-video bg-[#302927]/30 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {videos.map(video => (
                  <VideoCard 
                    key={video.id} 
                    video={video} 
                    onClick={() => setSelectedVideo(video)} 
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Modals */}
          <AnimatePresence>
            {isUploading && (
              <AddVideoModal 
                onClose={() => setIsUploading(false)} 
                onComplete={() => { setIsUploading(false); loadVideos(); }} 
              />
            )}
            {selectedVideo && (
              <DetailModal 
                video={selectedVideo} 
                onClose={() => setSelectedVideo(null)} 
                onUpdate={loadVideos} 
              />
            )}
          </AnimatePresence>
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}
function setClips(clips: any[]) {
  // Stub function to prevent ReferenceError in AddVideoModal
  // which calls setClips but does not define it as local state.
  console.log("Clips loaded:", clips);
}

