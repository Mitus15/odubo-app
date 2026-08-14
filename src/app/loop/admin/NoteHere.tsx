"use client";

/**
 * "Note this ✎" — a tiny button that any Studio section or Playbook tab can
 * carry so a note can be attached to ANYTHING, not just a proposed question.
 *
 * Talks to the composer through a window CustomEvent rather than a context:
 * the Studio is several independent client islands (embedded tools, the
 * Playbook modal, the thread) and an event crosses all of them for free.
 */
export const NOTE_HERE_EVENT = "loop:note-here";

export function noteHere(topic: string) {
  window.dispatchEvent(new CustomEvent(NOTE_HERE_EVENT, { detail: { topic } }));
}

export function NoteHere({ topic }: { topic: string }) {
  return (
    <button
      type="button"
      onClick={() => noteHere(topic)}
      aria-label={`Write a note about ${topic}`}
      className="rounded-full border border-ink/25 px-3 py-1 text-[11px] font-bold opacity-70 transition-opacity hover:opacity-100"
    >
      Note this ✎
    </button>
  );
}

export default NoteHere;
