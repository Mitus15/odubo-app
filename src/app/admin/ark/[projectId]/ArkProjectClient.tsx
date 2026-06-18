"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ArkProject, ArkStatus } from "@/types/ark";
import ProjectHeader from "./components/ProjectHeader";
import OverviewSection from "./components/OverviewSection";
import TasksSection from "./components/TasksSection";
import MilestonesSection from "./components/MilestonesSection";
import NotesSection from "./components/NotesSection";
import AssetsIntegrationsSection from "./components/AssetsIntegrationsSection";
import TimelineSection from "./components/TimelineSection";
import CoachSection from "./components/CoachSection";
import { ArkDensityProvider, DensityToggle } from "../ArkDensityContext";

type SubTab = "overview" | "tasks" | "milestones" | "notes" | "assets" | "timeline" | "coach";

export default function ArkProjectClient() {
  return (
    <ArkDensityProvider>
      <ArkProjectInner />
    </ArkDensityProvider>
  );
}

function ArkProjectInner() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<ArkProject | null>(null);
  const [statuses, setStatuses] = useState<ArkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SubTab>("overview");

  const fetchProject = useCallback(async () => {
    try {
      const [projRes, statusRes] = await Promise.all([
        fetch(`/api/admin/ark/${projectId}`).then((r) => r.json()),
        fetch("/api/admin/ark/statuses").then((r) => r.json()),
      ]);
      if (projRes.success) setProject(projRes.project);
      else router.push("/admin/ark");
      if (statusRes.success) setStatuses(statusRes.statuses || []);
    } catch (e) {
      console.error("Failed to load project:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleProjectUpdate = async (updates: Partial<ArkProject>) => {
    try {
      const res = await fetch(`/api/admin/ark/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).then((r) => r.json());
      if (res.success) {
        setProject((prev) => prev ? { ...prev, ...updates } as ArkProject : prev);
        fetchProject();
      }
    } catch (e) {
      console.error("Failed to update project:", e);
    }
  };

  const tabs: { id: SubTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: "Tasks" },
    { id: "milestones", label: "Milestones" },
    { id: "notes", label: "Notes" },
    { id: "assets", label: "Assets & Integrations" },
    { id: "timeline", label: "Timeline" },
    { id: "coach", label: "Coach" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      {/* Top nav */}
      <div className="border-b border-[#302927] px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#726d6c]">
            <Link href="/admin/ark" className="hover:text-[#ede8df] transition-colors">The Ark</Link>
            <span>/</span>
            <span className="text-[#ede8df]">{project.title}</span>
          </div>
          <DensityToggle />
        </div>
      </div>

      {/* Project Header */}
      <ProjectHeader project={project} statuses={statuses} onUpdate={handleProjectUpdate} />

      {/* Sub-tab navigation */}
      <div className="border-b border-[#302927] px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#843c2d] text-[#ede8df]"
                  : "border-transparent text-[#726d6c] hover:text-[#ede8df]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="ark-section">
        {activeTab === "overview" && <OverviewSection project={project} onUpdate={handleProjectUpdate} />}
        {activeTab === "tasks" && <TasksSection projectId={projectId} statuses={statuses} />}
        {activeTab === "milestones" && <MilestonesSection projectId={projectId} statuses={statuses} />}
        {activeTab === "notes" && <NotesSection projectId={projectId} />}
        {activeTab === "assets" && <AssetsIntegrationsSection projectId={projectId} />}
        {activeTab === "timeline" && <TimelineSection projectId={projectId} />}
        {activeTab === "coach" && <CoachSection projectId={projectId} />}
      </div>
    </div>
  );
}
