"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArkNote } from "@/types/ark";

interface Props {
  projectId: string;
}

export default function NotesSection({ projectId }: Props) {
  const [notes, setNotes] = useState<ArkNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editNote, setEditNote] = useState<ArkNote | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ark/${projectId}/notes`).then((r) => r.json());
      if (res.success) setNotes(res.notes || []);
    } catch (e) {
      console.error("Failed to fetch notes:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const openEditor = (note?: ArkNote) => {
    if (note) {
      setEditNote(note);
      setTitle(note.title || "");
      setContent(note.content);
      setCategory(note.category || "");
    } else {
      setEditNote(null);
      setTitle("");
      setContent("");
      setCategory("");
    }
    setShowEditor(true);
  };

  const saveNote = async () => {
    if (!content.trim()) return;
    const body = { title: title || undefined, content, category: category || undefined };

    if (editNote) {
      await fetch(`/api/admin/ark/${projectId}/notes/${editNote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`/api/admin/ark/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setShowEditor(false);
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    await fetch(`/api/admin/ark/${projectId}/notes/${id}`, { method: "DELETE" });
    fetchNotes();
  };

  const togglePin = async (note: ArkNote) => {
    await fetch(`/api/admin/ark/${projectId}/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    });
    fetchNotes();
  };

  const uniqueCategories = [...new Set(notes.map((n) => n.category).filter(Boolean))];

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {uniqueCategories.map((c) => (
            <span key={c} className="px-2 py-0.5 bg-[#302927] rounded text-[10px] text-[#ede8df]">{c}</span>
          ))}
        </div>
        <button
          onClick={() => openEditor()}
          className="px-4 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 transition-colors"
        >
          + Add Note
        </button>
      </div>

      {/* Editor modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowEditor(false)}>
          <div className="bg-[#1a1816] border border-[#302927] rounded-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium text-[#ede8df]">{editNote ? "Edit Note" : "New Note"}</h3>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note..."
              rows={8}
              className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y"
              autoFocus
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (e.g., idea, research, decision)"
              className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm text-[#726d6c] hover:text-[#ede8df]">Cancel</button>
              <button onClick={saveNote} disabled={!content.trim()} className="px-4 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm font-medium hover:bg-[#843c2d]/80 disabled:opacity-40">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Notes grid */}
      {notes.length === 0 ? (
        <div className="text-center py-12 text-[#726d6c] text-sm">No notes yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ark-grid">
          {notes.map((note) => (
            <div
              key={note.id}
              className="ark-card bg-[#1a1816] border border-[#302927] group hover:border-[#843c2d]/30 transition-colors cursor-pointer"
              onClick={() => openEditor(note)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  {note.title && <h4 className="ark-text-base font-medium text-[#ede8df] truncate">{note.title}</h4>}
                  {note.category && <span className="ark-text-xs text-[#726d6c]">{note.category}</span>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); togglePin(note); }} className={`text-xs ${note.is_pinned ? "text-[#f59e0b]" : "text-[#726d6c]"}`}>
                    {note.is_pinned ? "★" : "☆"}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="text-[#726d6c] hover:text-red-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#726d6c] line-clamp-4 whitespace-pre-wrap">{note.content}</p>
              <div className="text-[10px] text-[#726d6c] mt-2">
                {new Date(note.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
