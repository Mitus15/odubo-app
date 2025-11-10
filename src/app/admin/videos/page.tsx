"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import ScreenLayout from "@/components/ui/ScreenLayout";
import ScrollContainer from "@/components/ui/ScrollContainer";

// Example video schema fields (customize as needed)
// id, title, description, url, thumbnail, duration, category, is_public, created_at

type Credit = { name: string; role: string };

type Video = {
  id: number;
  title: string;
  artist_name?: string;
  description: string;
  url: string;
  uid?: string;
  poster_url?: string;
  thumbnail?: string;
  duration: string;
  category: string;
  is_public: boolean | number;
  type?: string;
  mood?: string;
  credits?: Credit[] | string;
  related_projects?: string[] | string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type FormState = {
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  category: string;
  is_public: boolean;
  type: string;
  mood: string;
  credits: Credit[];
  related_projects: string[];
  file: File | null;
  poster: File | null;
};

type Candidate = { id: number; url: string; pct: number; rank: number; rationale?: string };

export default function AdminVideosPage() {
  // Core data state
  const [videos, setVideos] = useState<Video[]>([]);
  const [filterPublication, setFilterPublication] = useState<'all' | 'live' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [showThumbModal, setShowThumbModal] = useState(false);
  // Toast notifications stack
  const [toasts, setToasts] = useState<{ id: string; message: string; type?: 'success' | 'error' | 'info'; ttl: number }[]>([]);
  // Hover analysis preview
  const [hoverAnalysis, setHoverAnalysis] = useState<{ id: number; content: string } | null>(null);
  // Analysis status map: basic (ai_description only) or deep (videos_analysis row with richer fields)
  const [analysisStatus, setAnalysisStatus] = useState<Record<number, 'deep' | 'basic' | null>>({});
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    thumbnail: "",
    duration: "",
    category: "",
    is_public: true,
    type: "music-video",
    mood: "neutral",
    credits: [],
    related_projects: [],
    file: null,
    poster: null,
  });
  const [useExistingUrl, setUseExistingUrl] = useState(false);
  const [streamUid, setStreamUid] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<'form' | 'uploading' | 'analyzing' | 'awaiting_choice' | 'finalizing'>('form');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [choicePct, setChoicePct] = useState<number | null>(null);
  const [publicationStatus, setPublicationStatus] = useState<'live' | 'archived'>('archived');
  
  // Minimal progress state (simplified UX)
  const [pollingActive, setPollingActive] = useState(false);

  // Fetch videos list (unpaginated; client filters applied)
  const loadVideos = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '500'); // generous upper bound
      params.set('offset', '0');
      if (filterPublication !== 'all') params.set('publication_status', filterPublication);
      const res = await fetch(`/api/videos?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load videos');
      const data = await res.json() as { videos: any[] };
      const raw = data.videos || [];
      const normalized: Video[] = raw.map((v: any) => ({
        id: Number(v.id),
        title: v.title || '',
        artist_name: v.artist_name || '',
        description: v.description || '',
        url: v.url || v.video_url || '',
        uid: v.uid || '',
        poster_url: v.poster_url || v.thumbnail_url || '',
        thumbnail: v.thumbnail || v.thumbnail_url || '',
        duration: String(v.duration || ''),
        category: v.category || '',
        is_public: v.is_public === 1 || v.is_public === true,
        type: v.type || '',
        mood: v.mood || '',
        credits: Array.isArray(v.credits) ? v.credits : (() => { try { return JSON.parse(v.credits || '[]'); } catch { return []; } })(),
        related_projects: Array.isArray(v.related_projects) ? v.related_projects : (() => { try { return JSON.parse(v.related_projects || '[]'); } catch { return []; } })(),
        status: v.status || 'published',
        created_at: v.created_at,
        updated_at: v.updated_at,
      })).filter((v: Video) => v && typeof v.id !== 'undefined' && typeof v.title === 'string' && v.title.trim() !== '');
      setVideos(normalized);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  }, [filterPublication]);
  useEffect(() => { loadVideos(); }, [loadVideos]);
  // After videos load, lazily fetch analysis presence (limited) to decorate with badges
  useEffect(() => {
    if (!videos.length) return;
    const subset = videos.slice(0, 120); // cap for performance
    let cancelled = false;
    (async () => {
      const statusMap: Record<number, 'deep' | 'basic' | null> = {};
      await Promise.all(subset.map(async v => {
        try {
          const res = await fetch(`/api/videos/${v.id}/analysis`);
          if (res.ok) {
            const j: any = await res.json();
            const a = j?.analysis;
            if (a) {
              if (a.style_palette || a.shots_signature || a.transcript_json || (a.themes && a.themes.length > 3)) {
                statusMap[v.id] = 'deep';
              } else {
                statusMap[v.id] = 'basic';
              }
            } else if ((v as any).ai_description) {
              statusMap[v.id] = 'basic';
            } else {
              statusMap[v.id] = null;
            }
          } else {
            statusMap[v.id] = (v as any).ai_description ? 'basic' : null;
          }
        } catch {
          statusMap[v.id] = (v as any).ai_description ? 'basic' : null;
        }
      }));
      if (!cancelled) setAnalysisStatus(prev => ({ ...prev, ...statusMap }));
    })();
    return () => { cancelled = true; };
  }, [videos]);

  // Derived filtered list
  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (v.title || '').toLowerCase().includes(s) || (v.description || '').toLowerCase().includes(s);
    });
  }, [videos, search]);

  // Simple helpers
  const resetForm = () => setForm({ title: "", description: "", thumbnail: "", duration: "", category: "", is_public: true, type: "music-video", mood: "neutral", credits: [], related_projects: [], file: null, poster: null });

  // Toast helper
  const pushToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', ttlMs = 5000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, message, type, ttl: Date.now() + ttlMs }]);
    // Auto remove
    setTimeout(() => {
      setToasts(ts => ts.filter(t => t.id !== id));
    }, ttlMs + 50);
  }, []);

  // Clean expired (just in case)
  useEffect(() => {
    const interval = setInterval(() => {
      setToasts(ts => ts.filter(t => t.ttl > Date.now()));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Handle input changes
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((f) => ({ ...f, [name]: checked }));
    } else if (type === "file") {
      const file = (e.target as HTMLInputElement).files?.[0] || null;
      setForm((f) => ({ ...f, [name]: file }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  }

  // Minimal edit modal fields only (no credits/related here)

  // Enhanced polling function with better progress tracking
  async function pollSessionStatus(sessionId: number, maxAttempts = 30, intervalMs = 2000): Promise<boolean> {
    setPollingActive(true);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const authHeaders: Record<string, string> = {};
        if (token) {
          try {
            JSON.parse(atob(token.split(".")[1]));
            authHeaders["Authorization"] = `Bearer ${token}`;
          } catch {}
        }

        // Check session status
        const statusRes = await fetch(`/api/videos/upload-session/status?sessionId=${sessionId}`, {
          headers: authHeaders
        });
        
        if (statusRes.ok) {
          const statusData = await statusRes.json() as any;
          if (statusData.status === 'error') throw new Error(statusData.message || 'Session processing failed');
        }

        // Check for candidates
        const candRes = await fetch(`/api/videos/thumbnail/candidates?sessionId=${sessionId}`, { 
          headers: authHeaders 
        });
        
        if (candRes.ok) {
          const data = await candRes.json() as any;
          const candidateList = (data.candidates || []) as any[];
          
          if (candidateList.length > 0) {
            const mappedCandidates = candidateList.map((c: any) => ({ 
              id: Number(c.id), 
              url: c.url, 
              pct: Number(c.pct ?? 0.5), 
              rank: Number(c.rank ?? 0), 
              rationale: c.rationale 
            }));
            
            setCandidates(mappedCandidates);
            setShowThumbModal(true);
            setPollingActive(false);
            return true;
          }
        }
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        
      } catch (error: any) {
        console.error(`Polling attempt ${attempt} failed:`, error);
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Exponential backoff for retries
        const backoffMs = Math.min(intervalMs * Math.pow(1.5, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
    
    setPollingActive(false);
    throw new Error(`Timeout: No thumbnail candidates found after ${maxAttempts} attempts`);
  }

  // Create or Update video
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // (Simplified UI) Removed detailed progress state resets
    
    try {
      const method = editingId ? "PUT" : "POST";

      // If creating with existing Stream UID (no file upload)
      if (!editingId && useExistingUrl && streamUid) {
        pushToast('Creating video record with Stream ID…', 'info');
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const authHeaders: Record<string, string> = {};
        if (token) {
          try {
            JSON.parse(atob(token.split(".")[1]));
            authHeaders["Authorization"] = `Bearer ${token}`;
          } catch {}
        }

        // Use UID directly
        const uid = streamUid.trim();
        
        // Construct standard HLS URL
        const videoUrl = `https://customer-tpkm273r1u0s40no.cloudflarestream.com/${uid}/manifest/video.m3u8`;

        // Create video record directly
        const payload: any = {
          title: form.title,
          description: form.description,
          url: videoUrl,
          uid: uid,
          category: form.category,
          is_public: form.is_public,
          type: form.type,
          mood: form.mood,
          publication_status: publicationStatus,
        };

        const createRes = await fetch('/api/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload),
        });
        if (!createRes.ok) {
          const errJson = await createRes.json().catch(() => ({}));
          throw new Error((errJson as any)?.error || 'Failed to create video');
        }

        // Reload to get the new video ID
        pushToast('Fetching video details…', 'info');
        await new Promise(r => setTimeout(r, 500)); // Brief pause for DB commit
        
        const refreshRes = await fetch('/api/videos?limit=500&offset=0', { headers: authHeaders });
        if (!refreshRes.ok) throw new Error('Failed to reload videos');
        const refreshData = await refreshRes.json() as any;
        const freshVideos = (refreshData.videos || []) as Video[];
        
        const newVideo = freshVideos.find(v => v.url === videoUrl || (v as any).uid === uid);
        if (!newVideo) {
          pushToast('Video created! Reload the page to see it and run analysis manually.', 'success');
          resetForm();
          setStreamUid('');
          setUseExistingUrl(false);
          setLoading(false);
          return;
        }

        // Auto-trigger thumbnail generation
        pushToast('Generating AI-ranked thumbnails…', 'info');
        try {
          const thumbRes = await fetch('/api/videos/thumbnail/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ videoId: newVideo.id, uid: uid }),
          });
          if (!thumbRes.ok) {
            const errText = await thumbRes.text();
            console.error('Thumbnail generation failed:', thumbRes.status, errText);
            throw new Error(`Thumbnail generation returned ${thumbRes.status}`);
          }
          const thumbData = await thumbRes.json() as any;
          console.log('Thumbnail generation result:', thumbData);
          
          if (thumbData.candidates && thumbData.candidates.length > 0) {
            pushToast(`Generated ${thumbData.candidates.length} thumbnail options`, 'success');
            setCandidates(thumbData.candidates.map((c: any) => ({ 
              id: Number(c.id || 0), 
              url: c.url, 
              pct: Number(c.pct ?? 0.5), 
              rank: Number(c.rank ?? 0), 
              rationale: c.rationale 
            })));
            setShowThumbModal(true);
            setPhase('awaiting_choice');
          } else {
            pushToast('Thumbnails generated (using default)', 'success');
          }
        } catch (e: any) {
          console.error('Thumbnail generation error:', e);
          pushToast(`Thumbnail generation failed: ${e.message}`, 'error');
        }

        // Final reload to show updated video
        await loadVideos();
        resetForm();
        setStreamUid('');
        setUseExistingUrl(false);
        setLoading(false);
        
        if (!showThumbModal) {
          pushToast('Video created successfully!', 'success');
        }
        return;
      }

      // If creating with a file, prefer direct-to-Stream flow for progress and resilience
      if (!editingId && form.file) {
  setPhase('uploading');
  pushToast('Preparing upload (requesting direct upload URL)…', 'info');
        // 1) Request a Stream direct upload URL with metadata
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const authHeaders: Record<string, string> = {};
        if (token) {
          try {
            JSON.parse(atob(token.split(".")[1]));
            authHeaders["Authorization"] = `Bearer ${token}`;
          } catch {}
        }

        const metaPayload = {
          title: form.title,
          artist_name: "",
          description: form.description,
          category: form.category,
          is_public: form.is_public,
          type: form.type,
          mood: form.mood,
          credits: form.credits,
          related_projects: form.related_projects,
        };
        // Helper: proxy upload fallback flow
        const runProxyUpload = async () => {
          const fd = new FormData();
          fd.append('file', form.file as File);
          fd.append('title', metaPayload.title || '');
          fd.append('is_public', metaPayload.is_public ? '1' : '0');
          fd.append('artist_name', metaPayload.artist_name || '');
          fd.append('description', metaPayload.description || '');
          fd.append('category', metaPayload.category || '');
          fd.append('type', metaPayload.type || '');
          fd.append('mood', metaPayload.mood || '');
          fd.append('credits', JSON.stringify(metaPayload.credits || []));
          fd.append('related_projects', JSON.stringify(metaPayload.related_projects || []));

          const pr = await fetch('/api/videos/stream/upload-proxy', { method: 'POST', body: fd, headers: { ...authHeaders } });
          const pj: any = await pr.json().catch(() => ({}));
          if (!pr.ok) throw new Error((pj && (pj.details || pj.error)) || 'Proxy upload failed');
          const uid = String(pj.uid || '');
          if (!uid) throw new Error('Proxy upload returned no uid');

          const createRes = await fetch('/api/videos/upload-session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ uid, meta: metaPayload }),
          });
          if (!createRes.ok) throw new Error('Failed to create upload session');
          const { sessionId } = await createRes.json() as any;
          setSessionId(sessionId);

          setPhase('analyzing');
          const suggestRes = await fetch('/api/videos/thumbnail/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ sessionId }),
          });
          if (!suggestRes.ok) {
            let details = '';
            try { const j: any = await suggestRes.json(); details = (j && j.error) || ''; } catch {}
            throw new Error(`Failed to start thumbnail suggestion${details ? `: ${details}` : ''}`);
          }

          const poll = async () => {
            for (let i = 0; i < 15; i++) {
              const candRes = await fetch(`/api/videos/thumbnail/candidates?sessionId=${sessionId}`, { headers: { ...authHeaders } });
              if (candRes.ok) {
                const data = await candRes.json() as any;
                const list = (data.candidates || []) as any[];
                if (list.length > 0) {
                  setCandidates(list.map((c: any) => ({ id: Number(c.id), url: c.url, pct: Number(c.pct ?? 0.5), rank: Number(c.rank ?? 0), rationale: c.rationale })));
                  setPhase('awaiting_choice');
                  return;
                }
              }
              await new Promise(r => setTimeout(r, 1000));
            }
            throw new Error('Timed out waiting for thumbnail candidates');
          };
          await poll();
        };

        // Direct upload attempt with graceful fallback to proxy
        try {
          const duRes = await fetch('/api/videos/stream/direct-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(metaPayload),
          });
          if (!duRes.ok) {
            // fallback to proxy
            pushToast('Direct upload URL failed. Falling back to proxy upload…', 'error');
            await runProxyUpload();
            setLoading(false);
            return;
          }
          const duJson = await duRes.json() as any;
          const uploadURL = duJson.uploadURL as string;
          const uid = duJson.uid as string;

          const uploadForm = new FormData();
          uploadForm.append('file', form.file);
          try {
            pushToast('Uploading file directly to Stream…', 'info');
            const upRes = await fetch(uploadURL, { method: 'POST', body: uploadForm });
            if (!upRes.ok) throw new Error('Upload to Stream failed');
          } catch (err) {
            // Fallback to proxy on any upload error
            pushToast('Direct upload failed. Using proxy upload…', 'error');
            await runProxyUpload();
            setLoading(false);
            return;
          }

          pushToast('Creating upload session…', 'info');
          const createRes = await fetch('/api/videos/upload-session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ uid, meta: metaPayload }),
          });
          if (!createRes.ok) throw new Error('Failed to create upload session');
          const { sessionId } = await createRes.json() as any;
          setSessionId(sessionId);

          setPhase('analyzing');
          pushToast('Starting thumbnail suggestion…', 'info');
          const suggestRes = await fetch('/api/videos/thumbnail/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ sessionId }),
          });
          if (!suggestRes.ok) {
            let details = '';
            try { const j: any = await suggestRes.json(); details = (j && j.error) || ''; } catch {}
            throw new Error(`Failed to start thumbnail suggestion${details ? `: ${details}` : ''}`);
          }

          const poll = async () => {
            for (let i = 0; i < 15; i++) { // ~15 * 1s = 15s max
              pushToast(`Checking thumbnail candidates (attempt ${i+1}/15)…`, 'info', 2500);
              const candRes = await fetch(`/api/videos/thumbnail/candidates?sessionId=${sessionId}`, { headers: { ...authHeaders } });
              if (candRes.ok) {
                const data = await candRes.json() as any;
                const list = (data.candidates || []) as any[];
                if (list.length > 0) {
                  setCandidates(list.map((c: any) => ({ id: Number(c.id), url: c.url, pct: Number(c.pct ?? 0.5), rank: Number(c.rank ?? 0), rationale: c.rationale })));
                  setPhase('awaiting_choice');
                  pushToast('Thumbnail candidates ready. Choose one or use Best.', 'success');
                  return;
                }
              }
              await new Promise(r => setTimeout(r, 1000));
            }
            throw new Error('Timed out waiting for thumbnail candidates');
          };
          await poll();
          setLoading(false);
          return; // stop here; user must choose thumbnail then finalize below
        } catch (err:any) {
          // Any failure on direct path -> fallback to proxy
          try {
            pushToast('Unexpected error on direct flow. Using proxy upload…', 'error');
            await runProxyUpload();
            setLoading(false);
            return;
          } catch (pErr:any) {
            throw pErr;
          }
        }
      }

      // Fallback to existing paths (metadata-only create or update)
      const endpoint = editingId ? `/api/videos/${editingId}` : "/api/videos";
      let body: FormData | string;
      let headers: Record<string, string> = {};
      // Metadata-only create/update
      const payload: any = { ...form } as any;
      delete payload.file;
      delete payload.poster;
      (payload as any).is_public = !!payload.is_public;
      (payload as any).credits = form.credits;
      (payload as any).related_projects = form.related_projects;
      payload.publication_status = publicationStatus;
      body = JSON.stringify(payload);
      headers["Content-Type"] = "application/json";

      const res = await fetch(endpoint, { method, headers, body } as any);
      if (!res.ok) throw new Error("Failed to save video");
      // Reload list
      await fetch("/api/videos").then(r => r.json()).then((d: any) => {
        const list = (d.videos || []) as any[];
        const normalized: Video[] = list.map((v: any) => ({
          id: Number(v.id),
          title: v.title || '',
          artist_name: v.artist_name || '',
          description: v.description || '',
          url: v.url || v.video_url || '',
          poster_url: v.poster_url || v.thumbnail_url || '',
          thumbnail: v.thumbnail || v.thumbnail_url || '',
          duration: String(v.duration || ''),
          category: v.category || '',
          is_public: v.is_public === 1 || v.is_public === true,
          type: v.type || '',
          mood: v.mood || '',
          credits: Array.isArray(v.credits) ? v.credits : (() => { try { return JSON.parse(v.credits || '[]'); } catch { return []; } })(),
          related_projects: Array.isArray(v.related_projects) ? v.related_projects : (() => { try { return JSON.parse(v.related_projects || '[]'); } catch { return []; } })(),
          status: v.status || 'published',
          created_at: v.created_at,
          updated_at: v.updated_at,
        }));
        setVideos(normalized);
      });
      resetForm();
      setEditingId(null);
    } catch (err: any) {
      setError(err.message);
      try { if (err?.message) pushToast(err.message, 'error'); } catch {}
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalize() {
    if (!editingId) {
      pushToast('No video selected', 'error');
      return;
    }
    
    setLoading(true);
    setPhase('finalizing');
    
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const authHeaders: Record<string, string> = {};
      if (token) {
        try { JSON.parse(atob(token.split(".")[1])); authHeaders["Authorization"] = `Bearer ${token}`; } catch {}
      }
      
      // Find the selected candidate
      const selectedCandidate = candidates.find(c => c.pct === choicePct) || candidates[0];
      
      if (!selectedCandidate) {
        throw new Error('No thumbnail selected');
      }
      
      // Update the video with the selected thumbnail
      const res = await fetch(`/api/videos/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ 
          poster_url: selectedCandidate.url,
          thumbnail: selectedCandidate.url,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to update video thumbnail');

      pushToast('Thumbnail saved!', 'success');
      
      // Refresh list
      await loadVideos();

      // Reset UI
      setShowThumbModal(false);
      setCandidates([]);
      setChoicePct(null);
      setEditingId(null);
      setPhase('form');
    } catch (e: any) {
      setError(e.message);
      pushToast(e.message || 'Failed to save thumbnail', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Edit video
  function handleEdit(video: Video) {
    setForm({
      title: video.title,
      description: video.description,
      thumbnail: video.thumbnail || video.poster_url || '',
      duration: video.duration,
      category: video.category,
      is_public: (video.is_public as any) === true || (video.is_public as any) === 1,
      type: String(video.type || '').toLowerCase().replace(/\s+/g, '-') || 'music-video',
      mood: (video.mood as any) || '',
      credits: (Array.isArray(video.credits) ? video.credits : (() => { try { return JSON.parse((video.credits as any) || '[]'); } catch { return []; } })()),
      related_projects: (Array.isArray(video.related_projects) ? video.related_projects : (() => { try { return JSON.parse((video.related_projects as any) || '[]'); } catch { return []; } })()),
      file: null,
      poster: null,
    });
    setEditingId(video.id);
    // Reset wizard phases when editing existing
    setPhase('form');
    setSessionId(null);
    setCandidates([]);
    setChoicePct(null);
  }

  // Delete video
  async function handleDelete(id: number) {
    if (!confirm('Delete this video?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete video');
      setVideos(prev => prev.filter(v => v.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Simplified list view: no credits/related parsing needed

  return (
    <ScreenLayout>
      <ScrollContainer>
    <div className="max-w-5xl mx-auto mt-6 p-3 sm:p-8 bg-[#302927]/60 border border-[#b2a491]/20 rounded-2xl shadow-lg text-[#ede8df]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-wide">Videos</h1>
      </div>

      {/* Controls: simple search and publication filter */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Search
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="title or description" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df]" />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium">Publication
            <select value={filterPublication} onChange={e => setFilterPublication(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df]">
              <option value="all">All</option>
              <option value="live">Live</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <div></div>
      </div>

      {/* Publication status selector (applies to metadata-only flow and finalize step) */}
      <div className="mb-4">
        <label className="block text-sm font-medium">Publication Status</label>
        <select value={publicationStatus} onChange={(e) => setPublicationStatus(e.target.value as 'live' | 'archived')} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] focus:outline-none focus:ring-1 focus:ring-[#ede8df] max-w-xs">
          <option value="archived">Archived</option>
          <option value="live">Live</option>
        </select>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mb-10" encType="multipart/form-data">
        {/* Toggle between file upload and existing URL */}
        <div className="flex items-center gap-4 p-3 bg-[#171616] border border-[#b2a491]/20 rounded-md">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useExistingUrl}
              onChange={(e) => {
                setUseExistingUrl(e.target.checked);
                if (e.target.checked) setForm(f => ({ ...f, file: null }));
                else setStreamUid('');
              }}
              className="w-4 h-4 rounded border-[#b2a491]/30 bg-[#171616] text-[#ede8df] focus:ring-[#ede8df]"
            />
            <span>Use existing Stream URL (skip upload)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm font-medium">Title
            <input name="title" value={form.title} onChange={handleChange} placeholder="Enter title" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" required />
          </label>
          <label className="block text-sm font-medium">Category
            <input name="category" value={form.category} onChange={handleChange} placeholder="Category (optional)" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" />
          </label>
          {/* AI-derived fields like mood, duration, thumbnail are not editable here */}
          <div className="flex items-center gap-3 sm:col-span-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_public" checked={form.is_public} onChange={handleChange} className="w-4 h-4 rounded border-[#b2a491]/30 bg-[#171616] text-[#ede8df] focus:ring-[#ede8df]" />
              <span>Public</span>
            </label>
          </div>
          {useExistingUrl ? (
            <label className="block text-sm font-medium sm:col-span-2">Stream Video ID
              <input
                type="text"
                value={streamUid}
                onChange={(e) => setStreamUid(e.target.value)}
                placeholder="e2b9dd98e165a671c40938b4c0478bc9"
                className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]"
                required={!editingId}
              />
              <span className="text-xs text-[#b2a491] mt-1">Paste the 32-character Stream video ID from Cloudflare dashboard</span>
            </label>
          ) : (
            <label className="block text-sm font-medium sm:col-span-2">Video File
              <input key="file-upload" type="file" name="file" accept="video/*" onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#302927] file:text-[#b2a491]" required={!editingId} />
            </label>
          )}
          {/* Poster upload available later per-row */}
        </div>
        {error && <div className="text-red-600">{error}</div>}
        <button type="submit" className="py-2 px-4 rounded-md bg-[#ede8df] text-[#171616] hover:bg-[#d9d3c9] w-full sm:w-auto" disabled={loading}>
          {editingId ? (loading ? "Saving..." : "Update Video") : loading ? "Creating..." : "Create Video"}
        </button>
        <button
          type="button"
          className="ml-0 sm:ml-2 mt-2 sm:mt-0 py-2 px-4 rounded-md bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60 w-full sm:w-auto"
          onClick={async () => {
            try {
              setLoading(true);
              await fetch('/api/videos/sync-all', { method: 'POST' });
              pushToast('Requested Stream metadata sync for all videos', 'info');
            } catch (e) {
              console.error(e);
              pushToast('Sync-all failed', 'error');
            } finally {
              setLoading(false);
            }
          }}
        >
          Sync All to Stream
        </button>
        {editingId && (
          <button
            type="button"
            className="ml-0 sm:ml-2 mt-2 sm:mt-0 py-2 px-4 rounded-md bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60 w-full sm:w-auto"
            onClick={() => {
              resetForm();
              setEditingId(null);
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* Thumbnail selection modal (simplified) */}
      {showThumbModal && phase === 'awaiting_choice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-3xl bg-[#171616] border border-[#b2a491]/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Choose a thumbnail</h3>
              <button className="px-2 py-1 rounded bg-[#302927] text-[#b2a491]" onClick={() => setShowThumbModal(false)}>Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-auto">
              {candidates.map((c) => (
                <button key={c.id} className={`text-left p-2 rounded-md border ${choicePct === c.pct ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#b2a491]/20'} bg-[#171616] hover:border-indigo-400 transition-colors`}
                  onClick={() => setChoicePct(c.pct)}>
                  <div className="w-full bg-black rounded overflow-hidden mb-2" style={{ aspectRatio: '16/9' }}>
                    <img src={c.url} alt={`thumb-${c.rank}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-xs text-[#b2a491]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">#{c.rank}</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-300">Score: {c.rank}/10</span>
                    </div>
                    {c.rationale && (
                      <p className="text-[10px] text-[#b2a491]/80 line-clamp-2">{c.rationale}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button 
                className="px-3 py-2 rounded bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60" 
                onClick={() => { 
                  // Use the best ranked candidate (first one after sorting)
                  setChoicePct(candidates[0]?.pct || null); 
                  handleFinalize(); 
                }}
                disabled={!candidates.length || loading}
              >
                Use Best ({candidates[0]?.rank || '-'})
              </button>
              <button 
                className="px-3 py-2 rounded bg-[#ede8df] text-[#171616] hover:bg-[#b2a491] disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={() => { handleFinalize(); }}
                disabled={!choicePct || loading}
              >
                Save Selected
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">All Videos</h2>
        {/* Simple list */}
        <div className="block sm:hidden space-y-4">
          {filteredVideos
            .filter(video => video && video.title) // Extra safety check
            .map((video) => (
            <div key={video.id} className="border border-[#b2a491]/20 rounded p-3 shadow-sm bg-[#302927]/60 text-[#ede8df]">
              <div className="font-bold text-base mb-1 flex items-center flex-wrap gap-2">
                <span>{video.title}</span>
              </div>
              {video.poster_url && (
                <div className="mb-2">
                  <img src={video.poster_url} alt="thumbnail" className="w-full max-w-[200px] h-auto object-cover rounded border border-[#b2a491]/30" />
                </div>
              )}
              <div className="text-xs text-[#b2a491] mb-1">Public: <span className="font-medium text-[#ede8df]">{video.is_public ? "Yes" : "No"}</span></div>
              <div className="flex gap-2 mt-2">
                <button className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-[#ede8df] text-[#171616]" onClick={() => handleEdit(video)}>Edit</button>
                <button className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-red-500 text-white" onClick={() => handleDelete(video.id)}>Delete</button>
                <button
                  className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-indigo-600 text-white"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      pushToast('Generating thumbnails…', 'info');
                      
                      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                      const authHeaders: Record<string, string> = {};
                      if (token) {
                        try { JSON.parse(atob(token.split(".")[1])); authHeaders["Authorization"] = `Bearer ${token}`; } catch {}
                      }
                      
                      // Extract UID from video.uid or parse from URL
                      let extractedUid = video.uid;
                      if (!extractedUid && video.url) {
                        const streamMatch = video.url.match(/cloudflarestream\.com\/([a-f0-9]{32})/i);
                        if (streamMatch) {
                          extractedUid = streamMatch[1];
                        }
                      }
                      
                      const res = await fetch('/api/videos/thumbnail/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                        body: JSON.stringify({ 
                          videoId: video.id,
                          uid: extractedUid 
                        }),
                      });
                      
                      if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(`Thumbnail generation failed: ${errText}`);
                      }
                      
                      const thumbData = await res.json() as any;
                      
                      if (thumbData.candidates && thumbData.candidates.length > 0) {
                        pushToast(`Generated ${thumbData.candidates.length} thumbnail options`, 'success');
                        setCandidates(thumbData.candidates.map((c: any) => ({ 
                          id: Number(c.id || 0), 
                          url: c.url, 
                          pct: Number(c.pct ?? 0.5), 
                          rank: Number(c.rank ?? 0), 
                          rationale: c.rationale 
                        })));
                        setEditingId(video.id);
                        setShowThumbModal(true);
                        setPhase('awaiting_choice');
                      } else {
                        pushToast('Thumbnails generated', 'success');
                        await loadVideos();
                      }
                    } catch (e: any) {
                      console.error('Thumbnail generation error:', e);
                      pushToast(e.message || 'Thumbnail generation failed', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Thumbnails
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border border-[#b2a491]/20 text-sm sm:text-base text-[#ede8df]">
            <thead>
              <tr className="bg-[#302927]">
                <th className="p-3">Thumbnail</th>
                <th className="p-3">Title</th>
                <th className="p-3">Publication</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVideos.map((video) => (
                <tr key={video.id} className="border-t border-[#b2a491]/20">
                  <td className="p-3 align-top">
                    {video.poster_url ? (
                      <img src={video.poster_url} alt="thumbnail" className="w-24 h-14 object-cover rounded border border-[#b2a491]/30" />
                    ) : (
                      <div className="w-24 h-14 bg-[#302927] rounded border border-[#b2a491]/30 flex items-center justify-center text-xs text-[#b2a491]">
                        No thumb
                      </div>
                    )}
                  </td>
                  <td className="p-3 align-top break-words max-w-[160px] sm:max-w-none">
                    <span>{video.title}</span>
                  </td>
                  <td className="p-3 align-top">{(video as any).publication_status || 'archived'}</td>
                  <td className="p-3 flex flex-col sm:flex-row gap-2">
                    <button className="py-1 px-3 rounded text-xs sm:text-base bg-[#ede8df] text-[#171616]" onClick={() => handleEdit(video)}>Edit</button>
                    <button className="py-1 px-3 rounded text-xs sm:text-base bg-red-500 text-white" onClick={() => handleDelete(video.id)}>Delete</button>
                    <button
                      className="py-1 px-3 rounded text-xs sm:text-base bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const res = await fetch(`/api/videos/${video.id}/sync`, { method: 'POST' });
                          if (!res.ok) throw new Error('Sync failed');
                          pushToast('Synced to Stream', 'success');
                        } catch (e) {
                          console.error(e);
                          pushToast('Sync failed', 'error');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Sync to Stream
                    </button>
                    <button
                      className="py-1 px-3 rounded text-xs sm:text-base bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          pushToast('Generating thumbnails…', 'info');
                          
                          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                          const authHeaders: Record<string, string> = {};
                          if (token) {
                            try { JSON.parse(atob(token.split(".")[1])); authHeaders["Authorization"] = `Bearer ${token}`; } catch {}
                          }
                          
                          // Extract UID from video.uid or parse from URL
                          let extractedUid = video.uid;
                          if (!extractedUid && video.url) {
                            // Try to extract from Cloudflare Stream URL patterns:
                            // https://customer-ACCOUNT.cloudflarestream.com/UID/manifest/video.m3u8
                            // https://stream.mux.com/UID.m3u8
                            const streamMatch = video.url.match(/cloudflarestream\.com\/([a-f0-9]{32})/i);
                            if (streamMatch) {
                              extractedUid = streamMatch[1];
                            }
                          }
                          
                          const res = await fetch('/api/videos/thumbnail/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...authHeaders },
                            body: JSON.stringify({ 
                              videoId: video.id,
                              uid: extractedUid 
                            }),
                          });
                          
                          if (!res.ok) {
                            const errText = await res.text();
                            throw new Error(`Thumbnail generation failed: ${errText}`);
                          }
                          
                          const thumbData = await res.json() as any;
                          console.log('Thumbnail generation response:', thumbData);
                          
                          if (thumbData.candidates && thumbData.candidates.length > 0) {
                            pushToast(`Generated ${thumbData.candidates.length} thumbnail options`, 'success');
                            const mappedCandidates = thumbData.candidates.map((c: any) => ({ 
                              id: Number(c.id || 0), 
                              url: c.url, 
                              pct: Number(c.pct ?? 0.5), 
                              rank: Number(c.rank ?? 0), 
                              rationale: c.rationale 
                            }));
                            console.log('Setting candidates:', mappedCandidates);
                            setCandidates(mappedCandidates);
                            setEditingId(video.id);
                            setShowThumbModal(true);
                            setPhase('awaiting_choice');
                            console.log('Modal should now be visible');
                          } else {
                            pushToast('Thumbnails generated (using default)', 'success');
                            await loadVideos();
                          }
                        } catch (e: any) {
                          console.error('Thumbnail generation error:', e);
                          pushToast(e.message || 'Thumbnail generation failed', 'error');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Generate Thumbnails
                    </button>
                    {/* Manual thumbnail upload */}
                    <label className="inline-flex items-center gap-2 py-1 px-3 rounded text-xs sm:text-base bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60 cursor-pointer">
                      <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          setLoading(true);
                          const fd = new FormData();
                          fd.append('file', file);
                          fd.append('videoId', String(video.id));
                          const res = await fetch('/api/videos/thumbnail/upload', { method: 'POST', body: fd });
                          if (!res.ok) throw new Error('Upload failed');
                          await loadVideos();
                          pushToast('Thumbnail updated', 'success');
                        } catch (err) {
                          console.error(err);
                          pushToast('Thumbnail upload failed', 'error');
                        } finally {
                          setLoading(false);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }} />
                      <span>Upload Poster</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[280px]">
        {toasts.map(t => (
          <div key={t.id} className={`px-3 py-2 rounded-md text-sm shadow-md border backdrop-blur bg-[#171616]/80 border-[#b2a491]/30 flex items-start gap-2`}> 
            <span className={`inline-block w-2 h-2 mt-1 rounded-full ${t.type==='success' ? 'bg-green-400' : t.type==='error' ? 'bg-red-500' : 'bg-[#b2a491]'}`}></span>
            <div className="flex-1 text-[#ede8df] leading-snug">{t.message}</div>
            <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} className="text-[#b2a491] hover:text-[#ede8df] text-xs">✕</button>
          </div>
        ))}
      </div>
      {/* Hover analysis tooltip */}
      {hoverAnalysis && (
        <div className="pointer-events-none fixed z-50 text-xs max-w-xs p-2 rounded-md bg-[#171616]/90 border border-[#b2a491]/30 text-[#ede8df]" style={{ left: 'calc(100% - 320px)', bottom: '140px' }}>
          {hoverAnalysis.content}
        </div>
      )}
    </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}
// end
