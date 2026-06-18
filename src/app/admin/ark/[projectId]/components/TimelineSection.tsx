"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArkTimelineEntry } from "@/types/ark";

interface Props {
  projectId: string;
}

const typeIcons: Record<string, string> = {
  status_change: "🔄",
  task_completed: "✅",
  milestone_reached: "🏁",
  update: "📝",
  setback: "⚠️",
  win: "🏆",
  decision: "⚖️",
  note: "📌",
};

export default function TimelineSection({ projectId }: Props) {
  const [entries, setEntries] = useState<ArkTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [entryType, setEntryType] = useState("update");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryDescription, setEntryDescription] = useState("");

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ark/${projectId}/timeline`).then((r) => r.json());
      if (res.success) setEntries(res.entries || []);
    } catch (e) {
      console.error("Failed to fetch timeline:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addEntry = async () => {
    if (!entryTitle.trim()) return;
    await fetch(`/api/admin/ark/${projectId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_type: entryType, title: entryTitle.trim(), description: entryDescription || undefined }),
    });
    setEntryTitle(""); setEntryDescription(""); setShowAdd(false);
    fetchEntries();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 transition-colors">
          + Log Entry
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-4 space-y-3">
          <div className="flex gap-2">
            <select value={entryType} onChange={(e) => setEntryType(e.target.value)} className="bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none">
              <option value="update">Update</option>
              <option value="win">Win</option>
              <option value="setback">Setback</option>
              <option value="decision">Decision</option>
              <option value="note">Note</option>
            </select>
            <input type="text" value={entryTitle} onChange={(e) => setEntryTitle(e.target.value)} placeholder="What happened?" className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
          </div>
          <textarea value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} placeholder="Details (optional)" rows={2} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y" />
          <div className="flex gap-2">
            <button onClick={addEntry} disabled={!entryTitle.trim()} className="px-3 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm disabled:opacity-40">Add</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-[#726d6c]">Cancel</button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12 text-[#726d6c] text-sm">No activity yet.</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[#302927]" />

          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="relative flex items-start gap-4 pl-10">
                <div className="absolute left-2.5 w-3 h-3 rounded-full bg-[#1a1816] border-2 border-[#843c2d]" style={{ top: "6px" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{typeIcons[entry.entry_type] || "📋"}</span>
                    <span className="text-sm font-medium text-[#ede8df]">{entry.title}</span>
                  </div>
                  {entry.description && (
                    <p className="text-xs text-[#726d6c] mt-0.5 whitespace-pre-wrap">{entry.description}</p>
                  )}
                  <span className="text-[10px] text-[#726d6c] mt-1 block">
                    {new Date(entry.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
