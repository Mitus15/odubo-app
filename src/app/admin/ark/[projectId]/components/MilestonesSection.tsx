"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArkMilestone, ArkStatus } from "@/types/ark";

interface Props {
  projectId: string;
  statuses: ArkStatus[];
}

function isOverdue(dateStr: string | null, isClosed: boolean): boolean {
  if (!dateStr || isClosed) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function daysUntil(dateStr: string): string {
  const diff = Math.ceil((new Date(dateStr).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff} days`;
}

export default function MilestonesSection({ projectId, statuses }: Props) {
  const [milestones, setMilestones] = useState<ArkMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ark/${projectId}/milestones`).then((r) => r.json());
      if (res.success) setMilestones(res.milestones || []);
    } catch (e) {
      console.error("Failed to fetch milestones:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  const addMilestone = async () => {
    if (!newTitle.trim()) return;
    await fetch(`/api/admin/ark/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        sort_order: milestones.length,
        target_date: newTargetDate || undefined,
      }),
    });
    setNewTitle("");
    setNewTargetDate("");
    fetchMilestones();
  };

  const updateMilestone = async (id: string, updates: Record<string, unknown>) => {
    await fetch(`/api/admin/ark/${projectId}/milestones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    fetchMilestones();
  };

  const deleteMilestone = async (id: string) => {
    await fetch(`/api/admin/ark/${projectId}/milestones/${id}`, { method: "DELETE" });
    fetchMilestones();
  };

  const projectStatuses = statuses.filter((s) => s.applies_to === "all" || s.applies_to === "project");

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl ark-list" style={{ gap: 'var(--ark-gap-lg, 16px)' }}>
      <div className="ark-card bg-[#1a1816] border border-[#302927]">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMilestone()}
            placeholder="Add a milestone..."
            className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
          />
          <button onClick={addMilestone} disabled={!newTitle.trim()} className="px-4 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 disabled:opacity-40">Add</button>
        </div>
        <div className="mt-2">
          <input
            type="date"
            value={newTargetDate}
            onChange={(e) => setNewTargetDate(e.target.value)}
            className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d] [color-scheme:dark]"
          />
          <span className="text-[10px] text-[#726d6c] ml-2">Target date</span>
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-12 text-[#726d6c] text-sm">No milestones yet.</div>
      ) : (
        <div className="ark-list">
          {milestones.map((m, i) => {
            const isClosed = statuses.find((s) => s.id === m.status_id)?.is_closed === 1;
            const progress = m.task_count && m.task_count > 0 ? Math.round(((m.task_done_count || 0) / m.task_count) * 100) : 0;
            const overdue = isOverdue(m.target_date, isClosed);
            return (
              <div key={m.id} className={`ark-card bg-[#1a1816] border group ${overdue ? "border-red-500/30" : "border-[#302927]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isClosed ? "bg-[#10b981] text-white" : "bg-[#302927] text-[#726d6c]"}`}>
                      {isClosed ? "✓" : i + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className={`ark-text-base font-medium ${isClosed ? "line-through text-[#726d6c]" : "text-[#ede8df]"}`}>{m.title}</h4>
                      {m.description && <p className="text-xs text-[#726d6c] mt-0.5">{m.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.task_count !== undefined && m.task_count > 0 && (
                      <span className="text-xs text-[#726d6c]">{m.task_done_count}/{m.task_count} tasks</span>
                    )}

                    {/* Target date picker */}
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={m.target_date || ""}
                        onChange={(e) => updateMilestone(m.id, { target_date: e.target.value || null, title: m.title })}
                        className="bg-transparent border-none text-[10px] text-[#726d6c] focus:outline-none cursor-pointer w-[100px] [color-scheme:dark]"
                      />
                      {m.target_date && (
                        <span className={`text-[10px] font-medium whitespace-nowrap ${overdue ? "text-red-400" : isClosed ? "text-[#10b981]" : "text-[#726d6c]"}`}>
                          {isClosed ? "Done" : daysUntil(m.target_date)}
                        </span>
                      )}
                    </div>

                    <select
                      value={m.status_id || ""}
                      onChange={(e) => updateMilestone(m.id, { status_id: e.target.value, title: m.title })}
                      className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 text-xs text-[#ede8df] focus:outline-none"
                    >
                      <option value="">No status</option>
                      {projectStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button onClick={() => deleteMilestone(m.id)} className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                {progress > 0 && (
                  <div className="mt-3 h-1 bg-[#302927] rounded-full overflow-hidden">
                    <div className="h-full bg-[#843c2d] rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
