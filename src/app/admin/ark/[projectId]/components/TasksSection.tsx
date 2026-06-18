"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArkTask, ArkStatus } from "@/types/ark";

interface Props {
  projectId: string;
  statuses: ArkStatus[];
}

function isOverdue(dateStr: string | null, isClosed: boolean): boolean {
  if (!dateStr || isClosed) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [adding, setAdding] = useState(false);

  const taskStatuses = statuses.filter((s) => s.applies_to === "task" || s.applies_to === "all");

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ark/${projectId}/tasks`).then((r) => r.json());
      if (res.success) setTasks(res.tasks || []);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/ark/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          due_date: newDueDate || undefined,
          scheduled_date: newScheduledDate || undefined,
          priority: newPriority,
        }),
      }).then((r) => r.json());
      if (res.success) {
        setNewTitle("");
        setNewDueDate("");
        setNewScheduledDate("");
        setNewPriority("medium");
        fetchTasks();
      }
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
      fetchTasks();
    } catch (e) {
      console.error("Failed to update task:", e);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/admin/ark/${projectId}/tasks/${taskId}`, { method: "DELETE" });
      fetchTasks();
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
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
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add a task..."
            className="ark-input flex-1 bg-[#0d0c0a] border border-[#302927] text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
          />
          <button
            onClick={addTask}
            disabled={!newTitle.trim() || adding}
            className="px-4 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#726d6c]">Due:</span>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d] [color-scheme:dark]"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#3b82f6]">Scheduled:</span>
            <input
              type="date"
              value={newScheduledDate}
              onChange={(e) => setNewScheduledDate(e.target.value)}
              className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d] [color-scheme:dark]"
            />
          </div>
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 text-xs text-[#ede8df] focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
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
                className={`ark-row flex items-center bg-[#1a1816] border group hover:border-[#843c2d]/30 transition-colors ${
                  overdue ? "border-red-500/30" : "border-[#302927]"
                }`}
              >
                {/* Status toggle */}
                <button
                  onClick={() => {
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
                    {task.status_name && (
                      <span className="text-[10px]" style={{ color: task.status_color || "#726d6c" }}>{task.status_name}</span>
                    )}
                    {task.milestone_title && (
                      <span className="text-[10px] text-[#726d6c]">{task.milestone_title}</span>
                    )}
                  </div>
                </div>

                {/* Priority selector */}
                <select
                  value={task.priority || "medium"}
                  onChange={(e) => updateTask(task.id, { priority: e.target.value })}
                  className={`bg-transparent border-none text-[10px] font-medium focus:outline-none cursor-pointer ${
                    task.priority === "critical" ? "text-red-400" :
                    task.priority === "high" ? "text-amber-400" :
                    task.priority === "low" ? "text-gray-500" : "text-[#726d6c]"
                  }`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Med</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>

                {/* Scheduled date */}
                <div className="flex items-center gap-1 flex-shrink-0" title="Scheduled: when you plan to work on it">
                  <span className="text-[8px] text-[#3b82f6]">S</span>
                  <input
                    type="date"
                    value={task.scheduled_date || ""}
                    onChange={(e) => updateTask(task.id, { scheduled_date: e.target.value || null })}
                    className="bg-transparent border-none text-[10px] text-[#3b82f6] focus:outline-none cursor-pointer w-[100px] [color-scheme:dark]"
                  />
                </div>

                {/* Due date */}
                <div className="flex items-center gap-1 flex-shrink-0" title="Due: the deadline">
                  <span className="text-[8px] text-[#726d6c]">D</span>
                  <input
                    type="date"
                    value={task.due_date || ""}
                    onChange={(e) => updateTask(task.id, { due_date: e.target.value || null })}
                    className="bg-transparent border-none text-[10px] text-[#726d6c] focus:outline-none cursor-pointer w-[100px] [color-scheme:dark]"
                  />
                  {task.due_date && (
                    <span className={`text-[10px] font-medium whitespace-nowrap ${overdue ? "text-red-400" : "text-[#726d6c]"}`}>
                      {daysUntil(task.due_date)}
                    </span>
                  )}
                </div>

                {/* Status select */}
                <select
                  value={task.status_id || ""}
                  onChange={(e) => updateTask(task.id, { status_id: e.target.value })}
                  className="bg-transparent border-none text-[10px] text-[#726d6c] focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {taskStatuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                {/* Delete */}
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
