'use client';

import { useEffect, useState } from 'react';

import { INBOX_TOPICS, TOPIC_LABELS, type InboxThread, type InboxTopic } from '@/lib/inbox/types';

/** The owner starts a conversation. Spring in, X to close, no drag. */
export default function NewThread({
  onClose,
  onCreated,
  initialEmail = '',
  initialName = '',
}: {
  onClose: () => void;
  onCreated: (threadId: string) => void;
  initialEmail?: string;
  initialName?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [topic, setTopic] = useState<InboxTopic>('general');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inbox/threads/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, subject, orderNumber, topic, body }),
      });
      const data = (await res.json().catch(() => null)) as { thread?: InboxThread; error?: string } | null;
      if (!data?.thread) throw new Error(data?.error || `${res.status}`);
      onCreated(data.thread.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full bg-transparent border-b border-[#502d26]/50 focus:border-[#843c2d] focus:outline-none py-2 text-sm text-[#ede8df] placeholder-[#726d6c]';

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="New message">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div className="relative w-full max-w-md bg-[#0d0c0a] border border-[#502d26]/60 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-3 right-3 h-11 w-11 flex items-center justify-center rounded-full text-[#726d6c] hover:text-[#ede8df] hover:bg-white/5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-lg font-medium text-[#ede8df]">New message</h2>
          <p className="text-xs text-[#726d6c] mt-1">Goes out by email now. Their reply lands back here.</p>

          <div className="mt-4 space-y-3">
            <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <input className={field} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={field} placeholder="Order #" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </div>
            <input className={field} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-[#726d6c]">
              {INBOX_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={`min-h-[44px] ${topic === t ? 'text-[#ede8df] underline underline-offset-4 decoration-[#843c2d]' : 'hover:text-[#b2a491]'}`}
                >
                  {TOPIC_LABELS[t]}
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Write"
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#ede8df] placeholder-[#726d6c] focus:outline-none border-l-2 border-[#502d26]/60 focus:border-[#843c2d] pl-3 py-1"
            />
            {error && <p className="text-xs text-red-300">{error}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !email.trim() || !body.trim()}
                className="min-h-[44px] rounded-full bg-[#843c2d] px-5 text-sm font-medium text-[#ede8df] hover:bg-[#9a4736] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Sending' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
