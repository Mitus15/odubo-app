"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ArkProject, ArkCategory, ArkStatus } from "@/types/ark";
import { ArkDensityProvider, useArkDensity, DensityToggle } from "./ArkDensityContext";

type ViewMode = "grid" | "list" | "board";

export default function ArkDashboardClient() {
  return (
    <ArkDensityProvider>
      <ArkDashboardInner />
    </ArkDensityProvider>
  );
}

function ArkDashboardInner() {
  const router = useRouter();
  const [projects, setProjects] = useState<ArkProject[]>([]);
  const [categories, setCategories] = useState<ArkCategory[]>([]);
  const [statuses, setStatuses] = useState<ArkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterStatus) params.set("status", filterStatus);
      if (search) params.set("search", search);

      const [projRes, catRes, statusRes] = await Promise.all([
        fetch(`/api/admin/ark?${params}`).then((r) => r.json()),
        fetch("/api/admin/ark/categories").then((r) => r.json()),
        fetch("/api/admin/ark/statuses?applies_to=project").then((r) => r.json()),
      ]);

      if (projRes.success) setProjects(projRes.projects || []);
      if (catRes.success) setCategories(catRes.categories || []);
      if (statusRes.success) setStatuses(statusRes.statuses || []);
    } catch (e) {
      console.error("Failed to load Ark data:", e);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const priorityColors: Record<string, string> = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#3b82f6",
    low: "#6b7280",
  };

  // Group projects by status for board view
  const projectsByStatus = statuses.reduce<Record<string, ArkProject[]>>(
    (acc, s) => {
      acc[s.id] = projects.filter((p) => p.status_id === s.id);
      return acc;
    },
    {}
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-[#0d0c0a]/95 backdrop-blur border-b border-[#302927] px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-[#726d6c] hover:text-[#ede8df] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <h1 className="text-xl font-semibold">The Ark</h1>
            <span className="text-sm text-[#726d6c]">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Density Toggle */}
            <DensityToggle />

            {/* View Toggles */}
            <div className="flex bg-[#1a1816] border border-[#302927] rounded-lg overflow-hidden">
              {(["grid", "list", "board"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    viewMode === mode
                      ? "bg-[#843c2d] text-[#ede8df]"
                      : "text-[#726d6c] hover:text-[#ede8df]"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <Link
              href="/admin/ark/review"
              className="px-4 py-1.5 border border-[#302927] text-[#ede8df] rounded-lg text-sm font-medium hover:border-[#843c2d]/50 transition-colors"
            >
              Review
            </Link>
            <Link
              href="/admin/ark/calendar"
              className="px-4 py-1.5 border border-[#302927] text-[#ede8df] rounded-lg text-sm font-medium hover:border-[#843c2d]/50 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              Planner
            </Link>
            <Link href="/admin/ark/settings" className="p-1.5 text-[#726d6c] hover:text-[#ede8df] transition-colors" title="Ark Settings">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </Link>
            <Link
              href="/admin/ark/create"
              className="px-4 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 transition-colors"
            >
              + New Project
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-1.5 text-sm text-[#ede8df] placeholder-[#726d6c] w-48 focus:outline-none focus:border-[#843c2d]"
          />

          {/* Category pills */}
          <button
            onClick={() => setFilterCategory("")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              !filterCategory
                ? "bg-[#843c2d] border-[#843c2d] text-[#ede8df]"
                : "border-[#302927] text-[#726d6c] hover:text-[#ede8df]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id === filterCategory ? "" : cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterCategory === cat.id
                  ? "border-transparent text-white"
                  : "border-[#302927] text-[#726d6c] hover:text-[#ede8df]"
              }`}
              style={
                filterCategory === cat.id
                  ? { backgroundColor: cat.color || "#843c2d" }
                  : undefined
              }
            >
              {cat.icon ? `${cat.icon} ` : ""}{cat.name}
            </button>
          ))}

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1a1816] border border-[#302927] rounded-lg px-2 py-1 text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
          >
            <option value="">All Statuses</option>
            {statuses.filter(s => !s.is_closed).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="ark-section">
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-xl font-medium text-[#ede8df] mb-2">No projects yet</h2>
            <p className="text-[#726d6c] mb-6">Create your first project to get started</p>
            <Link
              href="/admin/ark/create"
              className="inline-flex px-6 py-2.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 transition-colors"
            >
              Create Project
            </Link>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ark-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onClick={() => router.push(`/admin/ark/${p.id}`)} />
            ))}
          </div>
        ) : viewMode === "list" ? (
          <div className="ark-list">
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} onClick={() => router.push(`/admin/ark/${p.id}`)} />
            ))}
          </div>
        ) : (
          /* Board view */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statuses.filter(s => !s.is_closed || projectsByStatus[s.id]?.length > 0).map((s) => (
              <div key={s.id} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || "#6b7280" }} />
                  <span className="text-sm font-medium text-[#ede8df]">{s.name}</span>
                  <span className="text-xs text-[#726d6c]">({projectsByStatus[s.id]?.length || 0})</span>
                </div>
                <div className="space-y-2">
                  {(projectsByStatus[s.id] || []).map((p) => (
                    <ProjectCard key={p.id} project={p} compact onClick={() => router.push(`/admin/ark/${p.id}`)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project: p, compact, onClick }: { project: ArkProject; compact?: boolean; onClick: () => void }) {
  const taskPercent = p.task_count && p.task_count > 0 ? Math.round(((p.task_done_count || 0) / p.task_count) * 100) : p.progress_percent;

  return (
    <button
      onClick={onClick}
      className={`ark-card w-full text-left bg-[#1a1816] border border-[#302927] hover:border-[#843c2d]/50 transition-colors ${compact ? "!p-3" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {p.icon && <span className="text-lg">{p.icon}</span>}
            <h3 className="font-medium text-[#ede8df] truncate ark-text-base">{p.title}</h3>
          </div>
          {p.category_name && (
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: `${p.category_color || "#843c2d"}20`, color: p.category_color || "#843c2d" }}
            >
              {p.category_icon ? `${p.category_icon} ` : ""}{p.category_name}
            </span>
          )}
        </div>
        {p.status_name && (
          <span
            className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: `${p.status_color || "#6b7280"}20`, color: p.status_color || "#6b7280" }}
          >
            {p.status_name}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {(taskPercent || 0) > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-[#726d6c] mb-1">
            <span>Progress</span>
            <span>{taskPercent}%</span>
          </div>
          <div className="h-1 bg-[#302927] rounded-full overflow-hidden">
            <div className="h-full bg-[#843c2d] rounded-full transition-all" style={{ width: `${taskPercent}%` }} />
          </div>
        </div>
      )}

      {!compact && (
        <div className="flex items-center justify-between mt-3 text-xs text-[#726d6c]">
          <div className="flex items-center gap-3">
            {p.task_count !== undefined && p.task_count > 0 && (
              <span>{p.task_done_count || 0}/{p.task_count} tasks</span>
            )}
            {p.priority && p.priority !== "medium" && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.priority === "critical" ? "#ef4444" : p.priority === "high" ? "#f59e0b" : "#6b7280" }} />
                {p.priority}
              </span>
            )}
          </div>
          {p.target_date && (
            <span>{new Date(p.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          )}
        </div>
      )}
    </button>
  );
}

function ProjectRow({ project: p, onClick }: { project: ArkProject; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="ark-row w-full flex items-center bg-[#1a1816] border border-[#302927] hover:border-[#843c2d]/50 transition-colors text-left"
    >
      {p.icon && <span className="ark-emoji-sm flex-shrink-0">{p.icon}</span>}
      <div className="min-w-0 flex-1">
        <span className="ark-text-base font-medium text-[#ede8df] truncate block">{p.title}</span>
      </div>
      {p.category_name && (
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium hidden sm:inline"
          style={{ backgroundColor: `${p.category_color || "#843c2d"}20`, color: p.category_color || "#843c2d" }}
        >
          {p.category_name}
        </span>
      )}
      {p.status_name && (
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium"
          style={{ backgroundColor: `${p.status_color || "#6b7280"}20`, color: p.status_color || "#6b7280" }}
        >
          {p.status_name}
        </span>
      )}
      {p.task_count !== undefined && p.task_count > 0 && (
        <span className="text-xs text-[#726d6c] flex-shrink-0 hidden sm:inline">
          {p.task_done_count || 0}/{p.task_count}
        </span>
      )}
      {p.target_date && (
        <span className="text-xs text-[#726d6c] flex-shrink-0">
          {new Date(p.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
    </button>
  );
}
