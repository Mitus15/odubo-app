"use client";

import { useEffect, useState, useCallback, DragEvent } from "react";
import Link from "next/link";
import { ArkDensityProvider, DensityToggle } from "../ArkDensityContext";

type ViewMode = "day" | "week" | "month";

interface CalendarTask {
  id: string;
  title: string;
  project_id: string;
  project_title: string;
  project_color: string | null;
  project_icon: string | null;
  category_name: string | null;
  category_color: string | null;
  status_name: string | null;
  status_color: string | null;
  status_is_closed: number | null;
  priority: string;
  due_date: string | null;
  scheduled_date: string | null;
  milestone_title: string | null;
}

interface CalendarMilestone {
  id: string;
  title: string;
  project_id: string;
  project_title: string;
  project_color: string | null;
  project_icon: string | null;
  target_date: string | null;
  status_is_closed: number | null;
}

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function isToday(d: string): boolean {
  return d === dateStr(new Date());
}

function isPast(d: string): boolean {
  return d < dateStr(new Date());
}

export default function ArkCalendarClient() {
  return (
    <ArkDensityProvider>
      <ArkCalendarInner />
    </ArkDensityProvider>
  );
}

function ArkCalendarInner() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [milestones, setMilestones] = useState<CalendarMilestone[]>([]);
  const [backlog, setBacklog] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBacklog, setShowBacklog] = useState(true);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const getDateRange = useCallback((): { start: string; end: string } => {
    if (viewMode === "day") {
      return { start: dateStr(currentDate), end: dateStr(currentDate) };
    } else if (viewMode === "week") {
      const s = startOfWeek(currentDate);
      return { start: dateStr(s), end: dateStr(addDays(s, 6)) };
    } else {
      const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { start: dateStr(s), end: dateStr(e) };
    }
  }, [viewMode, currentDate]);

  const fetchData = useCallback(async () => {
    try {
      const { start, end } = getDateRange();
      const res = await fetch(`/api/admin/ark/calendar?start=${start}&end=${end}`).then((r) => r.json());
      if (res.success) {
        setTasks(res.tasks || []);
        setMilestones(res.milestones || []);
        setBacklog(res.backlog || []);
      }
    } catch (e) {
      console.error("Failed to fetch calendar:", e);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  const scheduleTask = async (taskId: string, date: string) => {
    await fetch("/api/admin/ark/calendar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ task_id: taskId, scheduled_date: date }] }),
    });
    fetchData();
  };

  const unscheduleTask = async (taskId: string) => {
    await fetch("/api/admin/ark/calendar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ task_id: taskId, scheduled_date: null }] }),
    });
    fetchData();
  };

  const toggleTaskDone = async (task: CalendarTask) => {
    const isClosed = task.status_is_closed === 1;
    // Get statuses to find done/todo
    const statusRes = await fetch("/api/admin/ark/statuses?applies_to=task").then((r) => r.json());
    const sts = statusRes.statuses || [];
    const targetStatus = isClosed
      ? sts.find((s: { is_default: number }) => s.is_default === 1) || sts[0]
      : sts.find((s: { is_closed: number }) => s.is_closed === 1);
    if (targetStatus) {
      await fetch(`/api/admin/ark/${task.project_id}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_id: targetStatus.id }),
      });
      fetchData();
    }
  };

  // Drag handlers
  const handleDragStart = (e: DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent, date: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || dragTaskId;
    if (taskId) {
      scheduleTask(taskId, date);
    }
    setDragTaskId(null);
  };

  // Navigation
  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  // Get tasks for a specific date
  const tasksForDate = (date: string) =>
    tasks.filter((t) => t.scheduled_date === date || (!t.scheduled_date && t.due_date === date));

  const milestonesForDate = (date: string) =>
    milestones.filter((m) => m.target_date === date);

  // Generate dates for views
  const weekDates = (() => {
    const s = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => dateStr(addDays(s, i)));
  })();

  const monthDates = (() => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startPad = firstDay.getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const dates: string[] = [];
    // Pad start
    for (let i = startPad - 1; i >= 0; i--) dates.push(dateStr(addDays(firstDay, -i - 1)));
    // Month days
    for (let i = 0; i < daysInMonth; i++) dates.push(dateStr(addDays(firstDay, i)));
    // Pad end to fill 6 rows
    while (dates.length < 42) dates.push(dateStr(addDays(firstDay, dates.length - startPad)));
    return dates;
  })();

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthName = currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekLabel = `${new Date(weekDates[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${new Date(weekDates[6]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df] flex">
      {/* Main calendar */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-[#302927] px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/admin/ark" className="text-[#726d6c] hover:text-[#ede8df]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              </Link>
              <h1 className="text-xl font-semibold">Planner</h1>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-1.5 text-[#726d6c] hover:text-[#ede8df]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              </button>
              <button onClick={goToday} className="px-3 py-1 text-xs font-medium text-[#ede8df] bg-[#302927] rounded-lg hover:bg-[#302927]/70">Today</button>
              <button onClick={() => navigate(1)} className="p-1.5 text-[#726d6c] hover:text-[#ede8df]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
              <span className="text-sm text-[#ede8df] font-medium min-w-[160px] text-center">
                {viewMode === "week" ? weekLabel : viewMode === "day" ? currentDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : monthName}
              </span>

              <div className="flex bg-[#1a1816] border border-[#302927] rounded-lg overflow-hidden ml-2">
                {(["day", "week", "month"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize ${viewMode === m ? "bg-[#843c2d] text-[#ede8df]" : "text-[#726d6c] hover:text-[#ede8df]"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowBacklog(!showBacklog)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${showBacklog ? "border-[#843c2d] text-[#843c2d]" : "border-[#302927] text-[#726d6c]"}`}
              >
                Backlog
              </button>

              <DensityToggle />
            </div>
          </div>
        </div>

        {/* Calendar content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>
          ) : viewMode === "week" ? (
            /* WEEK VIEW */
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date) => {
                const dayTasks = tasksForDate(date);
                const dayMilestones = milestonesForDate(date);
                const today = isToday(date);
                const past = isPast(date) && !today;
                return (
                  <div
                    key={date}
                    className={`min-h-[200px] rounded-lg border p-2 transition-colors ${
                      today ? "border-[#843c2d] bg-[#843c2d]/5" : past ? "border-[#302927]/50 bg-[#0d0c0a]" : "border-[#302927]"
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date)}
                  >
                    <div className={`text-xs font-medium mb-2 ${today ? "text-[#843c2d]" : past ? "text-[#726d6c]/50" : "text-[#726d6c]"}`}>
                      {dayNames[new Date(date + "T12:00:00").getDay()]}
                      <span className={`ml-1 ${today ? "bg-[#843c2d] text-white px-1.5 py-0.5 rounded-full" : ""}`}>
                        {new Date(date + "T12:00:00").getDate()}
                      </span>
                    </div>
                    {/* Milestones */}
                    {dayMilestones.map((m) => (
                      <div key={m.id} className="mb-1 px-2 py-1 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[10px]">
                        <span className="text-[#f59e0b]">🏁</span> <span className="text-[#ede8df]">{m.title}</span>
                        <span className="text-[#726d6c] block truncate">{m.project_title}</span>
                      </div>
                    ))}
                    {/* Tasks */}
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.id)}
                        className={`mb-1 px-2 py-1.5 rounded border text-[10px] cursor-grab active:cursor-grabbing transition-colors ${
                          t.status_is_closed === 1 ? "opacity-50 border-[#302927]" : "border-[#302927] hover:border-[#843c2d]/30"
                        }`}
                        style={{ borderLeftColor: t.category_color || t.project_color || "#843c2d", borderLeftWidth: "3px" }}
                      >
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleTaskDone(t)} className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${t.status_is_closed === 1 ? "bg-[#10b981] border-[#10b981]" : "border-[#726d6c]"}`}>
                            {t.status_is_closed === 1 && <span className="text-white text-[8px]">✓</span>}
                          </button>
                          <span className={`truncate ${t.status_is_closed === 1 ? "line-through text-[#726d6c]" : "text-[#ede8df]"}`}>{t.title}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {t.project_icon && <span className="text-[8px]">{t.project_icon}</span>}
                          <span className="text-[#726d6c] truncate">{t.project_title}</span>
                          {t.priority === "critical" && <span className="text-red-400">!</span>}
                          {t.priority === "high" && <span className="text-amber-400">!</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : viewMode === "day" ? (
            /* DAY VIEW */
            <div className="max-w-2xl mx-auto space-y-2"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, dateStr(currentDate))}
            >
              {milestonesForDate(dateStr(currentDate)).map((m) => (
                <div key={m.id} className="px-4 py-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center gap-2">
                  <span>🏁</span>
                  <span className="text-sm font-medium text-[#ede8df]">{m.title}</span>
                  <span className="text-xs text-[#726d6c]">— {m.project_title}</span>
                </div>
              ))}
              {tasksForDate(dateStr(currentDate)).length === 0 && milestonesForDate(dateStr(currentDate)).length === 0 ? (
                <div className="text-center py-16 text-[#726d6c]">
                  <p className="text-sm">Nothing scheduled for today.</p>
                  <p className="text-xs mt-1">Drag tasks from the backlog to schedule them.</p>
                </div>
              ) : (
                tasksForDate(dateStr(currentDate)).map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    className="flex items-center gap-3 bg-[#1a1816] border border-[#302927] rounded-lg px-4 py-3 cursor-grab active:cursor-grabbing"
                    style={{ borderLeftColor: t.category_color || t.project_color || "#843c2d", borderLeftWidth: "4px" }}
                  >
                    <button onClick={() => toggleTaskDone(t)} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${t.status_is_closed === 1 ? "bg-[#10b981] border-[#10b981]" : "border-[#726d6c] hover:border-[#843c2d]"}`}>
                      {t.status_is_closed === 1 && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${t.status_is_closed === 1 ? "line-through text-[#726d6c]" : "text-[#ede8df]"}`}>{t.title}</span>
                      <div className="flex items-center gap-2 text-[10px] text-[#726d6c] mt-0.5">
                        {t.project_icon && <span>{t.project_icon}</span>}
                        <span>{t.project_title}</span>
                        {t.due_date && <span>Due {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                      </div>
                    </div>
                    {t.priority !== "medium" && (
                      <span className={`text-xs font-medium ${t.priority === "critical" ? "text-red-400" : t.priority === "high" ? "text-amber-400" : "text-gray-500"}`}>{t.priority}</span>
                    )}
                    <button onClick={() => unscheduleTask(t.id)} className="text-[#726d6c] hover:text-red-400 text-xs" title="Unschedule">✕</button>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* MONTH VIEW */
            <div>
              <div className="grid grid-cols-7 gap-px mb-1">
                {dayNames.map((d) => (
                  <div key={d} className="text-center text-xs text-[#726d6c] py-1 font-medium">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {monthDates.map((date) => {
                  const dayTasks = tasksForDate(date);
                  const dayMilestones = milestonesForDate(date);
                  const inMonth = new Date(date + "T12:00:00").getMonth() === currentDate.getMonth();
                  const today = isToday(date);
                  return (
                    <div
                      key={date}
                      className={`min-h-[80px] border rounded p-1 transition-colors ${
                        today ? "border-[#843c2d] bg-[#843c2d]/5" : inMonth ? "border-[#302927]" : "border-[#302927]/30 opacity-40"
                      }`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, date)}
                    >
                      <div className={`text-[10px] mb-0.5 ${today ? "text-[#843c2d] font-bold" : "text-[#726d6c]"}`}>
                        {new Date(date + "T12:00:00").getDate()}
                      </div>
                      {dayMilestones.map((m) => (
                        <div key={m.id} className="w-full h-1 bg-[#f59e0b] rounded mb-0.5" title={`🏁 ${m.title}`} />
                      ))}
                      {dayTasks.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          className="w-full rounded px-1 py-0.5 text-[8px] truncate mb-0.5 cursor-grab"
                          style={{ backgroundColor: `${t.category_color || t.project_color || "#843c2d"}20`, color: t.category_color || t.project_color || "#ede8df" }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, t.id)}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[8px] text-[#726d6c]">+{dayTasks.length - 3} more</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backlog sidebar */}
      {showBacklog && (
        <div className="w-72 border-l border-[#302927] bg-[#0d0c0a] flex flex-col">
          <div className="px-4 py-3 border-b border-[#302927]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#ede8df]">Backlog</h3>
              <span className="text-[10px] text-[#726d6c]">{backlog.length} tasks</span>
            </div>
            <p className="text-[10px] text-[#726d6c] mt-0.5">Drag onto calendar to schedule</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {backlog.length === 0 ? (
              <div className="text-center py-8 text-[#726d6c] text-xs">All tasks are scheduled!</div>
            ) : (
              backlog.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, t.id)}
                  className="px-3 py-2 rounded-lg border border-[#302927] cursor-grab active:cursor-grabbing hover:border-[#843c2d]/30 transition-colors"
                  style={{ borderLeftColor: t.category_color || t.project_color || "#843c2d", borderLeftWidth: "3px" }}
                >
                  <div className="text-xs text-[#ede8df] truncate">{t.title}</div>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[#726d6c]">
                    {t.project_icon && <span>{t.project_icon}</span>}
                    <span className="truncate">{t.project_title}</span>
                  </div>
                  {t.due_date && (
                    <div className={`text-[10px] mt-0.5 ${isPast(t.due_date) ? "text-red-400" : "text-[#726d6c]"}`}>
                      Due {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  )}
                  {t.priority !== "medium" && (
                    <span className={`text-[10px] ${t.priority === "critical" ? "text-red-400" : t.priority === "high" ? "text-amber-400" : "text-gray-500"}`}>{t.priority}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
