"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BriefingTask {
  id: string; title: string; project_id: string; project_title: string; project_icon: string | null;
  project_color: string | null; category_color: string | null; priority: string;
  due_date: string | null; scheduled_date: string | null;
  status_name: string | null; status_color: string | null; status_is_closed: number | null;
}

interface BriefingProject {
  id: string; title: string; icon: string | null; color: string | null;
  category_name: string | null; category_color: string | null;
  status_name: string | null; status_color: string | null;
  task_count: number; task_done_count: number; progress_percent: number;
  next_due_task: string | null; next_due_date: string | null; last_activity: string | null;
}

interface Briefing {
  today_tasks: BriefingTask[];
  overdue_tasks: BriefingTask[];
  upcoming_tasks: BriefingTask[];
  upcoming_milestones: Array<{ id: string; title: string; project_title: string; project_icon: string | null; target_date: string }>;
  active_projects: BriefingProject[];
  week_completed: number;
  is_friday: boolean;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateFull(): string {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function daysUntil(d: string): string {
  const diff = Math.ceil((new Date(d).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `in ${diff}d`;
}

export default function ArkTab() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ark/briefing")
      .then((r) => r.json())
      .then((data) => { if (data.success) setBriefing(data.briefing); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleTask = async (task: BriefingTask) => {
    const isClosed = task.status_is_closed === 1;
    const statusRes = await fetch("/api/admin/ark/statuses?applies_to=task").then((r) => r.json());
    const sts = statusRes.statuses || [];
    const target = isClosed
      ? sts.find((s: { is_default: number }) => s.is_default === 1)
      : sts.find((s: { is_closed: number }) => s.is_closed === 1);
    if (target) {
      await fetch(`/api/admin/ark/${task.project_id}/tasks/${task.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_id: target.id }),
      });
      // Refresh
      const data = await fetch("/api/admin/ark/briefing").then((r) => r.json());
      if (data.success) setBriefing(data.briefing);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  if (!briefing) return null;

  const hasContent = briefing.today_tasks.length > 0 || briefing.overdue_tasks.length > 0 || briefing.active_projects.length > 0;

  return (
    <div className="space-y-6 p-4 max-w-3xl">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold text-[#ede8df]">{getGreeting()}.</h2>
        <p className="text-sm text-[#726d6c] mt-1">{formatDateFull()}</p>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-[#ede8df] font-bold">{briefing.today_tasks.filter(t => t.status_is_closed !== 1).length}</span>
          <span className="text-[#726d6c]">today</span>
        </div>
        {briefing.overdue_tasks.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-red-400 font-bold">{briefing.overdue_tasks.length}</span>
            <span className="text-[#726d6c]">overdue</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-[#10b981] font-bold">{briefing.week_completed}</span>
          <span className="text-[#726d6c]">done this week</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-[#ede8df] font-bold">{briefing.active_projects.length}</span>
          <span className="text-[#726d6c]">active projects</span>
        </div>
      </div>

      {/* Friday Review Prompt */}
      {briefing.is_friday && (
        <Link href="/admin/ark/review" className="block bg-[#843c2d]/10 border border-[#843c2d]/30 rounded-lg p-4 hover:bg-[#843c2d]/15 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <p className="text-sm font-medium text-[#ede8df]">Time for your weekly review</p>
              <p className="text-xs text-[#726d6c]">Reflect on this week and plan the next one</p>
            </div>
          </div>
        </Link>
      )}

      {/* Overdue Tasks */}
      {briefing.overdue_tasks.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">Overdue</h3>
          <div className="space-y-1">
            {briefing.overdue_tasks.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggleTask} overdue />
            ))}
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div>
        <h3 className="text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">Today</h3>
        {briefing.today_tasks.length === 0 ? (
          <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-4 text-center">
            <p className="text-sm text-[#726d6c]">Nothing scheduled for today.</p>
            <Link href="/admin/ark/calendar" className="text-xs text-[#843c2d] hover:text-[#ede8df] mt-1 inline-block">Open Planner to schedule tasks</Link>
          </div>
        ) : (
          <div className="space-y-1">
            {briefing.today_tasks.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggleTask} />
            ))}
          </div>
        )}
      </div>

      {/* Coming Up */}
      {(briefing.upcoming_tasks.length > 0 || briefing.upcoming_milestones.length > 0) && (
        <div>
          <h3 className="text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">Coming Up</h3>
          <div className="space-y-1">
            {briefing.upcoming_milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-2 bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2">
                <span className="text-sm">🏁</span>
                <span className="text-sm text-[#ede8df] truncate flex-1">{m.title}</span>
                <span className="text-[10px] text-[#726d6c]">{m.project_icon} {m.project_title}</span>
                <span className="text-[10px] text-[#f59e0b]">{daysUntil(m.target_date)}</span>
              </div>
            ))}
            {briefing.upcoming_tasks.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggleTask} showDate />
            ))}
          </div>
        </div>
      )}

      {/* Active Projects Pulse */}
      {briefing.active_projects.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">Projects</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {briefing.active_projects.map((p) => {
              const pct = p.task_count > 0 ? Math.round((p.task_done_count / p.task_count) * 100) : p.progress_percent;
              return (
                <Link
                  key={p.id}
                  href={`/admin/ark/${p.id}`}
                  className="bg-[#1a1816] border border-[#302927] rounded-lg p-3 hover:border-[#843c2d]/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {p.icon && <span className="text-lg">{p.icon}</span>}
                    <span className="text-sm font-medium text-[#ede8df] truncate">{p.title}</span>
                  </div>
                  {pct > 0 && (
                    <div className="h-1 bg-[#302927] rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-[#843c2d] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-[#726d6c]">
                    <span>{p.task_done_count}/{p.task_count} tasks</span>
                    {p.next_due_task && (
                      <span className="truncate ml-2">Next: {p.next_due_task}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🚀</div>
          <p className="text-[#ede8df] font-medium">The Ark is ready</p>
          <p className="text-sm text-[#726d6c] mt-1">Create your first project to get started</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 pt-2">
        <Link href="/admin/ark" className="flex-1 text-center px-4 py-2.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 transition-colors">
          Open The Ark
        </Link>
        <Link href="/admin/ark/calendar" className="flex-1 text-center px-4 py-2.5 border border-[#302927] text-[#ede8df] rounded-lg text-sm font-medium hover:border-[#843c2d]/50 transition-colors">
          Planner
        </Link>
      </div>
    </div>
  );
}

function TaskRow({ task: t, onToggle, overdue, showDate }: { task: BriefingTask; onToggle: (t: BriefingTask) => void; overdue?: boolean; showDate?: boolean }) {
  const isClosed = t.status_is_closed === 1;
  return (
    <div
      className={`flex items-center gap-2.5 bg-[#1a1816] border rounded-lg px-3 py-2.5 ${overdue ? "border-red-500/20" : "border-[#302927]"}`}
      style={{ borderLeftColor: t.category_color || t.project_color || "#843c2d", borderLeftWidth: "3px" }}
    >
      <button
        onClick={() => onToggle(t)}
        className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isClosed ? "bg-[#10b981] border-[#10b981]" : "border-[#726d6c] hover:border-[#843c2d]"
        }`}
        style={{ width: 18, height: 18 }}
      >
        {isClosed && <span className="text-white text-[9px]">✓</span>}
      </button>
      <span className={`text-sm truncate flex-1 ${isClosed ? "line-through text-[#726d6c]" : "text-[#ede8df]"}`}>{t.title}</span>
      <span className="text-[10px] text-[#726d6c] flex-shrink-0 hidden sm:inline">
        {t.project_icon ? `${t.project_icon} ` : ""}{t.project_title}
      </span>
      {t.priority === "critical" && <span className="text-[10px] text-red-400 flex-shrink-0">critical</span>}
      {t.priority === "high" && <span className="text-[10px] text-amber-400 flex-shrink-0">high</span>}
      {showDate && (t.scheduled_date || t.due_date) && (
        <span className="text-[10px] text-[#726d6c] flex-shrink-0">{daysUntil((t.scheduled_date || t.due_date)!)}</span>
      )}
      {overdue && t.due_date && (
        <span className="text-[10px] text-red-400 flex-shrink-0">{daysUntil(t.due_date)}</span>
      )}
    </div>
  );
}
