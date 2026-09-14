'use client';

import { useState, type KeyboardEvent } from 'react';

import type { ReplyTemplate } from '@/lib/inbox/types';

export default function Composer({
  templates,
  fill,
  onSend,
}: {
  templates: ReplyTemplate[];
  fill: (t: ReplyTemplate) => string;
  onSend: (text: string, kind: 'reply' | 'note') => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'reply' | 'note'>('reply');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(body, kind);
      setText('');
      setKind('reply');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t border-[#502d26]/50 pt-3">
      {templates.length > 0 && kind === 'reply' && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#726d6c]">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setText((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${fill(t)}` : fill(t)))}
              className="min-h-[44px] -my-2 hover:text-[#b2a491] transition-colors"
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        rows={kind === 'note' ? 2 : 4}
        placeholder={kind === 'note' ? 'A note only you see' : 'Write back'}
        className={`w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#ede8df] placeholder-[#726d6c] focus:outline-none border-l-2 pl-3 py-1 ${
          kind === 'note' ? 'border-[#9c5f3c]/60' : 'border-[#502d26]/60 focus:border-[#843c2d]'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.14em] text-[#726d6c]">
          <button
            type="button"
            onClick={() => setKind('reply')}
            className={`min-h-[44px] transition-colors ${kind === 'reply' ? 'text-[#ede8df]' : 'hover:text-[#b2a491]'}`}
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => setKind('note')}
            className={`min-h-[44px] transition-colors ${kind === 'note' ? 'text-[#ede8df]' : 'hover:text-[#b2a491]'}`}
          >
            Note
          </button>
          <span className="hidden sm:inline normal-case tracking-normal">⌘↩ to send</span>
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !text.trim()}
          className={`min-h-[44px] rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            kind === 'note' ? 'border border-[#9c5f3c]/60 text-[#d9aa7a] hover:bg-[#9c5f3c]/15' : 'bg-[#843c2d] text-[#ede8df] hover:bg-[#9a4736]'
          }`}
        >
          {busy ? 'Sending' : kind === 'note' ? 'Add note' : 'Send'}
        </button>
      </div>
    </div>
  );
}
