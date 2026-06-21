"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArkMilestone, ArkStatus, ArkTask } from "@/types/ark";

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
  const [milestoneTasks, setMilestoneTasks] = useState<Record<string, ArkTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [editDescId, setEditDescId] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState("");

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);

  // Add task within milestone
  const [addTaskMilestoneId, setAddTaskMilestoneId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const projectStatuses = statuses.filter((s) => s.applies_to === "all" || s.applies_to === "project");
  const taskStatuses = statuses.filter((s) => s.applies_to === "task" || s.applies_to === "all");

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

  const fetchTasksForMilestone = async (milestoneId: string) => {
    const res = await fetch(`/api/admin/ark/${projectId}/tasks?milestone=${milestoneId}`).then((r) => r.json());
    if (res.success) setMilestoneTasks((prev) => ({ ...prev, [milestoneId]: res.tasks || [] }));
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchTasksForMilestone(id);
    }
  };

  const addMilestone = async () => {
    if (!newTitle.trim()) return;
    await fetch(`/api/admin/ark/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), sort_order: milestones.length, target_date: newTargetDate || undefined, description: newDescription || undefined }),
    });
    setNewTitle(""); setNewTargetDate(""); setNewDescription(""); setShowDesc(false);
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

  const saveTitle = (id: string) => {
    if (editTitleValue.trim()) updateMilestone(id, { title: editTitleValue.trim() });
    setEditingTitleId(null);
  };

  const saveDesc = (id: string) => {
    updateMilestone(id, { description: editDescValue || null, title: milestones.find(m => m.id === id)?.title });
    setEditDescId(null);
  };

  const addTaskToMilestone = async (milestoneId: string) => {
    if (!newTaskTitle.trim()) return;
    await fetch(`/api/admin/ark/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTaskTitle.trim(), milestone_id: milestoneId }),
    });
    setNewTaskTitle("");
    setAddTaskMilestoneId(null);
    fetchTasksForMilestone(milestoneId);
    fetchMilestones(); // refresh counts
  };

  const toggleTaskDone = async (task: ArkTask) => {
    const isClosed = statuses.find((s) => s.id === task.status_id)?.is_closed === 1;
    const target = isClosed
      ? taskStatuses.find((s) => s.is_default === 1) || taskStatuses[0]
      : taskStatuses.find((s) => s.is_closed === 1);
    if (target) {
      await fetch(`/api/admin/ark/${projectId}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_id: target.id }),
      });
      if (task.milestone_id) fetchTasksForMilestone(task.milestone_id);
      fetchMilestones();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl ark-list" style={{ gap: 'var(--ark-gap-lg, 16px)' }}>
      {/* Create */}
      <div className="ark-card bg-[#1a1816] border border-[#302927]">
        <div className="flex gap-2">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !showDesc && addMilestone()} placeholder="Add a milestone..." className="ark-input flex-1 bg-[#0d0c0a] border border-[#302927] text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
          <button onClick={addMilestone} disabled={!newTitle.trim()} className="px-4 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm font-medium hover:bg-[#843c2d]/80 disabled:opacity-40">Add</button>
        </div>
        <div className="flex gap-2 mt-2 items-center">
          <div className="flex items-center gap-1">
            <span className="ark-text-xs text-[#726d6c]">Target:</span>
            <input type="date" value={newTargetDate} onChange={(e) => setNewTargetDate(e.target.value)} className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d] [color-scheme:dark]" />
          </div>
          <button onClick={() => setShowDesc(!showDesc)} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df]">{showDesc ? "Less" : "+ Description"}</button>
        </div>
        {showDesc && (
          <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Milestone description..." rows={2} className="w-full mt-2 bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y" />
        )}
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-12 text-[#726d6c] ark-text-base">No milestones yet.</div>
      ) : (
        <div className="ark-list">
          {milestones.map((m, i) => {
            const isClosed = statuses.find((s) => s.id === m.status_id)?.is_closed === 1;
            const progress = m.task_count && m.task_count > 0 ? Math.round(((m.task_done_count || 0) / m.task_count) * 100) : 0;
            const overdue = isOverdue(m.target_date, isClosed);
            const isExpanded = expandedId === m.id;
            const tasks = milestoneTasks[m.id] || [];

            return (
              <div key={m.id} className={`ark-card bg-[#1a1816] border group ${overdue ? "border-red-500/30" : "border-[#302927]"}`}>
                <div className="flex items-center justify-between" style={{ gap: 'var(--ark-gap, 12px)' }}>
                  <div className="flex items-center min-w-0" style={{ gap: 'var(--ark-gap, 12px)' }}>
                    {/* Expand toggle */}
                    <button onClick={() => toggleExpand(m.id)} className="flex-shrink-0 text-[#726d6c] hover:text-[#ede8df]">
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>

                    <span className={`w-8 h-8 rounded-full flex items-center justify-center ark-text-xs font-bold flex-shrink-0 ${isClosed ? "bg-[#10b981] text-white" : "bg-[#302927] text-[#726d6c]"}`}>
                      {isClosed ? "✓" : i + 1}
                    </span>

                    <div className="min-w-0">
                      {editingTitleId === m.id ? (
                        <input
                          type="text" value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onBlur={() => saveTitle(m.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveTitle(m.id); if (e.key === "Escape") setEditingTitleId(null); }}
                          className="bg-transparent border-b border-[#843c2d] ark-text-base font-medium text-[#ede8df] focus:outline-none w-full"
                          autoFocus
                        />
                      ) : (
                        <h4
                          className={`ark-text-base font-medium cursor-pointer hover:text-[#843c2d] transition-colors ${isClosed ? "line-through text-[#726d6c]" : "text-[#ede8df]"}`}
                          onClick={() => { setEditingTitleId(m.id); setEditTitleValue(m.title); }}
                          title="Click to edit"
                        >
                          {m.title}
                        </h4>
                      )}
                      {m.description && !isExpanded && <p className="ark-text-xs text-[#726d6c] mt-0.5 truncate">{m.description}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.task_count !== undefined && m.task_count > 0 && (
                      <span className="ark-text-xs text-[#726d6c]">{m.task_done_count}/{m.task_count}</span>
                    )}
                    <input type="date" value={m.target_date || ""} onChange={(e) => updateMilestone(m.id, { target_date: e.target.value || null, title: m.title })} className="bg-transparent border-none ark-text-xs text-[#726d6c] focus:outline-none cursor-pointer w-[100px] [color-scheme:dark]" />
                    {m.target_date && (
                      <span className={`ark-text-xs font-medium whitespace-nowrap ${overdue ? "text-red-400" : isClosed ? "text-[#10b981]" : "text-[#726d6c]"}`}>
                        {isClosed ? "Done" : daysUntil(m.target_date)}
                      </span>
                    )}
                    <select value={m.status_id || ""} onChange={(e) => updateMilestone(m.id, { status_id: e.target.value, title: m.title })} className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-xs text-[#ede8df] focus:outline-none">
                      <option value="">No status</option>
                      {projectStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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

                {/* Expanded: description + tasks */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-[#302927] space-y-3">
                    {/* Editable description */}
                    <div>
                      {editDescId === m.id ? (
                        <div className="space-y-2">
                          <textarea value={editDescValue} onChange={(e) => setEditDescValue(e.target.value)} rows={2} placeholder="Milestone description..." className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y" />
                          <div className="flex gap-2">
                            <button onClick={() => saveDesc(m.id)} className="px-3 py-1 bg-[#843c2d] text-[#ede8df] rounded ark-text-xs">Save</button>
                            <button onClick={() => setEditDescId(null)} className="px-3 py-1 text-[#726d6c] ark-text-xs">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className="ark-text-sm text-[#726d6c] cursor-pointer hover:text-[#ede8df] transition-colors"
                          onClick={() => { setEditDescId(m.id); setEditDescValue(m.description || ""); }}
                        >
                          {m.description || <span className="italic">Click to add description...</span>}
                        </p>
                      )}
                    </div>

                    {/* Tasks in this milestone */}
                    {tasks.length > 0 && (
                      <div className="space-y-1">
                        {tasks.map((t) => {
                          const taskClosed = statuses.find((s) => s.id === t.status_id)?.is_closed === 1;
                          return (
                            <div key={t.id} className="flex items-center gap-2 px-2 py-1.5">
                              <button onClick={() => toggleTaskDone(t)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${taskClosed ? "bg-[#10b981] border-[#10b981]" : "border-[#726d6c] hover:border-[#843c2d]"}`}>
                                {taskClosed && <span className="text-white text-[8px]">✓</span>}
                              </button>
                              <span className={`ark-text-sm ${taskClosed ? "line-through text-[#726d6c]" : "text-[#ede8df]"}`}>{t.title}</span>
                              {t.due_date && <span className="ark-text-xs text-[#726d6c] ml-auto">{new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add task to milestone */}
                    {addTaskMilestoneId === m.id ? (
                      <div className="flex gap-2">
                        <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTaskToMilestone(m.id)} placeholder="Task title..." className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" autoFocus />
                        <button onClick={() => addTaskToMilestone(m.id)} disabled={!newTaskTitle.trim()} className="px-3 py-1 bg-[#843c2d] text-[#ede8df] rounded ark-text-xs disabled:opacity-40">Add</button>
                        <button onClick={() => { setAddTaskMilestoneId(null); setNewTaskTitle(""); }} className="px-2 py-1 text-[#726d6c] ark-text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setAddTaskMilestoneId(m.id)} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df]">+ Add task</button>
                    )}
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
