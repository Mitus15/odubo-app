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
  id: number; // Changed from string to match database INTEGER PRIMARY KEY
  title: string;
  description: string;
  url: string;
  thumbnail: string;
  duration: string;
  category: string;
  is_public: boolean;
  type: "music video" | "short film" | "feature";
  mood: "outgoing" | "introspective" | "neutral";
  credits: Credit[];
  related_projects: string[];
  created_at?: string;
};

type FormState = {
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  category: string;
  is_public: boolean;
  type: "music video" | "short film" | "feature";
  mood: "outgoing" | "introspective" | "neutral";
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
    type: "music video",
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
      .then((res) => res.json() as Promise<{ videos: Video[] }>)
      .then((data) => {
        console.log('Fetched videos:', data); // Debug log
        const videos = data.videos || [];
        // Filter out any invalid videos and ensure all required fields exist
        const validVideos = videos.filter(video => 
          video && 
          typeof video.id !== 'undefined' && 
          typeof video.title === 'string' &&
          video.title.trim() !== ''
        );
        setVideos(validVideos);
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
      if (form.file || form.poster) {
        body = new FormData();
        if (form.file) body.append("file", form.file);
        if (form.poster) body.append("poster", form.poster);
        body.append("title", form.title);
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
        body = JSON.stringify({ ...form, file: undefined, poster: undefined });
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
      const data = await res.json() as { video: Video };
      setVideos((prev) => {
        if (editingId) {
          return prev.map((v) => (v.id === editingId ? data.video : v));
        } else {
          return [data.video, ...prev];
        }
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
      thumbnail: video.thumbnail,
      duration: video.duration,
      category: video.category,
      is_public: video.is_public,
      type: video.type,
      mood: video.mood,
      credits: video.credits || [],
      related_projects: video.related_projects || [],
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

  return (
    <ScreenLayout>
      <ScrollContainer>
    <div className="max-w-3xl mx-auto mt-4 p-2 sm:p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Manage Videos</h1>
      <form onSubmit={handleSubmit} className="space-y-4 mb-8" encType="multipart/form-data">
        <label className="block text-base font-medium mb-1">Title
          <input name="title" value={form.title} onChange={handleChange} placeholder="Title" className="w-full px-3 py-2 border rounded text-base" required />
        </label>
        <label className="block text-base font-medium mb-1">Description
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="w-full px-3 py-2 border rounded text-base" />
        </label>
        <label className="block text-base font-medium mb-1">Video File
          <input type="file" name="file" accept="video/*" onChange={handleChange} className="w-full px-3 py-2 border rounded text-base" required={!editingId} />
        </label>
        <label className="block text-base font-medium mb-1">Poster Image
          <input type="file" name="poster" accept="image/jpeg,image/png" onChange={handleChange} className="w-full px-3 py-2 border rounded text-base" required={!editingId} />
        </label>
        <label className="block text-base font-medium mb-1">Thumbnail URL
          <input name="thumbnail" value={form.thumbnail} onChange={handleChange} placeholder="Thumbnail URL" className="w-full px-3 py-2 border rounded text-base" />
        </label>
        <label className="block text-base font-medium mb-1">Duration (e.g. 1:23:45)
          <input name="duration" value={form.duration} onChange={handleChange} placeholder="Duration (e.g. 1:23:45)" className="w-full px-3 py-2 border rounded text-base" />
        </label>
        <label className="block text-base font-medium mb-1">Category
          <input name="category" value={form.category} onChange={handleChange} placeholder="Category" className="w-full px-3 py-2 border rounded text-base" />
        </label>
        <label className="block text-base font-medium mb-1">Type
          <input name="type" value={form.type} onChange={handleChange} placeholder="Type" className="w-full px-3 py-2 border rounded text-base" />
        </label>
        <label className="block text-base font-medium mb-1">Mood
          <input name="mood" value={form.mood} onChange={handleChange} placeholder="Mood" className="w-full px-3 py-2 border rounded text-base" />
        </label>
        <label className="block text-base font-medium mb-1">Credits (JSON)
          <input name="credits" value={JSON.stringify(form.credits)} onChange={handleChange} placeholder="Credits (JSON)" className="w-full px-3 py-2 border rounded text-base" />
        </label>
        <label className="block text-base font-medium mb-1">Related Projects (comma separated)
          <input name="related_projects" value={form.related_projects.join(", ")} onChange={handleRelatedProjectsChange} placeholder="Related Projects (comma separated)" className="w-full px-3 py-2 border rounded text-base" />
        </label>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" name="is_public" checked={form.is_public} onChange={handleChange} className="w-4 h-4" />
          <span>Public</span>
        </label>
        {error && <div className="text-red-600">{error}</div>}
        <button type="submit" className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto" disabled={loading}>
          {editingId ? (loading ? "Saving..." : "Update Video") : loading ? "Creating..." : "Create Video"}
        </button>
        {editingId && (
          <button
            type="button"
            className="ml-0 sm:ml-2 mt-2 sm:mt-0 py-2 px-4 bg-gray-300 rounded w-full sm:w-auto"
            onClick={() => {
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
            <div key={video.id} className="border rounded p-3 shadow-sm bg-gray-50">
              <div className="font-bold text-base mb-1">{video.title}</div>
              <div className="text-xs text-gray-600 mb-1">Category: <span className="font-medium text-gray-800">{video.category || 'N/A'}</span></div>
              <div className="text-xs text-gray-600 mb-1">Type: <span className="font-medium text-gray-800">{video.type || 'N/A'}</span></div>
              <div className="text-xs text-gray-600 mb-1">Mood: <span className="font-medium text-gray-800">{video.mood || 'N/A'}</span></div>
              <div className="text-xs text-gray-600 mb-1">Credits:
                <ul className="ml-2 list-disc">
                  {(video.credits || []).map((c, i) => (
                    <li key={i}>{c?.name || 'Unknown'} ({c?.role || 'Unknown'})</li>
                  ))}
                </ul>
              </div>
              <div className="text-xs text-gray-600 mb-1">Related Projects: <span className="font-medium text-gray-800">{(video.related_projects || []).join(", ") || 'None'}</span></div>
              <div className="text-xs text-gray-600 mb-1">Public: <span className="font-medium text-gray-800">{video.is_public ? "Yes" : "No"}</span></div>
              <div className="flex gap-2 mt-2">
                <button className="flex-1 py-2 px-3 bg-yellow-400 rounded text-xs font-semibold" onClick={() => handleEdit(video)}>Edit</button>
                <button className="flex-1 py-2 px-3 bg-red-500 text-white rounded text-xs font-semibold" onClick={() => handleDelete(video.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border text-sm sm:text-base">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Title</th>
                <th className="p-2">Category</th>
                <th className="p-2">Type</th>
                <th className="p-2">Mood</th>
                <th className="p-2">Credits</th>
                <th className="p-2">Related Projects</th>
                <th className="p-2">Public</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id} className="border-t">
                  <td className="p-2 align-top break-words max-w-[120px] sm:max-w-none">{video.title}</td>
                  <td className="p-2 align-top break-words max-w-[100px] sm:max-w-none">{video.category}</td>
                  <td className="p-2 align-top">{video.type}</td>
                  <td className="p-2 align-top">{video.mood}</td>
                  <td className="p-2 align-top">
                    {video.credits?.map((c, i) => (
                      <div key={i}>{c.name} ({c.role})</div>
                    ))}
                  </td>
                  <td className="p-2 align-top break-words max-w-[120px] sm:max-w-none">{video.related_projects?.join(", ")}</td>
                  <td className="p-2 align-top">{video.is_public ? "Yes" : "No"}</td>
                  <td className="p-2 flex flex-col sm:flex-row gap-2">
                    <button className="py-1 px-3 bg-yellow-400 rounded text-xs sm:text-base" onClick={() => handleEdit(video)}>Edit</button>
                    <button className="py-1 px-3 bg-red-500 text-white rounded text-xs sm:text-base" onClick={() => handleDelete(video.id)}>Delete</button>
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
