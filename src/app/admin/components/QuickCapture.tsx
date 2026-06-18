"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Project { id: string; title: string; icon: string | null; }

type CaptureMode = "task" | "note";

export default function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("task");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ark").then((r) => r.json());
      if (res.success) {
        const active = (res.projects || []).filter((p: { archived_at: string | null }) => !p.archived_at);
        setProjects(active);
        if (active.length > 0 && !projectId) setProjectId(active[0].id);
      }
    } catch (e) {
      console.error("Quick capture: failed to fetch projects", e);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && projects.length === 0) fetchProjects();
  }, [open, projects.length, fetchProjects]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleSubmit = async () => {
    if (!projectId || !title.trim()) return;
    setSaving(true);

    try {
      if (mode === "task") {
        await fetch(`/api/admin/ark/${projectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), due_date: dueDate || undefined, priority }),
        });
      } else {
        await fetch(`/api/admin/ark/${projectId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content: content || title.trim(), category: category || undefined }),
        });
      }
      setSuccess(true);
      setTitle("");
      setContent("");
      setDueDate("");
      setCategory("");
      setTimeout(() => setSuccess(false), 1500);
    } catch (e) {
      console.error("Quick capture: save failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-[#843c2d] text-[#ede8df] rounded-full shadow-lg shadow-black/30 flex items-center justify-center hover:bg-[#843c2d]/80 transition-all hover:scale-105 active:scale-95"
        title="Quick Capture (Cmd+K)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:rounded-xl"
            >
              <div className="bg-[#1a1816] border border-[#302927] rounded-t-xl sm:rounded-xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-[#ede8df]">Quick Capture</h3>
                  <button onClick={() => setOpen(false)} className="text-[#726d6c] hover:text-[#ede8df]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Mode toggle */}
                <div className="flex bg-[#0d0c0a] border border-[#302927] rounded-lg overflow-hidden">
                  {(["task", "note"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 px-4 py-2 text-sm font-medium capitalize transition-colors ${mode === m ? "bg-[#843c2d] text-[#ede8df]" : "text-[#726d6c] hover:text-[#ede8df]"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Project selector */}
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                >
                  {projects.length === 0 && <option value="">No projects — create one first</option>}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.icon ? `${p.icon} ` : ""}{p.title}</option>
                  ))}
                </select>

                {/* Title */}
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
                  placeholder={mode === "task" ? "What needs to be done?" : "Note title"}
                  className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2.5 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
                  autoFocus
                />

                {/* Note content */}
                {mode === "note" && (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your note..."
                    rows={3}
                    className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
                  />
                )}

                {/* Task options */}
                {mode === "task" && (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded-lg px-2 py-1.5 text-xs text-[#ede8df] focus:outline-none focus:border-[#843c2d] [color-scheme:dark]"
                    />
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="bg-[#0d0c0a] border border-[#302927] rounded-lg px-2 py-1.5 text-xs text-[#ede8df] focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                )}

                {/* Note category */}
                {mode === "note" && (
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Category (optional)"
                    className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-xs text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
                  />
                )}

                {/* Submit */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#726d6c]">Cmd+K to toggle</span>
                  <button
                    onClick={handleSubmit}
                    disabled={!title.trim() || !projectId || saving}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                      success ? "bg-[#10b981] text-white" : "bg-[#843c2d] text-[#ede8df] hover:bg-[#843c2d]/80"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {success ? "Added!" : saving ? "Saving..." : `Add ${mode}`}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
