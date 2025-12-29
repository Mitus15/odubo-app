"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";

// ============================================================================
// TYPES
// ============================================================================

type ContentType = "clip" | "video" | "photo" | "gallery";
type DateFilter = "all" | "today" | "week" | "month" | "older";
type SortOption = "newest" | "oldest" | "title-asc" | "title-desc";

type ContentItem = {
  id: string;
  uid?: string;
  type: ContentType;
  title: string;
  description?: string;
  folder?: string;
  createdAt: string;
  url?: string;
  posterUrl?: string;
  duration?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
  photos?: string[]; // For galleries
  distributed?: boolean;
  relatedProjects?: string[]; // Album/track IDs
  tags?: string[];
  category?: string;
  mood?: string;
};

type Album = {
  id: string;
  title: string;
  artist_name: string;
  cover_art_url?: string;
};

type Track = {
  id: string;
  title: string;
  album_id?: string;
  album_title?: string;
};

type Platform = "tiktok" | "instagram" | "youtube" | "facebook";
type PostType = "video" | "reel" | "short" | "post" | "carousel" | "story";

type PlatformConfig = {
  id: Platform;
  name: string;
  icon: string;
  postTypes: { id: PostType; name: string; description: string }[];
  fields: {
    caption: { maxLength: number; label: string };
    title?: { maxLength: number; label: string };
    description?: { maxLength: number; label: string };
    hashtags?: boolean;
    location?: boolean;
    firstComment?: boolean;
    altText?: boolean;
    privacy?: string[];
    allowComments?: boolean;
    allowDuets?: boolean;
    allowStitch?: boolean;
    category?: string[];
    playlist?: boolean;
    tags?: boolean;
  };
};

const PLATFORMS: PlatformConfig[] = [
  {
    id: "tiktok",
    name: "TikTok",
    icon: "📱",
    postTypes: [
      { id: "video", name: "Video", description: "Standard TikTok video" },
      { id: "carousel", name: "Carousel", description: "Photo carousel (up to 35 images)" },
    ],
    fields: {
      caption: { maxLength: 2200, label: "Caption" },
      hashtags: true,
      privacy: ["Public", "Friends", "Private"],
      allowComments: true,
      allowDuets: true,
      allowStitch: true,
    },
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📷",
    postTypes: [
      { id: "reel", name: "Reel", description: "Short-form video (up to 90s)" },
      { id: "post", name: "Post", description: "Photo or video post" },
      { id: "carousel", name: "Carousel", description: "Multiple photos/videos" },
      { id: "story", name: "Story", description: "24-hour story" },
    ],
    fields: {
      caption: { maxLength: 2200, label: "Caption" },
      hashtags: true,
      location: true,
      altText: true,
      firstComment: true,
    },
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "▶️",
    postTypes: [
      { id: "video", name: "Video", description: "Long-form video" },
      { id: "short", name: "Short", description: "Vertical short (up to 60s)" },
    ],
    fields: {
      title: { maxLength: 100, label: "Title" },
      description: { maxLength: 5000, label: "Description" },
      caption: { maxLength: 5000, label: "Description" },
      tags: true,
      category: ["Entertainment", "Music", "Education", "Gaming", "Sports", "News", "Comedy", "Film", "Science", "Travel"],
      privacy: ["Public", "Unlisted", "Private"],
      playlist: true,
    },
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "👤",
    postTypes: [
      { id: "post", name: "Post", description: "Photo or text post" },
      { id: "reel", name: "Reel", description: "Short-form video" },
      { id: "video", name: "Video", description: "Long-form video" },
    ],
    fields: {
      caption: { maxLength: 63206, label: "Caption" },
      location: true,
      privacy: ["Public", "Friends", "Only Me"],
    },
  },
];

type SelectedPlatform = {
  platform: Platform;
  postType: PostType;
  enabled: boolean;
};

type PostData = {
  [key in Platform]?: {
    postType: PostType;
    caption: string;
    title?: string;
    hashtags?: string;
    location?: string;
    firstComment?: string;
    altText?: string;
    privacy?: string;
    category?: string;
    tags?: string;
    allowComments?: boolean;
    allowDuets?: boolean;
    allowStitch?: boolean;
  };
};

type User = {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer" | null;
  is_admin: boolean;
};

type ViewMode = "browse" | "compose" | "upload" | "detail";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDateFilterBounds(filter: DateFilter): { start: Date | null; end: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case "today":
      return { start: today, end: null };
    case "week": {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: null };
    }
    case "month": {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: monthAgo, end: null };
    }
    case "older": {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: null, end: monthAgo };
    }
    default:
      return { start: null, end: null };
  }
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ============================================================================
// COMPONENTS
// ============================================================================

function FilterBar({
  typeFilter,
  setTypeFilter,
  dateFilter,
  setDateFilter,
  sortOption,
  setSortOption,
  albumFilter,
  setAlbumFilter,
  albums,
  showDistributedOnly,
  setShowDistributedOnly,
}: {
  typeFilter: ContentType | "all";
  setTypeFilter: (v: ContentType | "all") => void;
  dateFilter: DateFilter;
  setDateFilter: (v: DateFilter) => void;
  sortOption: SortOption;
  setSortOption: (v: SortOption) => void;
  albumFilter: string | null;
  setAlbumFilter: (v: string | null) => void;
  albums: Album[];
  showDistributedOnly: boolean;
  setShowDistributedOnly: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 p-3 border-b border-[#502d26]/20 bg-[#0d0c0a]/50">
      {/* Type Filter */}
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value as ContentType | "all")}
        className="px-3 py-1.5 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs focus:outline-none focus:border-[#843c2d]"
      >
        <option value="all">All Types</option>
        <option value="clip">Clips</option>
        <option value="video">Videos</option>
        <option value="gallery">Galleries</option>
        <option value="photo">Photos</option>
      </select>

      {/* Date Filter */}
      <select
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value as DateFilter)}
        className="px-3 py-1.5 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs focus:outline-none focus:border-[#843c2d]"
      >
        <option value="all">All Time</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="older">Older</option>
      </select>

      {/* Sort */}
      <select
        value={sortOption}
        onChange={(e) => setSortOption(e.target.value as SortOption)}
        className="px-3 py-1.5 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs focus:outline-none focus:border-[#843c2d]"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="title-asc">Title A-Z</option>
        <option value="title-desc">Title Z-A</option>
      </select>

      {/* Album Filter */}
      <select
        value={albumFilter || ""}
        onChange={(e) => setAlbumFilter(e.target.value || null)}
        className="px-3 py-1.5 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs focus:outline-none focus:border-[#843c2d] max-w-[150px]"
      >
        <option value="">All Songs</option>
        {albums.map((album) => (
          <option key={album.id} value={album.id}>
            {album.title}
          </option>
        ))}
      </select>

      {/* Distributed Toggle */}
      <button
        onClick={() => setShowDistributedOnly(!showDistributedOnly)}
        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
          showDistributedOnly
            ? "bg-[#843c2d] border-[#843c2d] text-white"
            : "bg-[#171616] border-[#502d26]/40 text-[#726d6c] hover:text-[#ede8df]"
        }`}
      >
        {showDistributedOnly ? "Distributed" : "All Status"}
      </button>
    </div>
  );
}

function ContentCard({
  item,
  isSelected,
  onClick,
  onQuickLink,
}: {
  item: ContentItem;
  isSelected: boolean;
  onClick: () => void;
  onQuickLink?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
        isSelected
          ? "bg-[#302927] ring-1 ring-[#843c2d]/50"
          : "hover:bg-[#302927]/50"
      }`}
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[#502d26]/30 relative">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">
            {item.type === "clip" ? "📱" : item.type === "video" ? "🎬" : item.type === "gallery" ? "🖼️" : "📷"}
          </div>
        )}
        {item.distributed && (
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500" title="Distributed" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[#502d26] capitalize">{item.type}</span>
          <span className="text-[10px] text-[#726d6c]">{formatRelativeDate(item.createdAt)}</span>
        </div>
        {item.relatedProjects && item.relatedProjects.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-[#843c2d]">🎵 Linked</span>
          </div>
        )}
      </div>
      {onQuickLink && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickLink();
          }}
          className="p-1.5 rounded-lg hover:bg-[#502d26]/30 text-[#726d6c] hover:text-[#ede8df] transition-colors"
          title="Link to song"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242" />
          </svg>
        </button>
      )}
    </div>
  );
}

function ContentDetailPanel({
  content,
  albums,
  tracks,
  onClose,
  onSave,
  onLinkUpdate,
}: {
  content: ContentItem;
  albums: Album[];
  tracks: Track[];
  onClose: () => void;
  onSave: (updates: Partial<ContentItem>) => void;
  onLinkUpdate: (contentId: string, projectIds: string[]) => void;
}) {
  const [editTitle, setEditTitle] = useState(content.title);
  const [editDescription, setEditDescription] = useState(content.description || "");
  const [selectedLinks, setSelectedLinks] = useState<string[]>(content.relatedProjects || []);
  const [saving, setSaving] = useState(false);
  const [linkMode, setLinkMode] = useState<"album" | "track">("album");

  const handleSave = async () => {
    setSaving(true);
    try {
      onSave({ title: editTitle, description: editDescription });
      if (JSON.stringify(selectedLinks) !== JSON.stringify(content.relatedProjects)) {
        onLinkUpdate(content.id, selectedLinks);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleLink = (id: string) => {
    setSelectedLinks((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0c0a]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#502d26]/30">
        <h3 className="font-semibold">Content Details</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#302927] text-[#726d6c] hover:text-[#ede8df]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Preview */}
        <div className="aspect-[9/16] max-h-[300px] rounded-xl overflow-hidden bg-[#171616] mx-auto">
          {content.posterUrl ? (
            <img src={content.posterUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {content.type === "clip" ? "📱" : content.type === "video" ? "🎬" : "🖼️"}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#726d6c] mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#726d6c] mb-1">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm resize-none focus:outline-none focus:border-[#843c2d]"
            />
          </div>

          {/* Info Row */}
          <div className="flex flex-wrap gap-2 text-xs text-[#726d6c]">
            <span className="px-2 py-1 rounded-full bg-[#302927] capitalize">{content.type}</span>
            <span className="px-2 py-1 rounded-full bg-[#302927]">{formatRelativeDate(content.createdAt)}</span>
            {content.distributed && (
              <span className="px-2 py-1 rounded-full bg-green-900/30 text-green-400">Distributed</span>
            )}
          </div>
        </div>

        {/* Link to Songs Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[#726d6c]">Link to Music</label>
            <div className="flex gap-1">
              <button
                onClick={() => setLinkMode("album")}
                className={`px-2 py-1 rounded text-[10px] ${
                  linkMode === "album" ? "bg-[#843c2d] text-white" : "bg-[#302927] text-[#726d6c]"
                }`}
              >
                Albums
              </button>
              <button
                onClick={() => setLinkMode("track")}
                className={`px-2 py-1 rounded text-[10px] ${
                  linkMode === "track" ? "bg-[#843c2d] text-white" : "bg-[#302927] text-[#726d6c]"
                }`}
              >
                Tracks
              </button>
            </div>
          </div>

          <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border border-[#502d26]/20 p-2">
            {linkMode === "album" ? (
              albums.length > 0 ? (
                albums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => toggleLink(album.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                      selectedLinks.includes(album.id)
                        ? "bg-[#843c2d]/30 ring-1 ring-[#843c2d]"
                        : "hover:bg-[#302927]/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-[#302927] overflow-hidden flex-shrink-0">
                      {album.cover_art_url ? (
                        <img src={album.cover_art_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs">💿</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{album.title}</p>
                      <p className="text-[10px] text-[#726d6c]">{album.artist_name}</p>
                    </div>
                    {selectedLinks.includes(album.id) && (
                      <svg className="w-4 h-4 text-[#843c2d]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-xs text-[#726d6c] text-center py-4">No albums found</p>
              )
            ) : tracks.length > 0 ? (
              tracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => toggleLink(track.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                    selectedLinks.includes(track.id)
                      ? "bg-[#843c2d]/30 ring-1 ring-[#843c2d]"
                      : "hover:bg-[#302927]/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-[#302927] flex items-center justify-center text-xs">🎵</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{track.title}</p>
                    {track.album_title && <p className="text-[10px] text-[#726d6c]">{track.album_title}</p>}
                  </div>
                  {selectedLinks.includes(track.id) && (
                    <svg className="w-4 h-4 text-[#843c2d]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <p className="text-xs text-[#726d6c] text-center py-4">No tracks found</p>
            )}
          </div>

          {selectedLinks.length > 0 && (
            <p className="text-[10px] text-[#843c2d]">{selectedLinks.length} item(s) linked</p>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="p-4 border-t border-[#502d26]/30">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-[#ede8df] text-[#171616] text-sm font-semibold hover:bg-white disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function UploadPanel({
  albums,
  onClose,
  onUploadComplete,
}: {
  albums: Album[];
  onClose: () => void;
  onUploadComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState<"clip" | "video">("clip");
  const [linkedAlbum, setLinkedAlbum] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate file type
    if (!selected.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }

    setFile(selected);
    setError(null);

    // Generate preview
    const url = URL.createObjectURL(selected);
    setPreview(url);

    // Auto-set title from filename
    if (!title) {
      const name = selected.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(name);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Get upload URL from Cloudflare Stream
      setUploadProgress(10);
      const initRes = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          type: contentType,
        }),
      });

      if (!initRes.ok) {
        throw new Error("Failed to initialize upload");
      }

      const uploadData = (await initRes.json()) as { uploadUrl: string; uid: string };
      const { uploadUrl, uid } = uploadData;
      setUploadProgress(20);

      // Step 2: Upload to Cloudflare Stream
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload video");
      }

      setUploadProgress(80);

      // Step 3: Create video record in database
      const createRes = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          title,
          description,
          type: contentType,
          relatedProjects: linkedAlbum ? [linkedAlbum] : [],
        }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to create video record");
      }

      setUploadProgress(100);

      // Success
      setTimeout(() => {
        onUploadComplete();
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0c0a]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#502d26]/30">
        <h3 className="font-semibold">Upload Content</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#302927] text-[#726d6c] hover:text-[#ede8df]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* File Drop Zone */}
        {!file ? (
          <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-[#502d26]/40 rounded-xl cursor-pointer hover:border-[#843c2d] transition-colors">
            <svg className="w-10 h-10 text-[#502d26] mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-[#726d6c]">Drop video or click to browse</p>
            <p className="text-xs text-[#502d26] mt-1">MP4, MOV, WebM supported</p>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        ) : (
          <div className="space-y-3">
            {/* Preview */}
            <div className="relative aspect-[9/16] max-h-[200px] rounded-xl overflow-hidden bg-[#171616] mx-auto">
              {preview && (
                <video src={preview} className="w-full h-full object-cover" muted />
              )}
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-[#726d6c] text-center truncate">{file.name}</p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-600/40 text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#726d6c] mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your content a name..."
              className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#726d6c] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm resize-none focus:outline-none focus:border-[#843c2d]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#726d6c] mb-1">Content Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setContentType("clip")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  contentType === "clip"
                    ? "bg-[#843c2d] text-white"
                    : "bg-[#171616] border border-[#502d26]/40 text-[#726d6c] hover:text-[#ede8df]"
                }`}
              >
                Clip (9:16)
              </button>
              <button
                onClick={() => setContentType("video")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  contentType === "video"
                    ? "bg-[#843c2d] text-white"
                    : "bg-[#171616] border border-[#502d26]/40 text-[#726d6c] hover:text-[#ede8df]"
                }`}
              >
                Video (16:9)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#726d6c] mb-1">Link to Album (Optional)</label>
            <select
              value={linkedAlbum}
              onChange={(e) => setLinkedAlbum(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
            >
              <option value="">No album linked</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title} — {album.artist_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-[#302927] overflow-hidden">
              <div
                className="h-full bg-[#843c2d] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-[#726d6c] text-center">
              {uploadProgress < 20 && "Initializing..."}
              {uploadProgress >= 20 && uploadProgress < 80 && "Uploading video..."}
              {uploadProgress >= 80 && uploadProgress < 100 && "Creating record..."}
              {uploadProgress === 100 && "Complete!"}
            </p>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div className="p-4 border-t border-[#502d26]/30">
        <button
          onClick={handleUpload}
          disabled={!file || !title || uploading}
          className="w-full py-2.5 rounded-xl bg-[#ede8df] text-[#171616] text-sm font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
    </div>
  );
}

function PlatformPreview({
  platform,
  postType,
  content,
  postData
}: {
  platform: Platform;
  postType: PostType;
  content: ContentItem | null;
  postData: PostData[Platform];
}) {
  const config = PLATFORMS.find(p => p.id === platform);
  if (!config || !content) return null;

  const caption = postData?.caption || "";
  const hashtags = postData?.hashtags || "";
  const displayCaption = caption + (hashtags ? `\n\n${hashtags}` : "");

  // TikTok Preview
  if (platform === "tiktok") {
    return (
      <div className="bg-black rounded-2xl overflow-hidden" style={{ width: 200, height: 356 }}>
        <div className="relative h-full">
          {content.posterUrl ? (
            <img src={content.posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900" />
          )}
          <div className="absolute inset-0 flex flex-col justify-end p-3">
            <div className="text-white text-[10px] mb-1 font-semibold">@odubo</div>
            <div className="text-white text-[9px] line-clamp-3 opacity-90">{displayCaption || "Your caption here..."}</div>
          </div>
          <div className="absolute right-2 bottom-16 flex flex-col gap-3 items-center">
            {["❤️", "💬", "🔖", "↗️"].map((icon, i) => (
              <div key={i} className="text-white text-sm">{icon}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Instagram Preview
  if (platform === "instagram") {
    if (postType === "reel" || postType === "story") {
      return (
        <div className="bg-black rounded-2xl overflow-hidden" style={{ width: 200, height: 356 }}>
          <div className="relative h-full">
            {content.posterUrl ? (
              <img src={content.posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900" />
            )}
            <div className="absolute inset-0 flex flex-col justify-end p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500" />
                <span className="text-white text-[10px] font-semibold">odubo</span>
              </div>
              <div className="text-white text-[9px] line-clamp-2 opacity-90">{displayCaption || "Your caption..."}</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-xl overflow-hidden border border-zinc-200" style={{ width: 200 }}>
        <div className="flex items-center gap-2 p-2 border-b border-zinc-100">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500" />
          <span className="text-[10px] font-semibold text-black">odubo</span>
        </div>
        <div className="aspect-square bg-zinc-100">
          {content.posterUrl ? (
            <img src={content.posterUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-zinc-200 to-zinc-300" />
          )}
        </div>
        <div className="p-2">
          <div className="flex gap-3 mb-2 text-black">
            {["❤️", "💬", "↗️"].map((icon, i) => (
              <span key={i} className="text-sm">{icon}</span>
            ))}
          </div>
          <div className="text-[9px] text-black line-clamp-2">
            <span className="font-semibold">odubo</span> {displayCaption || "Your caption..."}
          </div>
        </div>
      </div>
    );
  }

  // YouTube Preview
  if (platform === "youtube") {
    const title = postData?.title || content.title;
    if (postType === "short") {
      return (
        <div className="bg-black rounded-2xl overflow-hidden" style={{ width: 200, height: 356 }}>
          <div className="relative h-full">
            {content.posterUrl ? (
              <img src={content.posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900" />
            )}
            <div className="absolute inset-0 flex flex-col justify-end p-3">
              <div className="text-white text-[10px] font-semibold mb-1">@Odubo</div>
              <div className="text-white text-[9px] line-clamp-2 opacity-90">{title}</div>
            </div>
            <div className="absolute right-2 bottom-16 flex flex-col gap-3 items-center">
              {["👍", "👎", "💬", "↗️"].map((icon, i) => (
                <div key={i} className="text-white text-sm">{icon}</div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-xl overflow-hidden border border-zinc-200" style={{ width: 240 }}>
        <div className="aspect-video bg-zinc-100 relative">
          {content.posterUrl ? (
            <img src={content.posterUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-zinc-200 to-zinc-300" />
          )}
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[8px] px-1 rounded">
            {content.duration ? `${Math.floor(content.duration / 60)}:${(content.duration % 60).toString().padStart(2, '0')}` : "0:00"}
          </div>
        </div>
        <div className="p-2 flex gap-2">
          <div className="w-8 h-8 rounded-full bg-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-black line-clamp-2">{title || "Video title..."}</div>
            <div className="text-[9px] text-zinc-500">Odubo • 0 views</div>
          </div>
        </div>
      </div>
    );
  }

  // Facebook Preview
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-zinc-200" style={{ width: 240 }}>
      <div className="flex items-center gap-2 p-2">
        <div className="w-8 h-8 rounded-full bg-blue-500" />
        <div>
          <div className="text-[10px] font-semibold text-black">Odubo</div>
          <div className="text-[8px] text-zinc-500">Just now · 🌐</div>
        </div>
      </div>
      <div className="px-2 pb-2">
        <div className="text-[9px] text-black line-clamp-3">{displayCaption || "Your caption..."}</div>
      </div>
      <div className="aspect-video bg-zinc-100">
        {content.posterUrl ? (
          <img src={content.posterUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-zinc-200 to-zinc-300" />
        )}
      </div>
      <div className="p-2 flex justify-around border-t border-zinc-100 text-zinc-500 text-[10px]">
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>↗️ Share</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface SocialOpsContentProps {
  showHeader?: boolean;
}

export default function SocialOpsContent({ showHeader = true }: SocialOpsContentProps) {
  // Auth state
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Content state
  const [content, setContent] = useState<ContentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [albumFilter, setAlbumFilter] = useState<string | null>(null);
  const [showDistributedOnly, setShowDistributedOnly] = useState(false);

  // Albums and tracks for linking
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<SelectedPlatform[]>(
    PLATFORMS.map(p => ({ platform: p.id, postType: p.postTypes[0].id, enabled: false }))
  );

  // Post data per platform
  const [postData, setPostData] = useState<PostData>({});

  // Scheduling
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<Platform>("instagram");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selected = useMemo(() => content.find(c => c.id === selectedId) || null, [content, selectedId]);
  const enabledPlatforms = selectedPlatforms.filter(p => p.enabled);

  // Determine best post type based on content
  const suggestPostType = (content: ContentItem, platform: Platform): PostType => {
    const config = PLATFORMS.find(p => p.id === platform);
    if (!config) return "post";

    if (content.type === "clip") {
      if (platform === "tiktok") return "video";
      if (platform === "instagram") return "reel";
      if (platform === "youtube") return "short";
      if (platform === "facebook") return "reel";
    }
    if (content.type === "video") {
      if (platform === "youtube") return "video";
      if (platform === "facebook") return "video";
      return config.postTypes[0].id;
    }
    if (content.type === "gallery" || (content.photos && content.photos.length > 1)) {
      if (platform === "tiktok" || platform === "instagram") return "carousel";
    }
    if (content.type === "photo") {
      return "post";
    }
    return config.postTypes[0].id;
  };

  // Update post types when content changes
  useEffect(() => {
    if (selected) {
      setSelectedPlatforms(prev => prev.map(p => ({
        ...p,
        postType: suggestPostType(selected, p.platform)
      })));
    }
  }, [selected?.id]);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { authenticated?: boolean; user?: any };
          if (data.authenticated && data.user) {
            const role = data.user.role || (data.user.is_admin ? "admin" : null);
            if (role === "admin" || role === "editor") {
              setUser({ ...data.user, role, is_admin: data.user.is_admin || false });
            }
          }
        }
      } catch (e) {
        console.warn("[Social Ops] Auth error", e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Load albums and tracks
  useEffect(() => {
    if (!user) return;

    const loadMusic = async () => {
      try {
        const [albumsRes, tracksRes] = await Promise.all([
          fetch("/api/albums", { cache: "no-store" }),
          fetch("/api/tracks", { cache: "no-store" }).catch(() => null),
        ]);

        if (albumsRes.ok) {
          const data = (await albumsRes.json()) as { albums?: Album[] };
          setAlbums(data.albums || []);
        }

        if (tracksRes?.ok) {
          const data = (await tracksRes.json()) as { tracks?: Track[] };
          setTracks(data.tracks || []);
        }
      } catch (e) {
        console.warn("[Social Ops] Load music error", e);
      }
    };
    loadMusic();
  }, [user]);

  // Load content
  const loadContent = useCallback(async () => {
    if (!user) return;
    setLoadingContent(true);
    try {
      // Load clips and videos
      const mediaRes = await fetch("/api/media/all", { cache: "no-store" });
      let items: ContentItem[] = [];

      if (mediaRes.ok) {
        const data = (await mediaRes.json()) as { media?: any[] };
        items = (data.media || []).map((c: any) => ({
          id: String(c.id),
          uid: c.uid,
          type: c.type === "music-video" ? "video" : "clip" as ContentType,
          title: c.title || "Untitled",
          description: c.purpose,
          folder: c.type === "music-video" ? "music-videos" : "clips",
          createdAt: c.createdAt || new Date().toISOString(),
          url: c.url,
          posterUrl: c.posterUrl || (c.uid ? `https://customer-tpkm273r1u0s40no.cloudflarestream.com/${c.uid}/thumbnails/thumbnail.jpg` : null),
          aspectRatio: "9:16" as const,
          distributed: c.distributed,
          category: c.category,
          mood: c.mood,
        }));
      }

      // Load moments/galleries
      try {
        const momentsRes = await fetch("/api/moments/galleries/public", { cache: "no-store" });
        if (momentsRes.ok) {
          const momentsData = (await momentsRes.json()) as { galleries?: any[] };
          const momentItems = (momentsData.galleries || []).map((g: any) => ({
            id: `gallery-${g.id}`,
            type: "gallery" as ContentType,
            title: g.title || g.name,
            description: g.description,
            folder: "moments",
            createdAt: g.created_at || g.createdAt || new Date().toISOString(),
            posterUrl: g.cover_url || g.coverUrl,
            photos: g.photos?.map((p: any) => p.url) || [],
          }));
          items = [...items, ...momentItems];
        }
      } catch {}

      setContent(items);
    } catch (e) {
      console.warn("[Social Ops] Load error", e);
    } finally {
      setLoadingContent(false);
    }
  }, [user]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: loginEmail, password: loginPassword }),
        credentials: "include",
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        setLoginError(data.error || "Login failed");
        return;
      }
      if (data.token) localStorage.setItem("token", data.token);
      window.location.reload();
    } catch {
      setLoginError("An error occurred.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setUser(null);
  };

  const togglePlatform = (platformId: Platform) => {
    setSelectedPlatforms(prev => prev.map(p =>
      p.platform === platformId ? { ...p, enabled: !p.enabled } : p
    ));
    if (!postData[platformId]) {
      setPostData(prev => ({ ...prev, [platformId]: { postType: "video", caption: "" } }));
    }
  };

  const updatePostType = (platformId: Platform, postType: PostType) => {
    setSelectedPlatforms(prev => prev.map(p =>
      p.platform === platformId ? { ...p, postType } : p
    ));
    setPostData(prev => ({ ...prev, [platformId]: { ...prev[platformId], postType } }));
  };

  const updatePostData = (platformId: Platform, field: string, value: any) => {
    setPostData(prev => ({
      ...prev,
      [platformId]: { ...prev[platformId], [field]: value }
    }));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handlePublish = async () => {
    if (!selected || enabledPlatforms.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceContentId: selected.id,
          contentType: selected.type,
          platforms: enabledPlatforms.map(p => p.platform),
          postData,
          scheduledAt: scheduleEnabled && scheduleDate && scheduleTime
            ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
            : null,
          status: scheduleEnabled ? "scheduled" : "draft",
        }),
      });
      if (res.ok) {
        showToast(scheduleEnabled ? "Post scheduled!" : "Draft saved!");
        setPostData({});
        setSelectedPlatforms(prev => prev.map(p => ({ ...p, enabled: false })));
        setScheduleEnabled(false);
      } else {
        showToast("Failed to save");
      }
    } catch {
      showToast("Error saving");
    } finally {
      setSaving(false);
    }
  };

  const handleContentSave = async (updates: Partial<ContentItem>) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/videos/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        showToast("Saved!");
        setContent(prev => prev.map(c =>
          c.id === selected.id ? { ...c, ...updates } : c
        ));
      }
    } catch {
      showToast("Save failed");
    }
  };

  const handleLinkUpdate = async (contentId: string, projectIds: string[]) => {
    try {
      const res = await fetch(`/api/videos/${contentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ related_projects: JSON.stringify(projectIds) }),
      });
      if (res.ok) {
        setContent(prev => prev.map(c =>
          c.id === contentId ? { ...c, relatedProjects: projectIds } : c
        ));
        showToast("Links updated!");
      }
    } catch {
      showToast("Failed to update links");
    }
  };

  // Filter and sort content
  const filteredContent = useMemo(() => {
    let items = [...content];

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.mood?.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      items = items.filter(c => c.type === typeFilter);
    }

    // Date filter
    const { start, end } = getDateFilterBounds(dateFilter);
    if (start) {
      items = items.filter(c => new Date(c.createdAt) >= start);
    }
    if (end) {
      items = items.filter(c => new Date(c.createdAt) < end);
    }

    // Album filter
    if (albumFilter) {
      items = items.filter(c => c.relatedProjects?.includes(albumFilter));
    }

    // Distributed filter
    if (showDistributedOnly) {
      items = items.filter(c => c.distributed);
    }

    // Sort
    switch (sortOption) {
      case "newest":
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "title-asc":
        items.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        items.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return items;
  }, [content, searchQuery, typeFilter, dateFilter, sortOption, albumFilter, showDistributedOnly]);

  // Loading
  if (loading) {
    return (
      <div className="h-screen bg-[#0d0c0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  // Login
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="/odubo_logo_emboss.png" alt="Odubo" className="w-10 h-10" />
            <span className="text-xl font-semibold">Social Ops</span>
          </div>
          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-600/40 text-red-200 text-sm">{loginError}</div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-3 rounded-xl bg-[#171616] border border-[#502d26]/40 focus:border-[#843c2d] focus:outline-none"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-3 rounded-xl bg-[#171616] border border-[#502d26]/40 focus:border-[#843c2d] focus:outline-none"
            />
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-[#ede8df] text-[#171616] font-semibold hover:bg-white disabled:opacity-50"
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <Link href="/" className="block mt-6 text-center text-sm text-[#726d6c] hover:text-[#ede8df]">
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className={`${showHeader ? 'h-screen' : 'h-full'} bg-[#0d0c0a] text-[#ede8df] flex flex-col overflow-hidden`}>
      {/* Header - only show when standalone */}
      {showHeader && (
        <header className="flex-shrink-0 border-b border-[#502d26]/30 px-4 py-2 flex items-center justify-between bg-[#0d0c0a]">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2 text-[#726d6c] hover:text-[#ede8df] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-xs">Admin</span>
            </Link>
            <div className="w-px h-4 bg-[#502d26]/40" />
            <span className="font-semibold text-sm">Social Ops</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Upload Button */}
            <button
              onClick={() => setViewMode(viewMode === "upload" ? "browse" : "upload")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "upload"
                  ? "bg-[#843c2d] text-white"
                  : "bg-[#302927] text-[#ede8df] hover:bg-[#302927]/80"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Upload
            </button>
            <span className="text-xs text-[#726d6c] hidden sm:inline">{user.email}</span>
            <button onClick={handleLogout} className="text-xs text-[#502d26] hover:text-[#ede8df]">Sign out</button>
          </div>
        </header>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-[#302927] border border-[#502d26]/40 text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Content Browser */}
        <aside className="w-72 xl:w-80 border-r border-[#502d26]/30 flex flex-col flex-shrink-0">
          {/* Search */}
          <div className="p-3 border-b border-[#502d26]/20">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search content..."
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs focus:outline-none focus:border-[#843c2d]"
              />
            </div>
          </div>

          {/* Filters */}
          <FilterBar
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            sortOption={sortOption}
            setSortOption={setSortOption}
            albumFilter={albumFilter}
            setAlbumFilter={setAlbumFilter}
            albums={albums}
            showDistributedOnly={showDistributedOnly}
            setShowDistributedOnly={setShowDistributedOnly}
          />

          {/* Content Stats */}
          <div className="px-3 py-2 border-b border-[#502d26]/20 text-xs text-[#726d6c]">
            {filteredContent.length} of {content.length} items
          </div>

          {/* Content List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredContent.map(item => (
              <ContentCard
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setViewMode("compose");
                }}
                onQuickLink={() => {
                  setSelectedId(item.id);
                  setViewMode("detail");
                }}
              />
            ))}
            {loadingContent && (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
              </div>
            )}
            {!loadingContent && filteredContent.length === 0 && (
              <div className="text-center py-8 text-[#726d6c]">
                <p className="text-sm">No content found</p>
                <p className="text-xs mt-1">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </aside>

        {/* Center/Right: Dynamic View */}
        {viewMode === "upload" ? (
          <div className="flex-1 flex">
            <div className="w-full max-w-md mx-auto border-x border-[#502d26]/30">
              <UploadPanel
                albums={albums}
                onClose={() => setViewMode("browse")}
                onUploadComplete={loadContent}
              />
            </div>
          </div>
        ) : viewMode === "detail" && selected ? (
          <div className="flex-1 flex">
            <div className="w-full max-w-md mx-auto border-x border-[#502d26]/30">
              <ContentDetailPanel
                content={selected}
                albums={albums}
                tracks={tracks}
                onClose={() => setViewMode("compose")}
                onSave={handleContentSave}
                onLinkUpdate={handleLinkUpdate}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Center: Composer */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
              {selected ? (
                <>
                  {/* Platform Selection Bar */}
                  <div className="flex-shrink-0 p-3 border-b border-[#502d26]/20 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#726d6c] mr-2">Post to:</span>
                    {PLATFORMS.map(platform => {
                      const isEnabled = selectedPlatforms.find(p => p.platform === platform.id)?.enabled;
                      const currentPostType = selectedPlatforms.find(p => p.platform === platform.id)?.postType;
                      return (
                        <div key={platform.id} className="flex items-center gap-1">
                          <button
                            onClick={() => togglePlatform(platform.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isEnabled
                                ? "bg-[#ede8df] text-[#171616]"
                                : "bg-[#302927] text-[#726d6c] hover:text-[#ede8df] border border-[#502d26]/40"
                            }`}
                          >
                            <span>{platform.icon}</span>
                            <span>{platform.name}</span>
                          </button>
                          {isEnabled && platform.postTypes.length > 1 && (
                            <select
                              value={currentPostType}
                              onChange={e => updatePostType(platform.id, e.target.value as PostType)}
                              className="bg-[#171616] border border-[#502d26]/40 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                            >
                              {platform.postTypes.map(pt => (
                                <option key={pt.id} value={pt.id}>{pt.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Content Preview + Fields */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="max-w-4xl mx-auto space-y-6">
                      {/* Selected Content Info */}
                      <div className="flex gap-4 p-4 rounded-xl bg-[#171616] border border-[#502d26]/30">
                        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#302927]">
                          {selected.posterUrl ? (
                            <img src={selected.posterUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              {selected.type === "clip" ? "📱" : "🎬"}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold mb-1">{selected.title}</h3>
                          <p className="text-sm text-[#726d6c] mb-2 line-clamp-2">{selected.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-[#302927] text-[10px] uppercase tracking-wider">{selected.type}</span>
                            <span className="text-[10px] text-[#502d26]">{selected.aspectRatio}</span>
                            <span className="text-[10px] text-[#726d6c]">{formatRelativeDate(selected.createdAt)}</span>
                            {selected.relatedProjects && selected.relatedProjects.length > 0 && (
                              <span className="text-[10px] text-[#843c2d]">🎵 {selected.relatedProjects.length} linked</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setViewMode("detail")}
                          className="p-2 rounded-lg hover:bg-[#302927] text-[#726d6c] hover:text-[#ede8df] transition-colors self-start"
                          title="Edit details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      </div>

                      {/* Platform-specific Fields */}
                      {enabledPlatforms.length > 0 ? (
                        <div className="space-y-4">
                          {enabledPlatforms.map(({ platform, postType }) => {
                            const config = PLATFORMS.find(p => p.id === platform)!;
                            const data = postData[platform] || { postType: "video" as PostType, caption: "" };
                            return (
                              <div key={platform} className="p-4 rounded-xl bg-[#171616] border border-[#502d26]/30">
                                <div className="flex items-center gap-2 mb-4">
                                  <span className="text-lg">{config.icon}</span>
                                  <span className="font-medium">{config.name}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-[#302927] text-[10px] capitalize">{postType}</span>
                                </div>
                                <div className="space-y-3">
                                  {config.fields.title && (
                                    <div>
                                      <label className="block text-xs text-[#726d6c] mb-1">{config.fields.title.label}</label>
                                      <input
                                        type="text"
                                        value={data.title || ""}
                                        onChange={e => updatePostData(platform, "title", e.target.value)}
                                        maxLength={config.fields.title.maxLength}
                                        placeholder={`Enter ${config.fields.title.label.toLowerCase()}...`}
                                        className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                                      />
                                      <div className="text-right text-[10px] text-[#502d26] mt-1">
                                        {(data.title || "").length}/{config.fields.title.maxLength}
                                      </div>
                                    </div>
                                  )}
                                  <div>
                                    <label className="block text-xs text-[#726d6c] mb-1">{config.fields.caption.label}</label>
                                    <textarea
                                      value={data.caption || ""}
                                      onChange={e => updatePostData(platform, "caption", e.target.value)}
                                      maxLength={config.fields.caption.maxLength}
                                      placeholder={`Write your ${config.name} caption...`}
                                      rows={3}
                                      className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm resize-none focus:outline-none focus:border-[#843c2d]"
                                    />
                                    <div className="text-right text-[10px] text-[#502d26] mt-1">
                                      {(data.caption || "").length}/{config.fields.caption.maxLength}
                                    </div>
                                  </div>
                                  {config.fields.hashtags && (
                                    <div>
                                      <label className="block text-xs text-[#726d6c] mb-1">Hashtags</label>
                                      <input
                                        type="text"
                                        value={data.hashtags || ""}
                                        onChange={e => updatePostData(platform, "hashtags", e.target.value)}
                                        placeholder="#music #artist #newrelease"
                                        className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                                      />
                                    </div>
                                  )}
                                  {config.fields.firstComment && (
                                    <div>
                                      <label className="block text-xs text-[#726d6c] mb-1">First Comment</label>
                                      <input
                                        type="text"
                                        value={data.firstComment || ""}
                                        onChange={e => updatePostData(platform, "firstComment", e.target.value)}
                                        placeholder="Add hashtags as first comment..."
                                        className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                                      />
                                    </div>
                                  )}
                                  {config.fields.privacy && (
                                    <div>
                                      <label className="block text-xs text-[#726d6c] mb-1">Privacy</label>
                                      <select
                                        value={data.privacy || config.fields.privacy[0]}
                                        onChange={e => updatePostData(platform, "privacy", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none"
                                      >
                                        {config.fields.privacy.map(opt => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {config.fields.category && (
                                    <div>
                                      <label className="block text-xs text-[#726d6c] mb-1">Category</label>
                                      <select
                                        value={data.category || config.fields.category[0]}
                                        onChange={e => updatePostData(platform, "category", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none"
                                      >
                                        {config.fields.category.map(cat => (
                                          <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {config.fields.tags && (
                                    <div>
                                      <label className="block text-xs text-[#726d6c] mb-1">Tags (comma-separated)</label>
                                      <input
                                        type="text"
                                        value={data.tags || ""}
                                        onChange={e => updatePostData(platform, "tags", e.target.value)}
                                        placeholder="music, artist, new song"
                                        className="w-full px-3 py-2 rounded-lg bg-[#0d0c0a] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d]"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-[#726d6c]">
                          <p className="text-sm mb-2">Select platforms above to start composing</p>
                          <p className="text-xs">Choose one or more platforms to post to</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex-shrink-0 p-4 border-t border-[#502d26]/30 bg-[#0d0c0a]">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setScheduleEnabled(!scheduleEnabled)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                            scheduleEnabled ? "bg-[#302927] text-[#ede8df]" : "text-[#726d6c] hover:text-[#ede8df]"
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Schedule
                        </button>
                        {scheduleEnabled && (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={scheduleDate}
                              onChange={e => setScheduleDate(e.target.value)}
                              className="px-2 py-1 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs focus:outline-none"
                            />
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={e => setScheduleTime(e.target.value)}
                              className="px-2 py-1 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handlePublish}
                        disabled={saving || enabledPlatforms.length === 0}
                        className="px-6 py-2.5 rounded-xl bg-[#ede8df] text-[#171616] text-sm font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving ? "Saving..." : scheduleEnabled ? "Schedule Post" : "Save Draft"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#302927] flex items-center justify-center mx-auto mb-4 text-2xl">📱</div>
                    <h3 className="font-semibold mb-1">Select Content</h3>
                    <p className="text-sm text-[#726d6c]">Choose content from the library to start composing</p>
                  </div>
                </div>
              )}
            </main>

            {/* Right: Platform Preview */}
            <aside className="w-72 xl:w-80 border-l border-[#502d26]/30 flex flex-col flex-shrink-0 hidden xl:flex">
              <div className="p-3 border-b border-[#502d26]/20">
                <div className="flex items-center gap-2 flex-wrap">
                  {enabledPlatforms.map(({ platform }) => {
                    const config = PLATFORMS.find(p => p.id === platform)!;
                    return (
                      <button
                        key={platform}
                        onClick={() => setActivePreviewPlatform(platform)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          activePreviewPlatform === platform
                            ? "bg-[#302927] text-[#ede8df]"
                            : "text-[#726d6c] hover:text-[#ede8df]"
                        }`}
                      >
                        {config.icon} {config.name}
                      </button>
                    );
                  })}
                  {enabledPlatforms.length === 0 && (
                    <span className="text-xs text-[#502d26]">Select platforms to preview</span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center">
                {enabledPlatforms.length > 0 && selected ? (
                  <PlatformPreview
                    platform={activePreviewPlatform}
                    postType={selectedPlatforms.find(p => p.platform === activePreviewPlatform)?.postType || "post"}
                    content={selected}
                    postData={postData[activePreviewPlatform]}
                  />
                ) : (
                  <div className="text-center text-[#726d6c] text-xs mt-8">
                    <p>Preview will appear here</p>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
