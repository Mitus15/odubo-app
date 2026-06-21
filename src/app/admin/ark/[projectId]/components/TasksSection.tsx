"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArkTask, ArkStatus, ArkMilestone } from "@/types/ark";

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
  return `${diff}d`;
}

export default function TasksSection({ projectId, statuses }: Props) {
  const [tasks, setTasks] = useState<ArkTask[]>([]);
  const [milestones, setMilestones] = useState<ArkMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [editTask, setEditTask] = useState<ArkTask | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newMilestoneId, setNewMilestoneId] = useState("");

  // Edit modal form
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatusId, setEditStatusId] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editMilestoneId, setEditMilestoneId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editScheduledDate, setEditScheduledDate] = useState("");
  const [editTags, setEditTags] = useState("");

  const taskStatuses = statuses.filter((s) => s.applies_to === "task" || s.applies_to === "all");

  const fetchData = useCallback(async () => {
    try {
      const [taskRes, msRes] = await Promise.all([
        fetch(`/api/admin/ark/${projectId}/tasks`).then((r) => r.json()),
        fetch(`/api/admin/ark/${projectId}/milestones`).then((r) => r.json()),
      ]);
      if (taskRes.success) setTasks(taskRes.tasks || []);
      if (msRes.success) setMilestones(msRes.milestones || []);
    } catch (e) {
      console.error("Failed to fetch:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/admin/ark/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription || undefined,
          due_date: newDueDate || undefined,
          scheduled_date: newScheduledDate || undefined,
          priority: newPriority,
          milestone_id: newMilestoneId || undefined,
        }),
      });
      setNewTitle(""); setNewDescription(""); setNewDueDate(""); setNewScheduledDate(""); setNewPriority("medium"); setNewMilestoneId(""); setShowMore(false);
      fetchData();
    } catch (e) {
      console.error("Failed to add task:", e);
    } finally {
      setAdding(false);
    }
  };

  const updateTask = async (taskId: string, updates: Record<string, unknown>) => {
    try {
      await fetch(`/api/admin/ark/${projectId}/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      fetchData();
    } catch (e) {
      console.error("Failed to update task:", e);
    }
  };

  const deleteTask = async (taskId: string) => {
    await fetch(`/api/admin/ark/${projectId}/tasks/${taskId}`, { method: "DELETE" });
    setConfirmDelete(null);
    setEditTask(null);
    fetchData();
  };

  const openEdit = (task: ArkTask) => {
    setEditTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditStatusId(task.status_id || "");
    setEditPriority(task.priority || "medium");
    setEditMilestoneId(task.milestone_id || "");
    setEditDueDate(task.due_date || "");
    setEditScheduledDate(task.scheduled_date || "");
    setEditTags(task.tags ? JSON.parse(task.tags).join(", ") : "");
  };

  const saveEdit = async () => {
    if (!editTask || !editTitle.trim()) return;
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    await updateTask(editTask.id, {
      title: editTitle.trim(),
      description: editDescription || null,
      status_id: editStatusId || null,
      priority: editPriority,
      milestone_id: editMilestoneId || null,
      due_date: editDueDate || null,
      scheduled_date: editScheduledDate || null,
      tags: tags.length > 0 ? tags : null,
    });
    setEditTask(null);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl ark-list" style={{ gap: 'var(--ark-gap-lg, 16px)' }}>
      {/* Add task */}
      <div className="ark-card bg-[#1a1816] border border-[#302927]">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !showMore && addTask()}
            placeholder="Add a task..."
            className="ark-input flex-1 bg-[#0d0c0a] border border-[#302927] text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
          />
          <button
            onClick={addTask}
            disabled={!newTitle.trim() || adding}
            className="px-4 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm font-medium hover:bg-[#843c2d]/80 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap items-center">
          <div className="flex items-center gap-1">
            <span className="ark-text-xs text-[#726d6c]">Due:</span>
            <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d] [color-scheme:dark]" />
          </div>
          <div className="flex items-center gap-1">
            <span className="ark-text-xs text-[#3b82f6]">Sched:</span>
            <input type="date" value={newScheduledDate} onChange={(e) => setNewScheduledDate(e.target.value)} className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d] [color-scheme:dark]" />
          </div>
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-xs text-[#ede8df] focus:outline-none">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          {milestones.length > 0 && (
            <select value={newMilestoneId} onChange={(e) => setNewMilestoneId(e.target.value)} className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-xs text-[#ede8df] focus:outline-none">
              <option value="">No milestone</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          )}
          <button onClick={() => setShowMore(!showMore)} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df]">
            {showMore ? "Less" : "+ Description"}
          </button>
        </div>
        {showMore && (
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Task description (optional)..."
            rows={2}
            className="w-full mt-2 bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
          />
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 text-[#726d6c]">
          <p className="ark-text-base">No tasks yet. Add your first task above.</p>
        </div>
      ) : (
        <div className="ark-list">
          {tasks.map((task) => {
            const isClosed = statuses.find((s) => s.id === task.status_id)?.is_closed === 1;
            const overdue = isOverdue(task.due_date, isClosed);
            return (
              <div
                key={task.id}
                className={`ark-row flex items-center bg-[#1a1816] border group hover:border-[#843c2d]/30 transition-colors cursor-pointer ${
                  overdue ? "border-red-500/30" : "border-[#302927]"
                }`}
                onClick={() => openEdit(task)}
              >
                {/* Status toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const doneStatus = taskStatuses.find((s) => s.is_closed === 1);
                    const todoStatus = taskStatuses.find((s) => s.is_default === 1) || taskStatuses[0];
                    if (isClosed) {
                      updateTask(task.id, { status_id: todoStatus?.id, completed_date: null });
                    } else if (doneStatus) {
                      updateTask(task.id, { status_id: doneStatus.id, completed_date: new Date().toISOString() });
                    }
                  }}
                  className={`ark-checkbox border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isClosed ? "bg-[#10b981] border-[#10b981]" : "border-[#726d6c] hover:border-[#843c2d]"
                  }`}
                >
                  {isClosed && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className={`ark-text-base ${isClosed ? "line-through text-[#726d6c]" : "text-[#ede8df]"}`}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {task.description && <span className="ark-text-xs text-[#726d6c] truncate max-w-[200px]">{task.description}</span>}
                    {task.milestone_title && <span className="ark-text-xs text-[#843c2d]">{task.milestone_title}</span>}
                    {task.status_name && <span className="ark-text-xs" style={{ color: task.status_color || "#726d6c" }}>{task.status_name}</span>}
                  </div>
                </div>

                {/* Priority */}
                <span className={`ark-text-xs font-medium flex-shrink-0 ${
                  task.priority === "critical" ? "text-red-400" :
                  task.priority === "high" ? "text-amber-400" :
                  task.priority === "low" ? "text-gray-500" : "text-[#726d6c]"
                }`}>
                  {task.priority !== "medium" ? task.priority : ""}
                </span>

                {/* Due date badge */}
                {task.due_date && (
                  <span className={`ark-text-xs font-medium whitespace-nowrap flex-shrink-0 ${overdue ? "text-red-400" : "text-[#726d6c]"}`}>
                    {daysUntil(task.due_date)}
                  </span>
                )}

                {/* Scheduled indicator */}
                {task.scheduled_date && (
                  <span className="ark-text-xs text-[#3b82f6] flex-shrink-0" title={`Scheduled: ${task.scheduled_date}`}>
                    S
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditTask(null)}>
          <div className="bg-[#1a1816] border border-[#302927] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#302927]">
              <h3 className="ark-text-lg font-medium text-[#ede8df]">Edit Task</h3>
              <button onClick={() => setEditTask(null)} className="text-[#726d6c] hover:text-[#ede8df]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block ark-text-xs text-[#726d6c] mb-1">Title</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="ark-input w-full bg-[#0d0c0a] border border-[#302927] text-[#ede8df] focus:outline-none focus:border-[#843c2d]" />
              </div>

              <div>
                <label className="block ark-text-xs text-[#726d6c] mb-1">Description</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} placeholder="Add details, notes, context..." className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block ark-text-xs text-[#726d6c] mb-1">Status</label>
                  <select value={editStatusId} onChange={(e) => setEditStatusId(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none">
                    {taskStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block ark-text-xs text-[#726d6c] mb-1">Priority</label>
                  <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {milestones.length > 0 && (
                <div>
                  <label className="block ark-text-xs text-[#726d6c] mb-1">Milestone</label>
                  <select value={editMilestoneId} onChange={(e) => setEditMilestoneId(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none">
                    <option value="">No milestone</option>
                    {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block ark-text-xs text-[#726d6c] mb-1">Due Date</label>
                  <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block ark-text-xs text-[#3b82f6] mb-1">Scheduled Date</label>
                  <input type="date" value={editScheduledDate} onChange={(e) => setEditScheduledDate(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="block ark-text-xs text-[#726d6c] mb-1">Tags</label>
                <input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="design, urgent, review (comma separated)" className="ark-input w-full bg-[#0d0c0a] border border-[#302927] text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-[#302927]">
              {/* Delete */}
              <div>
                {confirmDelete === editTask.id ? (
                  <div className="flex items-center gap-2">
                    <span className="ark-text-xs text-red-400">Delete this task?</span>
                    <button onClick={() => deleteTask(editTask.id)} className="px-3 py-1 bg-red-500 text-white rounded ark-text-xs">Yes</button>
                    <button onClick={() => setConfirmDelete(null)} className="px-3 py-1 text-[#726d6c] ark-text-xs">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(editTask.id)} className="ark-text-xs text-red-400 hover:text-red-300">Delete</button>
                )}
              </div>
              {/* Save */}
              <div className="flex gap-2">
                <button onClick={() => setEditTask(null)} className="px-4 py-2 ark-text-sm text-[#726d6c] hover:text-[#ede8df]">Cancel</button>
                <button onClick={saveEdit} disabled={!editTitle.trim()} className="px-5 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm font-medium hover:bg-[#843c2d]/80 disabled:opacity-40">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
