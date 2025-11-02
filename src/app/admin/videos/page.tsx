"use client";
import { useState, useEffect } from "react";
import ScreenLayout from "@/components/ui/ScreenLayout";
import ScrollContainer from "@/components/ui/ScrollContainer";

// Example video schema fields (customize as needed)
// id, title, description, url, thumbnail, duration, category, is_public, created_at

type Credit = {
  name: string;
  role: string;
};

type Video = {
  id: number;
  title: string;
  artist_name?: string;
  description: string;
  url: string;
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
  const [videos, setVideos] = useState<Video[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [filterPublication, setFilterPublication] = useState<'all' | 'live' | 'archived'>('all');
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<'form' | 'uploading' | 'analyzing' | 'awaiting_choice' | 'finalizing'>('form');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [choicePct, setChoicePct] = useState<number | null>(null);
  const [publicationStatus, setPublicationStatus] = useState<'live' | 'archived'>('archived');
  
  // Enhanced progress tracking
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [pollingActive, setPollingActive] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'created' | 'uploaded' | 'analyzing' | 'ready' | 'completed' | 'error'>('created');

  // Fetch videos (Read) with pagination and optional publication filter
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    params.set('offset', String(page * pageSize));
    if (filterPublication !== 'all') params.set('publication_status', filterPublication);
    fetch(`/api/videos?${params.toString()}`)
      .then((res) => res.json() as Promise<{ videos: any[] }>)
      .then((data) => {
        const raw = data.videos || [];
        const normalized: Video[] = raw.map((v: any) => ({
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
        })).filter((v: Video) => v && typeof v.id !== 'undefined' && typeof v.title === 'string' && v.title.trim() !== '');
        setVideos(normalized);
      })
    .catch(console.error);
  }, [page, pageSize, filterPublication]);

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

  // Credits handlers
  function handleCreditChange(idx: number, field: "name" | "role", value: string) {
    setForm((f) => {
      const credits = [...f.credits];
      credits[idx] = { ...credits[idx], [field]: value };
      return { ...f, credits };
    });
  }
  function addCredit() {
    setForm((f) => ({ ...f, credits: [...f.credits, { name: "", role: "" }] }));
  }
  function removeCredit(idx: number) {
    setForm((f) => {
      const credits = f.credits.filter((_, i) => i !== idx);
      return { ...f, credits };
    });
  }

  // Related projects handler (comma separated)
  function handleRelatedProjectsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setForm((f) => ({ ...f, related_projects: value.split(",").map((s) => s.trim()).filter(Boolean) }));
  }

  // Enhanced polling function with better progress tracking
  async function pollSessionStatus(sessionId: number, maxAttempts = 30, intervalMs = 2000): Promise<boolean> {
    setPollingActive(true);
    setRetryCount(0);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setRetryCount(attempt);
        setProgressMessage(`Checking thumbnail progress... (${attempt}/${maxAttempts})`);
        
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
          setSessionStatus(statusData.status || 'created');
          
          if (statusData.status === 'error') {
            throw new Error(statusData.message || 'Session processing failed');
          }
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
            setSessionStatus('ready');
            setProgressMessage(`Found ${candidateList.length} thumbnail candidates!`);
            setPollingActive(false);
            return true;
          }
        }
        
        // Update progress based on attempt number
        const progressPercent = Math.min((attempt / maxAttempts) * 80, 80); // Cap at 80% until completion
        setUploadProgress(progressPercent);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        
      } catch (error: any) {
        console.error(`Polling attempt ${attempt} failed:`, error);
        setProgressMessage(`Error on attempt ${attempt}: ${error.message}`);
        
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
    
    // Reset progress states
    setUploadProgress(0);
    setProgressMessage('');
    setRetryCount(0);
    setSessionStatus('created');
    
    try {
      const method = editingId ? "PUT" : "POST";

      // If creating with a file, prefer direct-to-Stream flow for progress and resilience
      if (!editingId && form.file) {
        setPhase('uploading');
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
        const duRes = await fetch('/api/videos/stream/direct-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(metaPayload),
        });
        if (!duRes.ok) throw new Error('Failed to create Stream upload URL');
        const duJson = await duRes.json() as any;
        const uploadURL = duJson.uploadURL as string;
        const uid = duJson.uid as string;

        // 2) Upload file directly to Stream
        const uploadForm = new FormData();
        uploadForm.append('file', form.file);
        await fetch(uploadURL, { method: 'POST', body: uploadForm });

        // 3) Create an upload session (no DB video row yet)
        const createRes = await fetch('/api/videos/upload-session/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ uid, meta: metaPayload }),
        });
        if (!createRes.ok) throw new Error('Failed to create upload session');
        const { sessionId } = await createRes.json() as any;
        setSessionId(sessionId);

        // 4) Trigger thumbnail suggestion job (stubbed for now)
        setPhase('analyzing');
        const suggestRes = await fetch('/api/videos/thumbnail/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ sessionId }),
        });
        if (!suggestRes.ok) throw new Error('Failed to start thumbnail suggestion');

        // 5) Poll for candidates
        const poll = async () => {
          for (let i = 0; i < 15; i++) { // ~15 * 1s = 15s max
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
        setLoading(false);
        return; // stop here; user must choose thumbnail then finalize below
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
      setForm({
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
      setEditingId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalize() {
    if (!sessionId) return;
    setLoading(true);
    setPhase('finalizing');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const authHeaders: Record<string, string> = {};
      if (token) {
        try { JSON.parse(atob(token.split(".")[1])); authHeaders["Authorization"] = `Bearer ${token}`; } catch {}
      }
      const res = await fetch('/api/videos/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ sessionId, selectedTimestampPct: choicePct ?? undefined, publication_status: publicationStatus }),
      });
      if (!res.ok) throw new Error('Failed to finalize video');

      // Refresh list and reset UI
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

      // Reset wizard
      setForm({
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
      setSessionId(null);
      setCandidates([]);
      setChoicePct(null);
      setPublicationStatus('archived');
      setPhase('form');
    } catch (e: any) {
      setError(e.message);
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

  // Helpers to safely parse credits and related projects which may be stored as strings
  function parseCredits(c: Video["credits"]): Credit[] {
    if (!c) return [];
    if (Array.isArray(c)) return c;
    try {
      return JSON.parse(String(c));
    } catch {
      return [];
    }
  }
  function parseRelated(r: Video["related_projects"]): string[] {
    if (!r) return [];
    if (Array.isArray(r)) return r;
    try {
      return JSON.parse(String(r));
    } catch {
      // fallback to comma-separated string
      return String(r).split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  return (
    <ScreenLayout>
      <ScrollContainer>
    <div className="max-w-5xl mx-auto mt-6 p-3 sm:p-8 bg-[#302927]/60 border border-[#b2a491]/20 rounded-2xl shadow-lg text-[#ede8df]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-wide">Manage Videos</h1>
      </div>

      {/* Filters & pagination controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="block text-sm font-medium">
          Publication
          <select value={filterPublication} onChange={(e) => { setPage(0); setFilterPublication(e.target.value as any); }} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] focus:outline-none focus:ring-1 focus:ring-[#ede8df]">
            <option value="all">All</option>
            <option value="live">Live</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Page size
          <select value={pageSize} onChange={(e) => { setPage(0); setPageSize(Number(e.target.value)); }} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] focus:outline-none focus:ring-1 focus:ring-[#ede8df] max-w-[120px]">
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="flex gap-2 ml-auto">
          <button type="button" className="px-3 py-2 rounded-md bg-[#302927] text-[#b2a491] disabled:opacity-50" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}>&larr; Prev</button>
          <div className="px-2 py-2 text-sm text-[#b2a491]">Page {page + 1}</div>
          <button type="button" className="px-3 py-2 rounded-md bg-[#302927] text-[#b2a491]" onClick={() => setPage(p => p+1)}>Next &rarr;</button>
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm font-medium">Title
            <input name="title" value={form.title} onChange={handleChange} placeholder="Enter title" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" required />
          </label>
          <label className="block text-sm font-medium">Category
            <input name="category" value={form.category} onChange={handleChange} placeholder="Category or tag" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">Description
            <textarea name="description" value={form.description} onChange={handleChange} placeholder="Write a short description…" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" />
          </label>
          <label className="block text-sm font-medium">Type
            <select name="type" value={form.type} onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] focus:outline-none focus:ring-1 focus:ring-[#ede8df]">
              <option value="music-video">Music Video</option>
              <option value="short-film">Short Film</option>
              <option value="feature">Feature</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Mood
            <input name="mood" value={form.mood} onChange={handleChange} placeholder="e.g. introspective, hyped" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" />
          </label>
          <label className="block text-sm font-medium">Duration
            <input name="duration" value={form.duration} onChange={handleChange} placeholder="1:23:45" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" />
          </label>
          <label className="block text-sm font-medium">Thumbnail URL
            <input name="thumbnail" value={form.thumbnail} onChange={handleChange} placeholder="https://…" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_public" checked={form.is_public} onChange={handleChange} className="w-4 h-4 rounded border-[#b2a491]/30 bg-[#171616] text-[#ede8df] focus:ring-[#ede8df]" />
              <span>Public</span>
            </label>
          </div>
          <label className="block text-sm font-medium sm:col-span-2">Video File
            <input type="file" name="file" accept="video/*" onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#302927] file:text-[#b2a491]" required={!editingId} />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">Poster Image
            <input type="file" name="poster" accept="image/jpeg,image/png" onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#302927] file:text-[#b2a491]" required={false} />
          </label>
        </div>
        <div className="block text-sm font-medium mb-1">
          <div className="mb-2">Credits</div>
          <div className="space-y-2">
            {form.credits.map((c, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={c.name}
                  onChange={(e) => handleCreditChange(idx, 'name', e.target.value)}
                  placeholder="Name"
                  className="flex-1 px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]"
                />
                <select
                  value={c.role}
                  onChange={(e) => handleCreditChange(idx, 'role', e.target.value)}
                  className="w-48 px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] focus:outline-none focus:ring-1 focus:ring-[#ede8df]"
                >
                  <option value="">Role…</option>
                  <option value="director">Director</option>
                  <option value="producer">Producer</option>
                  <option value="writer">Writer</option>
                  <option value="cinematographer">Cinematographer</option>
                  <option value="editor">Editor</option>
                  <option value="composer">Composer</option>
                  <option value="artist">Artist</option>
                  <option value="featured-artist">Featured Artist</option>
                  <option value="songwriter">Songwriter</option>
                  <option value="vfx">VFX</option>
                  <option value="other">Other</option>
                </select>
                <button type="button" className="px-3 py-2 rounded-md bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60" onClick={() => removeCredit(idx)}>Remove</button>
              </div>
            ))}
            <button type="button" className="px-3 py-2 rounded-md bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60" onClick={addCredit}>+ Add credit</button>
          </div>
        </div>
        <label className="block text-sm font-medium mb-1">Related Projects (comma separated)
          <input name="related_projects" value={form.related_projects.join(", ")} onChange={handleRelatedProjectsChange} placeholder="IDs or names, separated by commas" className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] placeholder-[#b2a491] focus:outline-none focus:ring-1 focus:ring-[#ede8df]" />
        </label>
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
              alert('Requested Stream metadata sync for all videos');
            } catch (e) {
              console.error(e);
              alert('Sync-all failed');
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
              setForm({
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
              setEditingId(null);
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* Progress / Thumbnail workflow */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upload & Thumbnail Workflow</h2>
          <div className="text-sm text-[#b2a491]">Session ID: {sessionId ?? '—'}</div>
        </div>

        {/* Progress bar & status */}
        {(phase === 'uploading' || phase === 'analyzing' || pollingActive || phase === 'finalizing') && (
          <div className="mt-3 p-4 rounded-md bg-[#171616] border border-[#b2a491]/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${sessionStatus === 'error' ? 'bg-red-600 text-white' : sessionStatus === 'ready' ? 'bg-green-600 text-white' : 'bg-[#b2a491]/20 text-[#ede8df]'}`}>{sessionStatus.toUpperCase()}</span>
                <div className="text-sm text-[#ede8df]">{progressMessage || (phase === 'uploading' ? 'Uploading…' : phase === 'analyzing' ? 'Analyzing…' : 'Working…')}</div>
              </div>
              <div className="text-sm text-[#b2a491]">Attempts: {retryCount}</div>
            </div>

            <div className="w-full h-3 bg-[#302927] rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#6ee7b7] to-[#60a5fa] transition-all" style={{ width: `${uploadProgress}%` }}></div>
            </div>

            <div className="mt-3 flex gap-2">
              {pollingActive && (
                <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={() => { setPollingActive(false); setProgressMessage('Polling cancelled by user'); setSessionStatus('error'); }}>
                  Cancel
                </button>
              )}
              {!pollingActive && sessionStatus === 'error' && (
                <button className="px-3 py-2 rounded bg-yellow-500 text-[#171616]" onClick={async () => {
                  if (!sessionId) return; setProgressMessage('Retrying polling...'); try { await pollSessionStatus(sessionId); } catch (e:any) { setProgressMessage(e.message); }
                }}>
                  Retry
                </button>
              )}
            </div>

            <div className="mt-2 text-xs text-[#b2a491]">Tip: Uploads are resilient — you can close this panel and return later to finalize.</div>
          </div>
        )}

        {/* Thumbnail selection phase */}
        {phase === 'awaiting_choice' && (
          <div className="mt-4 p-4 border border-[#b2a491]/20 rounded-xl bg-[#302927]/40">
            <h3 className="text-md font-semibold mb-2">Choose a thumbnail</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {candidates.length === 0 && (
                <div className="col-span-3 text-sm text-[#b2a491]">No candidates yet — try waiting a bit or uploading a longer sample.</div>
              )}
              {candidates.map((c) => (
                <div key={c.id} className={`p-2 rounded-md border ${choicePct === c.pct ? 'border-[#60a5fa]' : 'border-[#b2a491]/20'} bg-[#171616]`}> 
                  <div className="aspect-w-16 aspect-h-9 bg-black rounded overflow-hidden">
                    <img src={c.url} alt={`thumb-${c.rank}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-[#b2a491]">Rank {c.rank}</div>
                    <div className="text-xs text-[#b2a491]">Score {(c.pct*100).toFixed(0)}%</div>
                  </div>
                  {c.rationale && <div className="mt-1 text-xs text-[#b2a491]">{c.rationale}</div>}
                  <div className="mt-2 flex gap-2">
                    <button className={`flex-1 py-2 rounded ${choicePct === c.pct ? 'bg-[#60a5fa] text-white' : 'bg-[#302927] text-[#b2a491]'}`} onClick={() => setChoicePct(c.pct)}>Select</button>
                    <button className="py-2 px-3 rounded bg-[#302927] text-[#b2a491]" onClick={() => setChoicePct(c.pct)}>Preview</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleFinalize} className="py-2 px-4 rounded-md bg-[#ede8df] text-[#171616] hover:bg-[#d9d3c9]" disabled={loading}>{loading ? 'Finalizing…' : 'Finalize and Create'}</button>
              <button type="button" onClick={() => { setChoicePct(null); handleFinalize(); }} className="py-2 px-4 rounded-md bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60">Skip (use best)</button>
            </div>
          </div>
        )}
      </div>

      {/* Progress hints */}
      {phase === 'uploading' && <div className="mt-4 text-sm text-[#b2a491]">Uploading to Stream…</div>}
      {phase === 'analyzing' && <div className="mt-4 text-sm text-[#b2a491]">Analyzing and preparing thumbnail candidates…</div>}
      {phase === 'finalizing' && <div className="mt-4 text-sm text-[#b2a491]">Finalizing…</div>}

      <div>
        <h2 className="text-lg font-semibold mb-2">All Videos</h2>
        {/* Card/List layout for mobile, table for sm+ */}
        <div className="block sm:hidden space-y-4">
          {videos
            .filter(video => video && video.title) // Extra safety check
            .map((video) => (
            <div key={video.id} className="border border-[#b2a491]/20 rounded p-3 shadow-sm bg-[#302927]/60 text-[#ede8df]">
              <div className="font-bold text-base mb-1">{video.title}</div>
              <div className="text-xs text-[#b2a491] mb-1">Category: <span className="font-medium text-[#ede8df]">{video.category || 'N/A'}</span></div>
              <div className="text-xs text-[#b2a491] mb-1">Type: <span className="font-medium text-[#ede8df]">{video.type || 'N/A'}</span></div>
              <div className="text-xs text-[#b2a491] mb-1">Mood: <span className="font-medium text-[#ede8df]">{video.mood || 'N/A'}</span></div>
              <div className="text-xs text-[#b2a491] mb-1">Credits:
                <ul className="ml-2 list-disc">
                  {parseCredits(video.credits).map((c: Credit, i: number) => (
                    <li key={i} className="text-[#ede8df]">{c?.name || 'Unknown'} ({c?.role || 'Unknown'})</li>
                  ))}
                </ul>
              </div>
              <div className="text-xs text-[#b2a491] mb-1">Related Projects: <span className="font-medium text-[#ede8df]">{parseRelated(video.related_projects).join(", ") || 'None'}</span></div>
              <div className="text-xs text-[#b2a491] mb-1">Public: <span className="font-medium text-[#ede8df]">{video.is_public ? "Yes" : "No"}</span></div>
              <div className="flex gap-2 mt-2">
                <button className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-[#ede8df] text-[#171616]" onClick={() => handleEdit(video)}>Edit</button>
                <button className="flex-1 py-2 px-3 rounded text-xs font-semibold bg-red-500 text-white" onClick={() => handleDelete(video.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border border-[#b2a491]/20 text-sm sm:text-base text-[#ede8df]">
            <thead>
              <tr className="bg-[#302927]">
                <th className="p-3">Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Type</th>
                <th className="p-3">Mood</th>
                <th className="p-3">Credits</th>
                <th className="p-3">Related Projects</th>
                <th className="p-3">Public</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id} className="border-t border-[#b2a491]/20">
                  <td className="p-3 align-top break-words max-w-[160px] sm:max-w-none">{video.title}</td>
                  <td className="p-3 align-top break-words max-w-[140px] sm:max-w-none text-[#b2a491]">{video.category}</td>
                  <td className="p-3 align-top">{video.type}</td>
                  <td className="p-3 align-top">{video.mood}</td>
                  <td className="p-3 align-top">
                    {parseCredits(video.credits).map((c: Credit, i: number) => (
                      <div key={i}>{c.name} ({c.role})</div>
                    ))}
                  </td>
                  <td className="p-3 align-top break-words max-w-[200px] sm:max-w-none text-[#b2a491]">{parseRelated(video.related_projects).join(", ")}</td>
                  <td className="p-3 align-top">{video.is_public ? "Yes" : "No"}</td>
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
                          alert('Synced to Stream');
                        } catch (e) {
                          console.error(e);
                          alert('Sync failed');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Sync to Stream
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
                          await fetch(`/api/videos?limit=${pageSize}&offset=${page*pageSize}${filterPublication !== 'all' ? `&publication_status=${filterPublication}` : ''}`)
                            .then(r => r.json()).then((d: any) => {
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
                          alert('Thumbnail updated');
                        } catch (err) {
                          console.error(err);
                          alert('Thumbnail upload failed');
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
    </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}
