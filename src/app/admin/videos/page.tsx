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

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
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

  // Fetch videos (Read)
  useEffect(() => {
    fetch("/api/videos")
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

  // Create or Update video
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const method = editingId ? "PUT" : "POST";
      const endpoint = editingId ? `/api/videos/${editingId}` : "/api/videos/upload";
      let body: FormData | string;
      let headers: Record<string, string> = {};
      if (!editingId && (form.file || form.poster)) {
        body = new FormData();
        if (form.file) body.append("file", form.file);
        if (form.poster) body.append("poster", form.poster);
        body.append("title", form.title);
        body.append("artist_name", "");
        body.append("description", form.description);
        body.append("thumbnail", form.thumbnail);
        body.append("duration", form.duration);
        body.append("category", form.category);
        body.append("is_public", String(form.is_public));
        body.append("type", form.type);
        body.append("mood", form.mood);
        body.append("credits", JSON.stringify(form.credits));
        body.append("related_projects", JSON.stringify(form.related_projects));
      } else {
        // Metadata-only create/update (no file changes)
        const payload: any = { ...form } as any;
        delete payload.file;
        delete payload.poster;
        // Normalize booleans and arrays
        (payload as any).is_public = !!payload.is_public;
        (payload as any).credits = form.credits;
        (payload as any).related_projects = form.related_projects;
        body = JSON.stringify(payload);
        headers["Content-Type"] = "application/json";
      }
      const res = await fetch(endpoint, {
        method,
        headers: {
          ...headers,
          // Add user email from token for authentication
          ...((() => {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            if (token) {
              try {
                const payload = JSON.parse(atob(token.split(".")[1]));
                return { "x-user-email": payload.email };
              } catch (e) {
                console.error("Failed to decode token:", e);
              }
            }
            return {};
          })())
        },
        body,
      } as any);
      if (!res.ok) throw new Error("Failed to save video");
      // Reload list to ensure consistency across schema variants
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
        type: "music video",
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

  // Edit video
  function handleEdit(video: Video) {
    setForm({
      title: video.title,
      description: video.description,
      thumbnail: video.thumbnail || video.poster_url || '',
      duration: video.duration,
      category: video.category,
      is_public: (video.is_public as any) === true || (video.is_public as any) === 1,
      type: String(video.type || '').toLowerCase().replace(/\s+/g, '-') || "music-video",
      mood: (video.mood as any) || "",
      credits: (Array.isArray(video.credits) ? video.credits : (() => { try { return JSON.parse((video.credits as any) || '[]'); } catch { return []; } })()),
      related_projects: (Array.isArray(video.related_projects) ? video.related_projects : (() => { try { return JSON.parse((video.related_projects as any) || '[]'); } catch { return []; } })()),
      file: null,
      poster: null,
    });
    setEditingId(video.id);
  }

  // Delete video
  async function handleDelete(id: number) {
    if (!confirm("Delete this video?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete video");
      setVideos((prev) => prev.filter((v) => v.id !== id));
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
            <input type="file" name="poster" accept="image/jpeg,image/png" onChange={handleChange} className="mt-1 w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df] file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#302927] file:text-[#b2a491]" required={!editingId} />
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
