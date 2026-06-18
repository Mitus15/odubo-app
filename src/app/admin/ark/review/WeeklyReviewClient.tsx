"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ReviewData {
  completed_tasks: Array<{ title: string; project_title: string; project_icon: string | null }>;
  milestones_reached: Array<{ title: string; project_title: string; project_icon: string | null }>;
  overdue_tasks: Array<{ id: string; title: string; due_date: string; project_title: string; project_icon: string | null }>;
  blocked_tasks: Array<{ id: string; title: string; project_title: string; project_icon: string | null }>;
  stale_projects: Array<{ id: string; title: string; icon: string | null; last_activity: string | null }>;
}

const MOODS = [
  { value: "great", icon: "🔥", label: "Great" },
  { value: "good", icon: "😊", label: "Good" },
  { value: "okay", icon: "😐", label: "Okay" },
  { value: "rough", icon: "😓", label: "Rough" },
  { value: "terrible", icon: "💀", label: "Terrible" },
];

export default function WeeklyReviewClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weekRange, setWeekRange] = useState({ start: "", end: "" });
  const [data, setData] = useState<ReviewData | null>(null);

  // Review form state
  const [extraAccomplishments, setExtraAccomplishments] = useState("");
  const [blockerNotes, setBlockerNotes] = useState("");
  const [reflections, setReflections] = useState("");
  const [mood, setMood] = useState("");
  const [nextWeekFocus, setNextWeekFocus] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ark/review").then((r) => r.json());
      if (res.success) {
        setData(res.data);
        setWeekRange(res.week);
      }
    } catch (e) {
      console.error("Failed to fetch review data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveReview = async () => {
    setSaving(true);
    try {
      const allAccomplishments = [
        ...(data?.completed_tasks.map((t) => `${t.project_icon || ""} ${t.title} (${t.project_title})`) || []),
        ...(data?.milestones_reached.map((m) => `🏁 ${m.title} (${m.project_title})`) || []),
        ...extraAccomplishments.split("\n").filter(Boolean),
      ];

      const allBlockers = [
        ...(data?.overdue_tasks.map((t) => `Overdue: ${t.title} (${t.project_title})`) || []),
        ...(data?.blocked_tasks.map((t) => `Blocked: ${t.title} (${t.project_title})`) || []),
        ...blockerNotes.split("\n").filter(Boolean),
      ];

      const focus = nextWeekFocus.split("\n").filter(Boolean);

      await fetch("/api/admin/ark/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: weekRange.start,
          week_end: weekRange.end,
          accomplishments: allAccomplishments,
          blockers: allBlockers,
          reflections,
          next_week_focus: focus,
          mood: mood || undefined,
        }),
      });

      router.push("/admin/ark");
    } catch (e) {
      console.error("Failed to save review:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  const totalCompleted = (data?.completed_tasks.length || 0) + (data?.milestones_reached.length || 0);
  const totalStuck = (data?.overdue_tasks.length || 0) + (data?.blocked_tasks.length || 0);

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      {/* Header */}
      <div className="border-b border-[#302927] px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/ark" className="text-[#726d6c] hover:text-[#ede8df]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Weekly Review</h1>
            <p className="text-xs text-[#726d6c]">
              {new Date(weekRange.start + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} — {new Date(weekRange.end + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(s)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s ? "bg-[#843c2d] text-[#ede8df]" : step > s ? "bg-[#843c2d]/30 text-[#843c2d]" : "bg-[#1a1816] text-[#726d6c] border border-[#302927]"
                }`}
              >
                {step > s ? "✓" : s}
              </button>
              {s < 4 && <div className={`w-8 h-0.5 ${step > s ? "bg-[#843c2d]" : "bg-[#302927]"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: What Got Done */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[#ede8df] mb-1">What Got Done</h2>
              <p className="text-sm text-[#726d6c]">You completed <span className="text-[#10b981] font-bold">{totalCompleted}</span> items this week.</p>
            </div>

            {data?.completed_tasks && data.completed_tasks.length > 0 && (
              <div className="space-y-1">
                {data.completed_tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2">
                    <span className="text-[#10b981]">✓</span>
                    <span className="text-sm text-[#ede8df] flex-1 truncate">{t.title}</span>
                    <span className="text-[10px] text-[#726d6c]">{t.project_icon} {t.project_title}</span>
                  </div>
                ))}
              </div>
            )}

            {data?.milestones_reached && data.milestones_reached.length > 0 && (
              <div className="space-y-1">
                {data.milestones_reached.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-lg px-3 py-2">
                    <span>🏁</span>
                    <span className="text-sm text-[#ede8df] flex-1">{m.title}</span>
                    <span className="text-[10px] text-[#726d6c]">{m.project_icon} {m.project_title}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs text-[#726d6c] mb-1">Anything else you accomplished?</label>
              <textarea
                value={extraAccomplishments}
                onChange={(e) => setExtraAccomplishments(e.target.value)}
                placeholder="One per line — wins not captured as tasks..."
                rows={3}
                className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
              />
            </div>
          </div>
        )}

        {/* Step 2: What's Stuck */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[#ede8df] mb-1">What&apos;s Stuck</h2>
              <p className="text-sm text-[#726d6c]">
                {totalStuck > 0 ? <><span className="text-red-400 font-bold">{totalStuck}</span> items need attention.</> : "Nothing stuck — great work!"}
              </p>
            </div>

            {data?.overdue_tasks && data.overdue_tasks.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">Overdue</h3>
                <div className="space-y-1">
                  {data.overdue_tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 bg-[#1a1816] border border-red-500/20 rounded-lg px-3 py-2">
                      <span className="text-red-400 text-xs">!</span>
                      <span className="text-sm text-[#ede8df] flex-1 truncate">{t.title}</span>
                      <span className="text-[10px] text-[#726d6c]">{t.project_icon} {t.project_title}</span>
                      <span className="text-[10px] text-red-400">{new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data?.blocked_tasks && data.blocked_tasks.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Blocked</h3>
                <div className="space-y-1">
                  {data.blocked_tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 bg-[#1a1816] border border-amber-500/20 rounded-lg px-3 py-2">
                      <span className="text-amber-400 text-xs">⊘</span>
                      <span className="text-sm text-[#ede8df] flex-1 truncate">{t.title}</span>
                      <span className="text-[10px] text-[#726d6c]">{t.project_icon} {t.project_title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data?.stale_projects && data.stale_projects.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">No Activity This Week</h3>
                <div className="space-y-1">
                  {data.stale_projects.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2">
                      {p.icon && <span>{p.icon}</span>}
                      <span className="text-sm text-[#ede8df] flex-1">{p.title}</span>
                      <span className="text-[10px] text-[#726d6c]">
                        {p.last_activity ? `Last: ${new Date(p.last_activity).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Never"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-[#726d6c] mb-1">What&apos;s blocking you?</label>
              <textarea
                value={blockerNotes}
                onChange={(e) => setBlockerNotes(e.target.value)}
                placeholder="Describe what's in the way..."
                rows={3}
                className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
              />
            </div>
          </div>
        )}

        {/* Step 3: Reflect */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[#ede8df] mb-1">Reflect</h2>
              <p className="text-sm text-[#726d6c]">How did this week go?</p>
            </div>

            <div>
              <label className="block text-xs text-[#726d6c] mb-2">How are you feeling?</label>
              <div className="flex gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMood(mood === m.value ? "" : m.value)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-colors ${
                      mood === m.value ? "border-[#843c2d] bg-[#843c2d]/10" : "border-[#302927] hover:border-[#726d6c]"
                    }`}
                  >
                    <span className="text-2xl">{m.icon}</span>
                    <span className="text-[10px] text-[#726d6c]">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#726d6c] mb-1">Your reflections</label>
              <textarea
                value={reflections}
                onChange={(e) => setReflections(e.target.value)}
                placeholder="What did you learn? What went well? What would you change?"
                rows={6}
                className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
              />
            </div>
          </div>
        )}

        {/* Step 4: Plan Next Week */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[#ede8df] mb-1">Plan Next Week</h2>
              <p className="text-sm text-[#726d6c]">What will you focus on?</p>
            </div>

            <div>
              <label className="block text-xs text-[#726d6c] mb-1">Focus areas for next week</label>
              <textarea
                value={nextWeekFocus}
                onChange={(e) => setNextWeekFocus(e.target.value)}
                placeholder={"Ship the album cover\nApply to 5 jobs\nFinish migration paperwork\nComplete The Ark v2"}
                rows={5}
                className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
              />
              <p className="text-[10px] text-[#726d6c] mt-1">One focus per line. These will be your north stars for next week.</p>
            </div>

            {/* Summary */}
            <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-4">
              <h3 className="text-sm font-medium text-[#726d6c] mb-2">Review Summary</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-[#10b981]">{totalCompleted}</div>
                  <div className="text-[10px] text-[#726d6c]">Completed</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-400">{totalStuck}</div>
                  <div className="text-[10px] text-[#726d6c]">Stuck</div>
                </div>
                <div>
                  <div className="text-xl">{MOODS.find((m) => m.value === mood)?.icon || "—"}</div>
                  <div className="text-[10px] text-[#726d6c]">Mood</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#302927]">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : router.back()}
            className="px-4 py-2 text-sm text-[#726d6c] hover:text-[#ede8df]"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={saveReview}
              disabled={saving}
              className="px-6 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Review"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
