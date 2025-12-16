"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "../UserProvider";
import { useRouter } from "next/navigation";
import AdminNavigation from "@/components/AdminNavigation";

type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    role: "admin" | "editor" | "viewer" | null;
    is_admin: boolean;
  } | null;
};

type FakeClipItem = {
  id: string;
  uid?: string;
  type: "video" | "clip";
  title: string;
  purpose: string;
  createdAt: string;
  url?: string;
  posterUrl?: string;
};

type FakePostItem = {
  id: string;
  contentId: string;
  title: string;
  status: "draft" | "scheduled" | "published" | "archived";
  platforms: PlatformKey[];
  scheduledFor?: string;
  publishedAt?: string;
};

const MOCK_UNDISTRIBUTED_CLIPS: FakeClipItem[] = [
  {
    id: "clip_und_1",
    type: "clip",
    title: "New Hoodie Closeup (Reels cut)",
    purpose: "Product spotlight",
    createdAt: "2025-12-07",
  },
  {
    id: "clip_und_2",
    type: "clip",
    title: "Street Style Walkthrough (TikTok)",
    purpose: "Lookbook",
    createdAt: "2025-12-08",
  },
  {
    id: "vid_und_1",
    type: "video",
    title: "Longform Studio Session Recap",
    purpose: "Behind the scenes",
    createdAt: "2025-12-09",
  },
];

const MOCK_DEPLOYED_POSTS: FakePostItem[] = [
  {
    id: "post_1",
    contentId: "vid_1",
    title: "Lookbook Drop 01 launch day push",
    status: "published",
    platforms: ["Instagram", "TikTok"],
    publishedAt: "2025-12-01 14:00",
  },
  {
    id: "post_2",
    contentId: "clip_1",
    title: "Outfit transition teaser",
    status: "scheduled",
    platforms: ["TikTok", "YouTube"],
    scheduledFor: "2025-12-12 10:00",
  },
];

const PLATFORMS = ["TikTok", "Instagram", "Facebook", "YouTube"] as const;

type PlatformKey = (typeof PLATFORMS)[number];

type ComposerState = Record<PlatformKey, string>;

type TargetEdit = {
  platform: string;
  caption: string;
  status: string;
  scheduledAt: string | null;
};

export default function SocialOpsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "editor" | "viewer" | null>(null);
  const [leftTab, setLeftTab] = useState<"undistributed" | "deployed">("undistributed");

  const [undistributedClips, setUndistributedClips] = useState<FakeClipItem[]>([]);
  const [deployedPosts, setDeployedPosts] = useState<FakePostItem[]>([]);
  const [schedulingPostId, setSchedulingPostId] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState<string>("");
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [contentListFocused, setContentListFocused] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"all" | "clip" | "video">("all");
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("TikTok");
  const [composer, setComposer] = useState<ComposerState>({
    TikTok: "",
    Instagram: "",
    Facebook: "",
    YouTube: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [previewPadTop, setPreviewPadTop] = useState<string>("56.25%"); // default 16:9
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [toast, setToast] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPostId, setEditorPostId] = useState<string | null>(null);
  const [editorGoal, setEditorGoal] = useState<string>("");
  const [editorTargets, setEditorTargets] = useState<TargetEdit[]>([]);
  const [editorSaving, setEditorSaving] = useState(false);
  const [lastSavedSelection, setLastSavedSelection] = useState<string | null>(null);

  const isoToLocalInputValue = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  // Gate via user context; avoid redirects to prevent reload churn
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setAuthError("You must be signed in to access Social Ops.");
      return;
    }
    const role = (user.role as any) || (user.is_admin ? "admin" : null);
    if (!(role === "admin" || role === "editor")) {
      setAuthError("You do not have permission to access Social Ops.");
    } else {
      setAuthError(null);
    }
  }, [userLoading, user]);

  if (userLoading) {
    return (
      <div className="h-full w-full bg-[#171616] flex items-center justify-center">
        <div className="text-[#ede8df] text-sm">Loading identity…</div>
      </div>
    );
  }

  // Set identity details once user context is ready
  useEffect(() => {
    if (userLoading) return;
    const role = (user?.role as any) || (user?.is_admin ? "admin" : null);
    setUserId(user?.id ?? null);
    setUserRole(role ?? null);
    if (!user || !(role === "admin" || role === "editor")) {
      setLoading(false);
    }
  }, [userLoading, user]);

  // Autosave key per-user
  const draftKey = userId ? `socialops:draft:${userId}` : null;

  // Restore draft from localStorage
  useEffect(() => {
    if (!draftKey) return;
    try {
      // Only restore selection on navigation, not hard reloads
      let navType: string | undefined;
      try {
        const navEntries = (performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation') : [] as any;
        if (navEntries && navEntries[0] && typeof navEntries[0].type === 'string') {
          navType = navEntries[0].type as string;
        }
      } catch {}

      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as {
          selectedContentId?: string | null;
          composer?: ComposerState;
          activePlatform?: PlatformKey;
          leftTab?: "undistributed" | "deployed";
        };
        // Only restore selected content if navigation was not a hard reload
        if (navType !== 'reload' && typeof d.selectedContentId !== "undefined") {
          setSelectedContentId(d.selectedContentId);
        }
        if (d.composer) setComposer(d.composer);
        if (d.activePlatform) setActivePlatform(d.activePlatform);
        if (d.leftTab) setLeftTab(d.leftTab);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Persist draft to localStorage whenever it changes
  useEffect(() => {
    if (!draftKey) return;
    try {
      const payload = {
        selectedContentId,
        composer,
        activePlatform,
        leftTab,
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
      if (selectedContentId) setLastSavedSelection(selectedContentId);
    } catch {}
  }, [draftKey, selectedContentId, composer, activePlatform, leftTab]);

  // Warn before unload if there is unsaved content
  useEffect(() => {
    const hasUnsaved = Object.values(composer).some((v) => (v ?? "").trim().length > 0);
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [composer]);

  // Background refresh for media list with debounce-like cadence
  useEffect(() => {
    if (leftTab !== 'undistributed') return;
    const interval = setInterval(async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim().length > 0) params.set('q', searchQuery.trim());
        if (typeFilter !== 'all') params.set('type', typeFilter);
        const qs = params.toString();
        const url = qs ? `/api/media/all?${qs}` : '/api/media/all';
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const clipsData = (await res.json()) as { media?: any[] };
          setUndistributedClips(
            (clipsData.media || []).map((c: any) => ({
              id: c.id,
              uid: c.uid,
              type: c.type === 'music-video' ? 'video' : 'clip',
              title: c.title,
              purpose: c.purpose,
              createdAt: c.createdAt,
              url: c.url,
              posterUrl: c.posterUrl,
            }))
          );
        }
      } catch {}
    }, 7000);
    return () => clearInterval(interval);
  }, [leftTab, searchQuery, typeFilter]);

  // Fetch undistributed clips and deployed posts
  useEffect(() => {
    const loadContent = async () => {
      if (!userRole || (userRole !== "admin" && userRole !== "editor")) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadingContent(true);
      try {
        const [clipsRes, postsRes] = await Promise.all([
          fetch("/api/media/all", { cache: "no-store" }),
          fetch("/api/social/posts", { cache: "no-store" }),
        ]);

        if (clipsRes.ok) {
          const clipsData = (await clipsRes.json()) as { media?: any[] };
          setUndistributedClips(
            (clipsData.media || []).map((c: any) => ({
              id: c.id,
              uid: c.uid,
              type: c.type === "music-video" ? "video" : "clip",
              title: c.title,
              purpose: c.purpose,
              createdAt: c.createdAt,
              url: c.url,
              posterUrl: c.posterUrl,
            }))
          );
        }

        if (postsRes.ok) {
          const postsData = (await postsRes.json()) as { posts?: any[] };
          setDeployedPosts(
            (postsData.posts || []).map((p: any) => ({
              id: p.id.toString(),
              contentId: p.contentId?.toString() || "",
              title: p.goal || "Untitled Post",
              status: p.status,
              platforms: p.platforms || [],
              scheduledFor: p.scheduledAt,
              publishedAt: p.publishedAt,
            }))
          );
        }
      } catch (e) {
        console.warn("[Social Ops] loadContent error", e);
      } finally {
        setLoading(false);
        setLoadingContent(false);
      }
    };
    loadContent();
  }, [userRole]);

  const q = searchQuery.trim().toLowerCase();
  const undistributedFiltered = useMemo(() => {
    return undistributedClips.filter((c) => {
      const matchesType = typeFilter === "all" ? true : c.type === typeFilter;
      const matchesQuery = q.length === 0 ? true : (c.title || "").toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [undistributedClips, q, typeFilter]);

  const deployedFiltered = useMemo(() => {
    if (!q) return deployedPosts;
    return deployedPosts.filter((p) => (p.title || "").toLowerCase().includes(q));
  }, [deployedPosts, q]);

  const selected = useMemo(() => {
    if (!selectedContentId) return null;
    return undistributedClips.find((c) => c.id === selectedContentId) || null;
  }, [selectedContentId, undistributedClips]);

  // Debounced server-side filtering for media/all when using search or type filter
  useEffect(() => {
    if (leftTab !== "undistributed") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim().length > 0) params.set("q", searchQuery.trim());
        if (typeFilter !== "all") params.set("type", typeFilter);
        const qs = params.toString();
        const url = qs ? `/api/media/all?${qs}` : "/api/media/all";
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (res.ok) {
          const clipsData = (await res.json()) as { media?: any[] };
          setUndistributedClips(
            (clipsData.media || []).map((c: any) => ({
              id: c.id,
              uid: c.uid,
              type: c.type === "music-video" ? "video" : "clip",
              title: c.title,
              purpose: c.purpose,
              createdAt: c.createdAt,
              url: c.url,
              posterUrl: c.posterUrl,
            }))
          );
        }
      } catch (e) {
        // ignore aborts
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [leftTab, searchQuery, typeFilter]);

  // Compute preview aspect ratio from poster image when available
  useEffect(() => {
    if (!selected || !selected.posterUrl) {
      setPreviewPadTop("56.25%");
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      if (w > 0 && h > 0) {
        const pad = (h / w) * 100;
        setPreviewPadTop(`${pad}%`);
      } else {
        setPreviewPadTop("56.25%");
      }
    };
    img.onerror = () => setPreviewPadTop("56.25%");
    img.src = selected.posterUrl as string;
    return () => {
      cancelled = true;
    };
  }, [selected?.posterUrl, selected?.id]);

  // hls.js fallback for .m3u8 in Chromium-based browsers
  useEffect(() => {
    const url = selected?.url || '';
    if (!url || !url.endsWith('.m3u8')) return;
    const videoEl = document.getElementById('social-preview-video') as HTMLVideoElement | null;
    if (!videoEl) return;
    try {
      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS supported (Safari); nothing to do
        return;
      }
    } catch {}
    let hls: any;
    (async () => {
      try {
        const mod = await import('hls.js');
        const Hls = (mod as any).default || (mod as any);
        if (Hls && Hls.isSupported && Hls.isSupported()) {
          hls = new Hls({ maxBufferLength: 10, enableWorker: true });
          hls.loadSource(url);
          hls.attachMedia(videoEl);
        }
      } catch (e) {
        console.warn('[Social Ops] hls.js fallback failed:', e);
      }
    })();
    return () => {
      try { if (hls && hls.destroy) hls.destroy(); } catch {}
    };
  }, [selected?.url]);

  // Debug: log selected clip
  useEffect(() => {
    if (selected) {
      console.log('[Social Ops] Selected clip:', selected);
    }
  }, [selected]);

  const handleComposerChange = (platform: PlatformKey, value: string) => {
    setComposer((prev) => ({ ...prev, [platform]: value }));
  };

  const handleSaveDraft = async () => {
    if (saving) return;
    setSaving(true);
    setSaveMessage(null);
    setLoadingContent(true);
    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceContentId: selected?.id ?? null,
          contentType: selected ? selected.type : "clip",
          goal: selected ? selected.purpose : null,
          composer,
          status: "draft",
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        const message = data && data.error ? data.error : "Failed to save draft";
        setSaveMessage(message);
        return;
      }

      setSaveMessage("Draft saved.");
      // Optionally clear local draft after saving
      try { if (draftKey) localStorage.removeItem(draftKey); } catch {}
      
      // Reload posts to show the new draft in "Deployed Posts"
      const postsRes = await fetch("/api/social/posts", { cache: "no-store" });
      if (postsRes.ok) {
        const postsData = (await postsRes.json()) as { posts?: any[] };
        setDeployedPosts(
          (postsData.posts || []).map((p: any) => ({
            id: p.id.toString(),
            contentId: p.contentId?.toString() || "",
            title: p.goal || "Untitled Post",
            status: p.status,
            platforms: p.platforms || [],
            scheduledFor: p.scheduledAt,
            publishedAt: p.publishedAt,
          }))
        );
      }
    } catch (e) {
      console.warn('[Social Ops] save draft error', e);
    } finally {
      setLoadingContent(false);
      setSaving(false);
    }
  };

  // Background refresh interval without HMR-induced reloads
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const postsRes = await fetch('/api/social/posts', { cache: 'no-store' });
        if (postsRes.ok) {
          const postsData = (await postsRes.json()) as { posts?: any[] };
          setDeployedPosts(
            (postsData.posts || []).map((p: any) => ({
              id: p.id.toString(),
              contentId: p.contentId?.toString() || '',
              title: p.goal || 'Untitled Post',
              status: p.status,
              platforms: p.platforms || [],
              scheduledFor: p.scheduledAt,
              publishedAt: p.publishedAt,
            }))
          );
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUseInComposer = (clip: FakeClipItem) => {
    setSelectedContentId(clip.id);
  };

  const handleNewPost = () => {
    // Clear composer for fresh post
    setComposer({ TikTok: "", Instagram: "", Facebook: "", YouTube: "" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#171616] text-[#ede8df] flex items-center justify-center">
        <p className="text-sm text-[#b2a491]">Loading Social Ops…</p>
      </div>
    );
  }

  if (authError && (userRole !== "admin" && userRole !== "editor")) {
    return (
      <div className="min-h-screen bg-[#171616] text-[#ede8df] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-3">Access Restricted</h1>
          <p className="text-[#b2a491] mb-4">{authError}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 rounded-lg bg-[#ede8df] text-[#171616] hover:bg-[#d9d3c9]"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-[#171616] text-[#ede8df] flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - var(--app-nav-height, 0px))' }}
    >
      <div className="flex-shrink-0 border-b border-[#502d26]/30 bg-[#171616]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div>
          {toast && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-md bg-[#302927] text-[#ede8df] text-[11px] border border-[#502d26]/40">
              {toast}
            </div>
          )}
            <h1 className="text-lg font-semibold tracking-wide">Social Ops</h1>
            <p className="text-xs text-[#b2a491] mt-1">
              Plan, stage and distribute content across TikTok, Instagram, Facebook and YouTube.
            </p>
          </div>
          <div className="hidden md:block">
            <span className="text-xs text-[#726d6c] uppercase tracking-[0.2em]">
              {userRole === "admin" ? "ADMIN" : userRole === "editor" ? "EDITOR" : "VIEWER"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Content Library (Undistributed Clips / Deployed Posts) */}
        <aside className="w-full md:w-72 lg:w-80 border-r border-[#502d26]/30 bg-[#171616] flex-shrink-0 overflow-y-auto relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="p-4 border-b border-[#502d26]/30 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-[#726d6c]">Content</p>
              <button
                onClick={handleNewPost}
                className="px-2 py-1 rounded-lg bg-[#302927] hover:bg-[#502d26]/80 text-[10px] text-[#ede8df] border border-[#502d26]/40"
              >
                New Post
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 text-[10px]">
              <button
                onClick={() => setLeftTab("undistributed")}
                className={`flex-1 px-3 py-1 rounded-full border transition-colors ${
                  leftTab === "undistributed"
                    ? "bg-[#ede8df] text-[#171616] border-[#ede8df]"
                    : "bg-transparent text-[#ede8df] border-[#502d26]/40 hover:bg-[#302927]"
                }`}
              >
                Undistributed Clips
              </button>
              <button
                onClick={() => setLeftTab("deployed")}
                className={`flex-1 px-3 py-1 rounded-full border transition-colors ${
                  leftTab === "deployed"
                    ? "bg-[#ede8df] text-[#171616] border-[#ede8df]"
                    : "bg-transparent text-[#ede8df] border-[#502d26]/40 hover:bg-[#302927]"
                }`}
              >
                Deployed Posts
              </button>
            </div>

            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={leftTab === "undistributed" ? "Search clips, videos" : "Search posts"}
              className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:ring-1 focus:ring-[#843c2d]"
            />

            {leftTab === "undistributed" && (
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  onClick={() => setTypeFilter("all")}
                  className={`flex-1 px-3 py-1 rounded-full border transition-colors ${
                    typeFilter === "all"
                      ? "bg-[#ede8df] text-[#171616] border-[#ede8df]"
                      : "bg-transparent text-[#ede8df] border-[#502d26]/40 hover:bg-[#302927]"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTypeFilter("clip")}
                  className={`flex-1 px-3 py-1 rounded-full border transition-colors ${
                    typeFilter === "clip"
                      ? "bg-[#ede8df] text-[#171616] border-[#ede8df]"
                      : "bg-transparent text-[#ede8df] border-[#502d26]/40 hover:bg-[#302927]"
                  }`}
                >
                  Clips
                </button>
                <button
                  onClick={() => setTypeFilter("video")}
                  className={`flex-1 px-3 py-1 rounded-full border transition-colors ${
                    typeFilter === "video"
                      ? "bg-[#ede8df] text-[#171616] border-[#ede8df]"
                      : "bg-transparent text-[#ede8df] border-[#502d26]/40 hover:bg-[#302927]"
                  }`}
                >
                  Videos
                </button>
              </div>
            )}
          </div>

          {/* Undistributed Clips List */}
          {leftTab === "undistributed" && (
            <div
              id="social-content-list"
              tabIndex={0}
              className="p-2 space-y-2 outline-none"
              onKeyDown={(e) => {
                const items = undistributedFiltered;
                if (items.length === 0) return;
                const idx = items.findIndex((c) => c.id === selectedContentId);
                if (e.key === 'ArrowDown') {
                  const next = items[Math.min(items.length - 1, idx < 0 ? 0 : idx + 1)];
                  if (next) setSelectedContentId(next.id);
                  e.preventDefault();
                } else if (e.key === 'ArrowUp') {
                  const prev = items[Math.max(0, idx > 0 ? idx - 1 : 0)];
                  if (prev) setSelectedContentId(prev.id);
                  e.preventDefault();
                } else if (e.key === 'Enter') {
                  const cur = idx >= 0 ? items[idx] : items[0];
                  if (cur) handleUseInComposer(cur);
                  e.preventDefault();
                }
              }}
            >
              {undistributedFiltered.map((item) => {
                const isActive = item.id === selectedContentId;
                return (
                  <div
                    key={item.id}
                    className={`w-full px-3 py-2 rounded-lg text-xs transition-colors border ${
                      isActive
                        ? "bg-[#302927] border-[#843c2d]/60"
                        : "bg-transparent hover:bg-[#302927]/60 border-[#502d26]/20"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedContentId(item.id);
                        try {
                          const el = document.getElementById(`clip-${item.id}`);
                          if (el && 'scrollIntoView' in el) {
                            el.scrollIntoView({ block: 'nearest' });
                          }
                        } catch {}
                      }}
                      id={`clip-${item.id}`}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate max-w-[140px]">{item.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#302927] text-[#b2a491] uppercase">
                          {item.type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#726d6c] mb-1">
                        <span className="truncate max-w-[120px]">{item.purpose}</span>
                        <span>{item.createdAt}</span>
                      </div>
                    </button>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <button
                        onClick={() => handleUseInComposer(item)}
                        className="px-2 py-1 rounded-md bg-[#302927] hover:bg-[#502d26]/80 text-[10px] text-[#ede8df] border border-[#502d26]/40"
                      >
                        Use in Composer
                      </button>
                    </div>
                  </div>
                );
              })}
              {undistributedFiltered.length === 0 && (
                <p className="text-[11px] text-[#726d6c] px-3 py-4">
                  No undistributed clips yet. Once you upload new clips/videos, they will appear here until they have
                  been used in a social post.
                </p>
              )}
            </div>
          )}

          {/* Deployed Posts List (mocked for now) */}
          {leftTab === "deployed" && (
            <div className="p-2 space-y-2">
              {deployedFiltered.map((post) => (
                <div
                  key={post.id}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-transparent hover:bg-[#302927]/60 border border-[#502d26]/20 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate max-w-[150px]">{post.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        post.status === "published"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                          : post.status === "scheduled"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/40"
                          : post.status === "archived"
                          ? "bg-[#302927] text-[#726d6c] border-[#502d26]/60"
                          : "bg-[#302927] text-[#ede8df] border-[#502d26]/60"
                      }`}
                    >
                      {post.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#726d6c] mb-1">
                    <span className="truncate max-w-[140px]">
                      {post.platforms.join(" · ")}
                    </span>
                    <span>
                      {(() => {
                        const raw = post.publishedAt || post.scheduledFor || "";
                        if (!raw) return "";
                        try {
                          const d = new Date(raw);
                          const fmt = new Intl.DateTimeFormat(undefined, {
                            year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: timezone,
                          });
                          return fmt.format(d);
                        } catch { return raw; }
                      })()}
                    </span>
                  </div>
                  {/* Inline per-platform quick scheduling */}
                  {post.platforms && post.platforms.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {post.platforms.map((pf) => (
                        <div key={pf} className="flex items-center gap-1 text-[10px]">
                          <span className="px-2 py-0.5 rounded-full bg-[#302927] border border-[#502d26]/40 text-[#b2a491]">{pf}</span>
                          <input
                            type="datetime-local"
                            onChange={async (e) => {
                              const v = e.target.value;
                              if (!v) return;
                              const dt = new Date(v);
                              if (Number.isNaN(dt.getTime())) {
                                setToast("Invalid time"); setTimeout(() => setToast(null), 2000);
                                return;
                              }
                              if (dt.getTime() <= Date.now()) {
                                setToast("Choose a future time"); setTimeout(() => setToast(null), 2000);
                                return;
                              }
                              try {
                                const res = await fetch(`/api/social/posts/${post.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    targets: [{ platform: pf, status: 'scheduled', scheduledAt: dt.toISOString() }],
                                  }),
                                });
                                if (res.ok) {
                                  const reload = await fetch('/api/social/posts', { cache: 'no-store' });
                                  if (reload.ok) {
                                    const postsData = (await reload.json()) as { posts?: any[] };
                                    setDeployedPosts(
                                      (postsData.posts || []).map((p: any) => ({
                                        id: p.id.toString(),
                                        contentId: p.contentId?.toString() || "",
                                        title: p.goal || "Untitled Post",
                                        status: p.status,
                                        platforms: p.platforms || [],
                                        scheduledFor: p.scheduledAt,
                                        publishedAt: p.publishedAt,
                                      }))
                                    );
                                  }
                                  setToast(`${pf} scheduled`); setTimeout(() => setToast(null), 2000);
                                } else {
                                  setToast(`Failed to schedule ${pf}`); setTimeout(() => setToast(null), 2000);
                                }
                              } catch (err) {
                                console.error(err);
                                setToast(`Error scheduling ${pf}`); setTimeout(() => setToast(null), 2000);
                              }
                            }}
                            className="px-2 py-1 rounded-md bg-[#171616] border border-[#502d26]/40 text-[#ede8df]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                      onClick={() => {
                        setSchedulingPostId((prev) => (prev === post.id ? null : post.id));
                        setScheduleValue("");
                      }}
                      className="px-2 py-1 rounded-md bg-[#302927] hover:bg-[#502d26]/80 text-[10px] text-[#ede8df] border border-[#502d26]/40"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/social/posts/${post.id}`, { cache: "no-store" });
                          if (!res.ok) {
                            alert("Failed to load post details");
                            return;
                          }
                          const data = (await res.json()) as {
                            post: {
                              goal: string | null;
                              targets: { platform: string; caption: string; status: string; scheduledAt: string | null }[];
                            };
                          };
                          setEditorPostId(post.id);
                          setEditorGoal(data.post.goal || post.title || "");
                          setEditorTargets(
                            (data.post.targets || []).map((t) => ({
                              platform: t.platform,
                              caption: t.caption || "",
                              status: t.status || "draft",
                              scheduledAt: t.scheduledAt || null,
                            }))
                          );
                          setEditorOpen(true);
                        } catch (e) {
                          console.error(e);
                          alert("Error opening editor");
                        }
                      }}
                      className="px-2 py-1 rounded-md bg-[#302927] hover:bg-[#502d26]/80 text-[10px] text-[#ede8df] border border-[#502d26]/40"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Archive this post?")) return;
                        try {
                          const res = await fetch(`/api/social/posts/${post.id}?action=archive`, { method: "POST" });
                          if (res.ok) {
                            const reload = await fetch("/api/social/posts", { cache: "no-store" });
                            if (reload.ok) {
                              const postsData = (await reload.json()) as { posts?: any[] };
                              setDeployedPosts(
                                (postsData.posts || []).map((p: any) => ({
                                  id: p.id.toString(),
                                  contentId: p.contentId?.toString() || "",
                                  title: p.goal || "Untitled Post",
                                  status: p.status,
                                  platforms: p.platforms || [],
                                  scheduledFor: p.scheduledAt,
                                  publishedAt: p.publishedAt,
                                }))
                              );
                            }
                          } else {
                            alert("Failed to archive post");
                          }
                        } catch (e) {
                          console.error(e);
                          alert("Error archiving post");
                        }
                      }}
                      className="px-2 py-1 rounded-md bg-[#171616] hover:bg-[#302927] text-[10px] text-[#726d6c] border border-[#502d26]/40"
                    >
                      Archive
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this post? This cannot be undone.")) return;
                        try {
                          const res = await fetch(`/api/social/posts/${post.id}`, { method: "DELETE" });
                          if (res.ok) {
                            const reload = await fetch("/api/social/posts", { cache: "no-store" });
                            if (reload.ok) {
                              const postsData = (await reload.json()) as { posts?: any[] };
                              setDeployedPosts(
                                (postsData.posts || []).map((p: any) => ({
                                  id: p.id.toString(),
                                  contentId: p.contentId?.toString() || "",
                                  title: p.goal || "Untitled Post",
                                  status: p.status,
                                  platforms: p.platforms || [],
                                  scheduledFor: p.scheduledAt,
                                  publishedAt: p.publishedAt,
                                }))
                              );
                            }
                          } else {
                            alert("Failed to delete post");
                          }
                        } catch (e) {
                          console.error(e);
                          alert("Error deleting post");
                        }
                      }}
                      className="px-2 py-1 rounded-md bg-[#171616] hover:bg-red-900/40 text-[10px] text-red-300 border border-red-900/40"
                    >
                      Delete
                    </button>
                  </div>

                  {schedulingPostId === post.id && (
                    <div className="mt-2 p-2 border border-[#502d26]/40 rounded-lg bg-[#171616]">
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={scheduleValue}
                          onChange={(e) => setScheduleValue(e.target.value)}
                          className="px-2 py-1 rounded-md bg-[#171616] border border-[#502d26]/40 text-[11px] text-[#ede8df]"
                        />
                        <button
                          onClick={async () => {
                            if (!scheduleValue) {
                              alert("Pick a date and time");
                              return;
                            }
                            const dt = new Date(scheduleValue);
                            if (Number.isNaN(dt.getTime())) {
                              alert("Invalid date/time");
                              return;
                            }
                            const now = new Date();
                            if (dt.getTime() <= now.getTime()) {
                              alert("Please choose a future time");
                              return;
                            }
                            try {
                              const scheduledAtIso = dt.toISOString();
                              const res = await fetch(`/api/social/posts/${post.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  goal: post.title,
                                  targets: (post.platforms || []).map((pf) => ({
                                    platform: pf,
                                    status: "scheduled",
                                    scheduledAt: scheduledAtIso,
                                  })),
                                }),
                              });
                              if (res.ok) {
                                setSchedulingPostId(null);
                                setScheduleValue("");
                                const reload = await fetch("/api/social/posts", { cache: "no-store" });
                                if (reload.ok) {
                                  const postsData = (await reload.json()) as { posts?: any[] };
                                  setDeployedPosts(
                                    (postsData.posts || []).map((p: any) => ({
                                      id: p.id.toString(),
                                      contentId: p.contentId?.toString() || "",
                                      title: p.goal || "Untitled Post",
                                      status: p.status,
                                      platforms: p.platforms || [],
                                      scheduledFor: p.scheduledAt,
                                      publishedAt: p.publishedAt,
                                    }))
                                  );
                                  // Inline toast
                                  try {
                                    setToast("Post scheduled");
                                    setTimeout(() => setToast(null), 2000);
                                  } catch {}
                                }
                              } else {
                                try {
                                  setToast("Failed to schedule post");
                                  setTimeout(() => setToast(null), 2000);
                                } catch {}
                              }
                            } catch (e) {
                              console.error(e);
                              try {
                                setToast("Error scheduling post");
                                setTimeout(() => setToast(null), 2000);
                              } catch {}
                            }
                          }}
                          className="px-2 py-1 rounded-md bg-[#302927] hover:bg-[#502d26]/80 text-[10px] text-[#ede8df] border border-[#502d26]/40"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setSchedulingPostId(null); setScheduleValue(""); }}
                          className="px-2 py-1 rounded-md bg-[#171616] hover:bg-[#302927] text-[10px] text-[#726d6c] border border-[#502d26]/40"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="mt-1 text-[10px] text-[#726d6c]">Saved in UTC; shown in {timezone}.</p>
                    </div>
                  )}
                </div>
              ))}
              {deployedPosts.length === 0 && (
                <p className="text-[11px] text-[#726d6c] px-3 py-4">
                  Once you start publishing or scheduling posts, they will appear here with their platform statuses.
                </p>
              )}
            </div>
          )}
        </aside>

        {/* Middle: Content Detail & AI placeholder */}
        <section className="hidden md:flex flex-col flex-1 border-r border-[#502d26]/30 bg-[#171616] overflow-hidden relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="p-4 border-b border-[#502d26]/30 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#726d6c] mb-1">Content Detail</p>
              <p className="text-sm font-medium truncate max-w-md">{selected?.title ?? "Select a piece of content"}</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#726d6c]">
              <span className="px-2 py-0.5 rounded-full bg-[#302927] border border-[#502d26]/40">
                {selected?.type ?? ""}
              </span>
              <span>{selected?.createdAt ?? ""}</span>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {selected ? (
              <div className="space-y-4">
                {selected.uid ? (
                  <div
                    className="rounded-2xl overflow-hidden bg-black border border-[#502d26]/40 mb-2"
                    style={{ position: 'relative', width: 'min(420px, 100%)', paddingTop: previewPadTop }}
                  >
                    <iframe
                      src={`https://customer-tpkm273r1u0s40no.cloudflarestream.com/${selected.uid}/iframe`}
                      style={{
                        border: 'none',
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                      }}
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                      allowFullScreen
                    />
                  </div>
                ) : selected.url ? (
                  <div
                    className="rounded-2xl overflow-hidden bg-black border border-[#502d26]/40 mb-2"
                    style={{ position: 'relative', width: 'min(420px, 100%)', paddingTop: previewPadTop }}
                  >
                    <video
                      src={selected.url}
                      poster={selected.posterUrl}
                      controls
                      playsInline
                      preload="metadata"
                      id="social-preview-video"
                      onError={() => { try { setToast('Playback error'); setTimeout(() => setToast(null), 2000); } catch {} }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#302927] border border-[#502d26]/40 flex items-center justify-center text-[#726d6c] text-xs mb-2"
                       style={{ width: 'min(420px, 100%)', aspectRatio: '16 / 9' }}>
                    No preview available
                  </div>
                )}
                {selected && !selected.uid ? (
                  <div className="space-y-2 md:col-span-2">
                    <p className="text-[#726d6c]">Stream UID</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter Cloudflare Stream UID"
                        value={composer.TikTok ? composer.TikTok : ''}
                        onChange={(e) => {
                          setComposer((prev) => ({ ...prev, TikTok: e.target.value }));
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs text-[#ede8df]"
                      />
                      <button
                        onClick={async () => {
                          const uidVal = (composer.TikTok || '').trim();
                          if (!uidVal) { setToast('Enter a UID'); setTimeout(() => setToast(null), 2000); return; }
                          try {
                            const res = await fetch(`/api/media/${selected!.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ uid: uidVal }),
                            });
                            if (res.ok) {
                              setToast('UID attached'); setTimeout(() => setToast(null), 2000);
                              const reload = await fetch('/api/media/all', { cache: 'no-store' });
                              if (reload.ok) {
                                const clipsData = (await reload.json()) as { media?: any[] };
                                setUndistributedClips(
                                  (clipsData.media || []).map((c: any) => ({
                                    id: c.id,
                                    uid: c.uid,
                                    type: c.type === 'music-video' ? 'video' : 'clip',
                                    title: c.title,
                                    purpose: c.purpose,
                                    createdAt: c.createdAt,
                                    url: c.url,
                                    posterUrl: c.posterUrl,
                                  }))
                                );
                              }
                            } else {
                              setToast('Failed to attach UID'); setTimeout(() => setToast(null), 2000);
                            }
                          } catch (e) {
                            console.error(e);
                            setToast('Error attaching UID'); setTimeout(() => setToast(null), 2000);
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-[#302927] hover:bg-[#502d26]/80 text-[11px] text-[#ede8df] border border-[#502d26]/40"
                      >
                        Attach UID
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="text-[#726d6c]">Purpose</p>
                    <p className="text-[#ede8df]">{selected.purpose}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[#726d6c]">Tags (coming soon)</p>
                    <p className="text-[#ede8df]/60">Product, drop, mood, campaign</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[#726d6c]">AI Insights (coming soon)</p>
                    <p className="text-[#ede8df]/60">Performance, recommended platforms & angles</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[#726d6c]">Post Status</p>
                    <div className="text-[#ede8df]/90">
                      {deployedPosts.filter((p) => p.contentId === selected.id).length === 0 ? (
                        <p className="text-[#ede8df]/60">No posts created from this content yet.</p>
                      ) : (
                        <div className="space-y-1">
                          <p>
                            {deployedPosts.filter((p) => p.contentId === selected.id).length} post(s) linked
                          </p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {deployedPosts
                              .filter((p) => p.contentId === selected.id)
                              .map((p) => (
                                <li key={p.id} className="text-[#b2a491]">
                                  {p.title} — {p.platforms.join(" · ")} — {p.status}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#726d6c]">
                Select a video or clip from the library to see details.
              </div>
            )}
          </div>
        </section>

        {/* Right: Per-platform Composer */}
        <section className="w-full md:w-[360px] lg:w-[420px] bg-[#171616] flex-shrink-0 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#502d26]/30">
            <p className="text-xs uppercase tracking-[0.2em] text-[#726d6c] mb-2">Composer</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
                const isActive = platform === activePlatform;
                return (
                  <button
                    key={platform}
                    onClick={() => setActivePlatform(platform)}
                    className={`px-3 py-1 rounded-full text-[11px] border transition-colors ${
                      isActive
                        ? "bg-[#ede8df] text-[#171616] border-[#ede8df]"
                        : "bg-transparent text-[#ede8df] border-[#502d26]/40 hover:bg-[#302927]"
                    }`}
                  >
                    {platform}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="text-[11px] text-[#726d6c]">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="px-2 py-1 rounded-md bg-[#171616] border border-[#502d26]/40 text-[11px] text-[#ede8df]"
              >
                {[
                  "UTC",
                  "America/Los_Angeles",
                  "America/New_York",
                  "Europe/London",
                  "Europe/Paris",
                  "Africa/Lagos",
                  "Asia/Tokyo",
                  "Asia/Singapore",
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                ].filter((v, i, a) => !!v && a.indexOf(v) === i).map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto relative">
            {/* Top shadow to indicate scroll */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/30 to-transparent" />
            <div>
              <button
                onClick={async () => {
                  if (!selected) {
                    alert("Select content first");
                    return;
                  }
                  try {
                    const res = await fetch("/api/social/prepare", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: selected.title,
                        purpose: selected.purpose,
                        platforms: PLATFORMS,
                      }),
                    });
                    if (!res.ok) {
                      alert("Failed to generate draft");
                      return;
                    }
                    const data = (await res.json()) as { composer?: Partial<Record<PlatformKey, string>> };
                    const comp = (data && data.composer) ? data.composer : {} as Partial<Record<PlatformKey, string>>;
                    setComposer((prev) => ({
                      TikTok: comp.TikTok ?? prev.TikTok,
                      Instagram: comp.Instagram ?? prev.Instagram,
                      Facebook: comp.Facebook ?? prev.Facebook,
                      YouTube: comp.YouTube ?? prev.YouTube,
                    }));
                  } catch (e) {
                    console.error(e);
                    alert("Error generating draft");
                  }
                }}
                className="mb-2 px-3 py-2 rounded-lg bg-[#302927] hover:bg-[#502d26]/80 text-[11px] text-[#ede8df] border border-[#502d26]/40"
              >
                Generate Draft
              </button>
              {lastSavedSelection && !selected && (
                <button
                  onClick={() => setSelectedContentId(lastSavedSelection)}
                  className="ml-2 px-3 py-2 rounded-lg bg-[#171616] hover:bg-[#302927] text-[11px] text-[#b2a491] border border-[#502d26]/40"
                >
                  Resume Last Selection
                </button>
              )}
            </div>
            <div className="text-[11px] text-[#726d6c]">
              <p className="mb-1">
                Draft copy for <span className="uppercase tracking-[0.15em]">{activePlatform}</span>.
              </p>
              <p>
                AI assist, hashtags and per-platform suggestions will plug in here. For now, write manually and
                save as a draft.
              </p>
            </div>
            <textarea
              value={composer[activePlatform]}
              onChange={(e) => handleComposerChange(activePlatform, e.target.value)}
              className="w-full min-h-[160px] flex-1 rounded-xl bg-[#171616] border border-[#502d26]/40 text-xs text-[#ede8df] p-3 resize-none focus:outline-none focus:ring-1 focus:ring-[#843c2d]"
              placeholder={`Write your ${activePlatform} caption, description, hashtags, etc.`}
            />
            <div className="flex items-center justify-between text-[10px] text-[#726d6c]">
              <span>Characters: {composer[activePlatform].length}</span>
              <span>Multi-platform drafts will sync from AI later.</span>
            </div>
            <button
              onClick={handleSaveDraft}
              disabled={!selected || saving}
              className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#502d26] text-[#ede8df] text-xs font-semibold hover:from-[#b85d47] hover:to-[#843c2d] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selected ? (saving ? "Saving…" : "Save Draft") : "Select content to compose"}
            </button>
            {saveMessage && (
              <p className="text-[11px] text-[#b2a491] mt-1">{saveMessage}</p>
            )}
          </div>
        </section>
      </div>
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditorOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl border border-[#502d26]/40 bg-[#171616] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Edit Post</h3>
              <button
                onClick={() => setEditorOpen(false)}
                className="text-[11px] text-[#726d6c] hover:text-[#ede8df]"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#726d6c] mb-1">Goal</label>
                <input
                  value={editorGoal}
                  onChange={(e) => setEditorGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#171616] border border-[#502d26]/40 text-xs text-[#ede8df]"
                />
              </div>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {editorTargets.map((t, idx) => (
                  <div key={t.platform + idx} className="border border-[#502d26]/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] uppercase tracking-[0.15em] text-[#b2a491]">{t.platform}</span>
                      <select
                        value={t.status}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditorTargets((prev) => prev.map((pt, i) => i === idx ? { ...pt, status: v } : pt));
                        }}
                        className="px-2 py-1 text-[11px] rounded-md bg-[#171616] border border-[#502d26]/40 text-[#ede8df]"
                      >
                        <option value="draft">draft</option>
                        <option value="scheduled">scheduled</option>
                        <option value="published">published</option>
                        <option value="archived">archived</option>
                      </select>
                    </div>
                    <textarea
                      value={t.caption}
                      onChange={(e) => setEditorTargets((prev) => prev.map((pt, i) => i === idx ? { ...pt, caption: e.target.value } : pt))}
                      className="w-full min-h-[100px] rounded-md bg-[#171616] border border-[#502d26]/40 text-xs text-[#ede8df] p-2"
                      placeholder={`Caption for ${t.platform}`}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-[11px] text-[#726d6c]">Schedule</label>
                      <input
                        type="datetime-local"
                        value={isoToLocalInputValue(t.scheduledAt)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditorTargets((prev) => prev.map((pt, i) => i === idx ? { ...pt, scheduledAt: v ? new Date(v).toISOString() : null } : pt));
                        }}
                        className="px-2 py-1 rounded-md bg-[#171616] border border-[#502d26]/40 text-[11px] text-[#ede8df]"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditorOpen(false)}
                  className="px-3 py-2 rounded-md bg-[#171616] hover:bg-[#302927] text-[11px] text-[#726d6c] border border-[#502d26]/40"
                >
                  Cancel
                </button>
                <button
                  disabled={editorSaving || !editorPostId}
                  onClick={async () => {
                    if (!editorPostId) return;
                    setEditorSaving(true);
                    try {
                      const payload = {
                        goal: editorGoal,
                        targets: editorTargets.map((t) => ({
                          platform: t.platform,
                          caption: t.caption,
                          status: t.status,
                          scheduledAt: t.scheduledAt,
                        })),
                      };
                      const res = await fetch(`/api/social/posts/${editorPostId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      if (!res.ok) {
                        alert("Failed to save changes");
                        return;
                      }
                      const reload = await fetch("/api/social/posts", { cache: "no-store" });
                      if (reload.ok) {
                        const postsData = (await reload.json()) as { posts?: any[] };
                        setDeployedPosts(
                          (postsData.posts || []).map((p: any) => ({
                            id: p.id.toString(),
                            contentId: p.contentId?.toString() || "",
                            title: p.goal || "Untitled Post",
                            status: p.status,
                            platforms: p.platforms || [],
                            scheduledFor: p.scheduledAt,
                            publishedAt: p.publishedAt,
                          }))
                        );
                      }
                      setEditorOpen(false);
                    } catch (e) {
                      console.error(e);
                      alert("Error saving changes");
                    } finally {
                      setEditorSaving(false);
                    }
                  }}
                  className="px-3 py-2 rounded-md bg-[#302927] hover:bg-[#502d26]/80 text-[11px] text-[#ede8df] border border-[#502d26]/40 disabled:opacity-50"
                >
                  {editorSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Editor Modal UI appended at end of component render

