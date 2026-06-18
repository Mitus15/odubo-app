"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArkCategory, ArkStatus, ArkIntegration } from "@/types/ark";

export default function CreateProjectClient() {
  const router = useRouter();
  const [categories, setCategories] = useState<ArkCategory[]>([]);
  const [statuses, setStatuses] = useState<ArkStatus[]>([]);
  const [integrations, setIntegrations] = useState<ArkIntegration[]>([]);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [statusId, setStatusId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState("#843c2d");
  const [icon, setIcon] = useState("");
  const [charter, setCharter] = useState("");
  const [objectivesText, setObjectivesText] = useState("");
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/ark/categories").then((r) => r.json()),
      fetch("/api/admin/ark/statuses?applies_to=project").then((r) => r.json()),
      fetch("/api/admin/ark/integrations").then((r) => r.json()),
    ]).then(([catRes, statusRes, intRes]) => {
      if (catRes.success) setCategories(catRes.categories || []);
      if (statusRes.success) {
        const sts = statusRes.statuses || [];
        setStatuses(sts);
        const def = sts.find((s: ArkStatus) => s.is_default === 1);
        if (def) setStatusId(def.id);
      }
      if (intRes.success) setIntegrations(intRes.integrations || []);
    });
  }, []);

  const colors = ["#843c2d", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#6b7280"];
  const icons = ["🚀", "🎵", "💼", "🎬", "📝", "💻", "🏠", "📚", "🎨", "🌍", "⚡", "🔬", "🎯", "🛠️", "📦"];

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);

    try {
      // Create new category if needed
      let finalCategoryId = categoryId;
      if (newCategoryName.trim() && !categoryId) {
        const catRes = await fetch("/api/admin/ark/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCategoryName.trim(), color }),
        }).then((r) => r.json());
        if (catRes.success) finalCategoryId = catRes.category.id;
      }

      const objectives = objectivesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/ark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category_id: finalCategoryId || undefined,
          status_id: statusId || undefined,
          priority,
          start_date: startDate || undefined,
          target_date: targetDate || undefined,
          color,
          icon: icon || undefined,
          charter: charter || undefined,
          objectives: objectives.length > 0 ? objectives : undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        // Link selected integrations
        for (const intId of selectedIntegrations) {
          await fetch(`/api/admin/ark/${res.project.id}/integrations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ integration_id: intId }),
          });
        }
        router.push(`/admin/ark/${res.project.id}`);
      }
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      {/* Header */}
      <div className="border-b border-[#302927] px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#726d6c] hover:text-[#ede8df] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold">New Project</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(s)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s ? "bg-[#843c2d] text-[#ede8df]" : step > s ? "bg-[#843c2d]/30 text-[#843c2d]" : "bg-[#1a1816] text-[#726d6c] border border-[#302927]"
                }`}
              >
                {step > s ? "✓" : s}
              </button>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-[#843c2d]" : "bg-[#302927]"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Project Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you building?"
                className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-4 py-3 text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] text-lg"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Category</label>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  onClick={() => { setCategoryId(""); setNewCategoryName(""); }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${!categoryId && !newCategoryName ? "bg-[#843c2d] border-[#843c2d] text-[#ede8df]" : "border-[#302927] text-[#726d6c] hover:text-[#ede8df]"}`}
                >
                  None
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCategoryId(c.id); setNewCategoryName(""); }}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${categoryId === c.id ? "border-transparent text-white" : "border-[#302927] text-[#726d6c] hover:text-[#ede8df]"}`}
                    style={categoryId === c.id ? { backgroundColor: c.color || "#843c2d" } : undefined}
                  >
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => { setNewCategoryName(e.target.value); setCategoryId(""); }}
                placeholder="Or create a new category..."
                className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Status</label>
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Target Date</label>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Color & Icon</label>
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="h-6 w-px bg-[#302927]" />
                <div className="flex gap-1 flex-wrap">
                  {icons.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setIcon(icon === ic ? "" : ic)}
                      className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-colors ${icon === ic ? "bg-[#302927]" : "hover:bg-[#302927]/50"}`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Integrations */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Link Platforms & Tools</label>
              <p className="text-xs text-[#726d6c] mb-3">Select which platforms this project will use. You can add more later.</p>
              {integrations.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {integrations.map((int) => (
                    <button
                      key={int.id}
                      onClick={() => setSelectedIntegrations((prev) =>
                        prev.includes(int.id) ? prev.filter((i) => i !== int.id) : [...prev, int.id]
                      )}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                        selectedIntegrations.includes(int.id)
                          ? "border-[#843c2d] bg-[#843c2d]/10"
                          : "border-[#302927] hover:border-[#726d6c]"
                      }`}
                    >
                      {int.icon && <span className="text-lg">{int.icon}</span>}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#ede8df] truncate">{int.name}</div>
                        {int.platform_type && <div className="text-[10px] text-[#726d6c]">{int.platform_type}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-[#1a1816] border border-[#302927] rounded-lg">
                  <p className="text-sm text-[#726d6c]">No integrations defined yet.</p>
                  <p className="text-xs text-[#726d6c] mt-1">You can create them later in The Ark settings.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Charter & Objectives */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Project Charter</label>
              <p className="text-xs text-[#726d6c] mb-2">Why does this project exist? What&apos;s the vision?</p>
              <textarea
                value={charter}
                onChange={(e) => setCharter(e.target.value)}
                placeholder="Describe the purpose and vision of this project..."
                rows={4}
                className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-4 py-3 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#726d6c] mb-1.5">Objectives</label>
              <p className="text-xs text-[#726d6c] mb-2">One per line. What does success look like?</p>
              <textarea
                value={objectivesText}
                onChange={(e) => setObjectivesText(e.target.value)}
                placeholder={"Release album by September\nGet 10,000 streams in first month\nSecure playlist placement"}
                rows={4}
                className="w-full bg-[#1a1816] border border-[#302927] rounded-lg px-4 py-3 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#302927]">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : router.back()}
            className="px-4 py-2 text-sm text-[#726d6c] hover:text-[#ede8df] transition-colors"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !title.trim()}
              className="px-6 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!title.trim() || saving}
              className="px-6 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Creating..." : "Create Project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
