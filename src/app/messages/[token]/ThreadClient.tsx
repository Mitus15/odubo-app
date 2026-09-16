'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';

interface Msg {
  id: string;
  direction: 'in' | 'out';
  body_text: string;
  created_at: string;
}

function when(iso: string): string {
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function newSubmissionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function ThreadClient({
  token,
  subject,
  status,
  name,
  initialMessages,
}: {
  token: string;
  subject: string;
  status: 'open' | 'waiting' | 'closed';
  name: string | null;
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionId = useMemo(() => newSubmissionId(), []);
  const bottom = useRef<HTMLDivElement>(null);
  // Times are the viewer's locale and zone, which the server cannot know.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // Pick up the studio's replies while the page is open.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages/${token}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { messages: Msg[] };
        setMessages(data.messages);
      } catch {
        /* quiet */
      }
    }, 20_000);
    return () => clearInterval(t);
  }, [token]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, submissionId: `${submissionId}-${messages.length}` }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Could not send');
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, direction: 'in', body_text: body, created_at: new Date().toISOString() }]);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void send();
    }
  };

  return (
    <main className="min-h-screen bg-[#0f0b0b] text-[#ede8df]">
      <div className="mx-auto max-w-xl px-5 pb-32" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <header className="border-b border-white/10 pb-4">
          <Link href="/" className="text-[11px] uppercase tracking-[0.2em] text-[#b2a491] hover:text-[#ede8df]">
            Odubo Studio
          </Link>
          <h1 className="mt-2 text-xl font-serif">{subject}</h1>
          <p className="mt-1 text-xs text-[#726d6c]">
            {name ? `${name} · ` : ''}
            {status === 'closed' ? 'Closed. Write again to reopen.' : 'We answer here and by email.'}
          </p>
        </header>

        <section className="py-5 space-y-4">
          {messages.map((m) => {
            const theirs = m.direction === 'out';
            return (
              <div key={m.id} className={`flex ${theirs ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] ${theirs ? 'text-left' : 'text-right'}`}>
                  <div
                    className={`inline-block text-left whitespace-pre-wrap text-[15px] leading-relaxed px-4 py-2.5 rounded-2xl ${
                      theirs ? 'bg-white/[0.06] rounded-bl-md' : 'bg-[#843c2d]/30 rounded-br-md'
                    }`}
                  >
                    {m.body_text}
                  </div>
                  <div className="mt-1 text-[10px] text-[#726d6c]">
                    {theirs ? 'Odubo Studio · ' : ''}
                    {mounted ? when(m.created_at) : ''}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </section>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 bg-[#0f0b0b]/95 backdrop-blur border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto max-w-xl px-5 py-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder="Write back"
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#ede8df] placeholder-[#726d6c] focus:outline-none border-l-2 border-white/15 focus:border-[#843c2d] pl-3 py-1"
          />
          {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#726d6c]">Replies also reach your email.</span>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !text.trim()}
              className="min-h-[44px] rounded-full bg-[#843c2d] px-5 text-sm font-medium text-[#ede8df] hover:bg-[#9a4736] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
