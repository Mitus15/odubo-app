"use client";

import { useState, useEffect, useCallback } from "react";
import type { ArkProject, ArkCategory } from "@/types/ark";

interface Props {
  project: ArkProject;
  onUpdate: (updates: Partial<ArkProject>) => void;
}

const COLORS = ["#843c2d", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#6b7280"];
const ICONS = ["🚀", "🎵", "💼", "🎬", "📝", "💻", "🏠", "📚", "🎨", "🌍", "⚡", "🔬", "🎯", "🛠️", "📦", "🎉", "🏆", "📸", "🎧", "✈️"];

export default function OverviewSection({ project, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState<ArkCategory[]>([]);

  // Editable fields
  const [charter, setCharter] = useState(project.charter || "");
  const [categoryId, setCategoryId] = useState(project.category_id || "");
  const [priority, setPriority] = useState(project.priority || "medium");
  const [startDate, setStartDate] = useState(project.start_date || "");
  const [targetDate, setTargetDate] = useState(project.target_date || "");
  const [icon, setIcon] = useState(project.icon || "");
  const [color, setColor] = useState(project.color || "#843c2d");
  const [objectives, setObjectives] = useState<string[]>(project.objectives ? JSON.parse(project.objectives) : []);
  const [successCriteria, setSuccessCriteria] = useState<string[]>(project.success_criteria ? JSON.parse(project.success_criteria) : []);
  const [tags, setTags] = useState<string[]>(project.tags ? JSON.parse(project.tags) : []);
  const [newObjective, setNewObjective] = useState("");
  const [newCriteria, setNewCriteria] = useState("");
  const [newTag, setNewTag] = useState("");

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/admin/ark/categories").then((r) => r.json());
    if (res.success) setCategories(res.categories || []);
  }, []);

  useEffect(() => { if (editing) fetchCategories(); }, [editing, fetchCategories]);

  const save = () => {
    onUpdate({
      charter: charter || null,
      category_id: categoryId || null,
      priority,
      start_date: startDate || null,
      target_date: targetDate || null,
      icon: icon || null,
      color: color || null,
      objectives: objectives.length > 0 ? objectives : null,
      success_criteria: successCriteria.length > 0 ? successCriteria : null,
      tags: tags.length > 0 ? tags : null,
    } as Partial<ArkProject>);
    setEditing(false);
  };

  const addObjective = () => { if (newObjective.trim()) { setObjectives([...objectives, newObjective.trim()]); setNewObjective(""); } };
  const addCriteria = () => { if (newCriteria.trim()) { setSuccessCriteria([...successCriteria, newCriteria.trim()]); setNewCriteria(""); } };
  const addTag = () => { if (newTag.trim()) { setTags([...tags, newTag.trim()]); setNewTag(""); } };

  if (!editing) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex justify-end">
          <button onClick={() => setEditing(true)} className="px-4 py-1.5 border border-[#302927] text-[#ede8df] rounded-lg ark-text-sm hover:border-[#843c2d]/50 transition-colors">
            Edit
          </button>
        </div>

        {/* Charter */}
        <div className="ark-card bg-[#1a1816] border border-[#302927]">
          <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-3">Charter</h3>
          <p className="ark-text-base text-[#ede8df] whitespace-pre-wrap">
            {project.charter || <span className="text-[#726d6c] italic">No charter defined. Click Edit to add one.</span>}
          </p>
        </div>

        {/* Objectives */}
        {objectives.length > 0 && (
          <div className="ark-card bg-[#1a1816] border border-[#302927]">
            <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-3">Objectives</h3>
            <ul className="space-y-2">
              {objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 ark-text-base text-[#ede8df]">
                  <span className="text-[#843c2d] mt-0.5">&#9679;</span>{obj}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success Criteria */}
        {successCriteria.length > 0 && (
          <div className="ark-card bg-[#1a1816] border border-[#302927]">
            <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-3">Success Criteria</h3>
            <ul className="space-y-2">
              {successCriteria.map((sc, i) => (
                <li key={i} className="flex items-start gap-2 ark-text-base text-[#ede8df]">
                  <span className="text-[#22c55e] mt-0.5">&#10003;</span>{sc}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <span key={i} className="ark-badge bg-[#302927] text-[#ede8df]">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // EDIT MODE
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-end gap-2">
        <button onClick={() => setEditing(false)} className="px-4 py-1.5 ark-text-sm text-[#726d6c] hover:text-[#ede8df]">Cancel</button>
        <button onClick={save} className="px-5 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm font-medium hover:bg-[#843c2d]/80">Save All</button>
      </div>

      {/* Basics */}
      <div className="ark-card bg-[#1a1816] border border-[#302927] space-y-4">
        <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider">Project Details</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block ark-text-xs text-[#726d6c] mb-1">Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none">
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block ark-text-xs text-[#726d6c] mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block ark-text-xs text-[#726d6c] mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none [color-scheme:dark]" />
          </div>
          <div>
            <label className="block ark-text-xs text-[#726d6c] mb-1">Target Date</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none [color-scheme:dark]" />
          </div>
        </div>

        <div>
          <label className="block ark-text-xs text-[#726d6c] mb-1">Color & Icon</label>
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="h-6 w-px bg-[#302927]" />
            <div className="flex gap-1 flex-wrap">
              {ICONS.map((ic) => (
                <button key={ic} onClick={() => setIcon(icon === ic ? "" : ic)} className={`w-7 h-7 rounded flex items-center justify-center ark-text-sm transition-colors ${icon === ic ? "bg-[#302927]" : "hover:bg-[#302927]/50"}`}>{ic}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charter */}
      <div className="ark-card bg-[#1a1816] border border-[#302927]">
        <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">Charter</h3>
        <textarea value={charter} onChange={(e) => setCharter(e.target.value)} rows={4} placeholder="Why does this project exist? What's the vision?" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y" />
      </div>

      {/* Objectives */}
      <div className="ark-card bg-[#1a1816] border border-[#302927]">
        <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">Objectives</h3>
        <div className="space-y-1.5 mb-2">
          {objectives.map((obj, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="ark-text-sm text-[#ede8df] flex-1">{obj}</span>
              <button onClick={() => setObjectives(objectives.filter((_, j) => j !== i))} className="text-[#726d6c] hover:text-red-400 ark-text-xs">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newObjective} onChange={(e) => setNewObjective(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addObjective()} placeholder="Add an objective..." className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
          <button onClick={addObjective} disabled={!newObjective.trim()} className="px-3 py-1 bg-[#302927] text-[#ede8df] rounded ark-text-xs disabled:opacity-40">Add</button>
        </div>
      </div>

      {/* Success Criteria */}
      <div className="ark-card bg-[#1a1816] border border-[#302927]">
        <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">Success Criteria</h3>
        <div className="space-y-1.5 mb-2">
          {successCriteria.map((sc, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="ark-text-sm text-[#ede8df] flex-1">{sc}</span>
              <button onClick={() => setSuccessCriteria(successCriteria.filter((_, j) => j !== i))} className="text-[#726d6c] hover:text-red-400 ark-text-xs">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newCriteria} onChange={(e) => setNewCriteria(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCriteria()} placeholder="Add a success criterion..." className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
          <button onClick={addCriteria} disabled={!newCriteria.trim()} className="px-3 py-1 bg-[#302927] text-[#ede8df] rounded ark-text-xs disabled:opacity-40">Add</button>
        </div>
      </div>

      {/* Tags */}
      <div className="ark-card bg-[#1a1816] border border-[#302927]">
        <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-2">Tags</h3>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag, i) => (
            <span key={i} className="ark-badge bg-[#302927] text-[#ede8df] flex items-center gap-1">
              {tag}
              <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="text-[#726d6c] hover:text-red-400">✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="Add a tag..." className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
          <button onClick={addTag} disabled={!newTag.trim()} className="px-3 py-1 bg-[#302927] text-[#ede8df] rounded ark-text-xs disabled:opacity-40">Add</button>
        </div>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end gap-2">
        <button onClick={() => setEditing(false)} className="px-4 py-1.5 ark-text-sm text-[#726d6c]">Cancel</button>
        <button onClick={save} className="px-5 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm font-medium hover:bg-[#843c2d]/80">Save All</button>
      </div>
    </div>
  );
}
