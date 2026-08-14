"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";
import { NOTE_HERE_EVENT } from "./NoteHere";

const AUTHOR_KEY = "loop-notes-author";

/**
 * The thread's composer. The list itself is server-rendered by the Studio page
 * (refresh-after-post, the house admin pattern) — this component only writes.
 *
 * Listens for the "note this ✎" event from anywhere on the page (sections,
 * Playbook tabs) and responds by prefilling the topic, scrolling itself into
 * view and focusing the body — so "note anything" is one tap from anywhere.
 */
export function NotesBoard() {
  const router = useRouter();
  const [author, setAuthor] = useState("");
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // Read the remembered name on mount only — never at render (hydration).
  useEffect(() => {
    try {
      setAuthor(localStorage.getItem(AUTHOR_KEY) ?? "");
    } catch {
      /* private mode — fine */
    }
  }, []);

  useEffect(() => {
    const onNoteHere = (e: Event) => {
      const t = (e as CustomEvent<{ topic?: string }>).detail?.topic ?? "";
      setTopic(t);
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      // After the smooth scroll has somewhere to land — focus without jumping.
      window.setTimeout(() => bodyRef.current?.focus({ preventScroll: true }), 350);
    };
    window.addEventListener(NOTE_HERE_EVENT, onNoteHere);
    return () => window.removeEventListener(NOTE_HERE_EVENT, onNoteHere);
  }, []);

  function rememberAuthor(name: string) {
    try {
      localStorage.setItem(AUTHOR_KEY, name.trim());
    } catch {
      /* private mode — fine */
    }
  }

  async function post() {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      rememberAuthor(author);
      const res = await fetch("/api/loop/admin/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ author, topic, body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "couldn't post — try again");
      }
      setBody("");
      setTopic("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="mt-4 rounded-2xl border border-ink/15 bg-ink/[0.03] p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
            Your name
          </span>
          <input
            type="text"
            value={author}
            maxLength={40}
            placeholder="Sign your notes — we share one key"
            onChange={(e) => setAuthor(e.target.value)}
            onBlur={() => rememberAuthor(author)}
            className="mt-0.5 w-full rounded-xl border border-ink/15 bg-bone/40 px-3 py-2 text-sm outline-none focus:border-ink/40"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
            About (optional)
          </span>
          <input
            type="text"
            value={topic}
            maxLength={60}
            placeholder="Posters, pricing, anything…"
            onChange={(e) => setTopic(e.target.value)}
            className="mt-0.5 w-full rounded-xl border border-ink/15 bg-bone/40 px-3 py-2 text-sm outline-none focus:border-ink/40"
          />
        </label>
      </div>
      <label className="mt-2 block">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
          The note
        </span>
        <textarea
          ref={bodyRef}
          value={body}
          maxLength={2000}
          rows={3}
          placeholder="Ideas, pushback, questions — anything. It lands on the thread for both of us."
          onChange={(e) => setBody(e.target.value)}
          className="mt-0.5 w-full rounded-xl border border-ink/15 bg-bone/40 px-3 py-2 text-sm outline-none focus:border-ink/40"
        />
      </label>
      {error && <p className="mt-1 text-xs font-bold text-wine">{error}</p>}
      <button
        type="button"
        disabled={busy || !body.trim()}
        onClick={post}
        className="mt-2 rounded-full bg-ink px-4 py-2 text-xs font-bold text-sand disabled:opacity-50"
      >
        {busy ? <LoopLoader size={14} /> : "Post to the thread"}
      </button>
    </div>
  );
}

export default NotesBoard;
