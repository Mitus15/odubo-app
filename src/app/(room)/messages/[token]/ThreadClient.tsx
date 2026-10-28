'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { RoomShell } from '@/components/room/RoomParts';
import { onRoom, ROOM_DARK } from '@/lib/room';

/** A line between things, in the room's writing colour */
const HAIRLINE = 'color-mix(in srgb, currentColor 35%, transparent)';
/** What the reply, fixed along the bottom, covers of the conversation */
const REPLY_CLEARANCE = 'calc(env(safe-area-inset-bottom) + 170px)';

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

  const on = onRoom(ROOM_DARK);

  // The conversation, set in the house's dark room: lines, not bubbles. The
  // studio's words sit to the left, the visitor's to the right, each under a
  // hairline and a small name; the reply waits along the bottom.
  return (
    <RoomShell colour={ROOM_DARK} on={on}>
      <main className="room-fade mx-auto w-full max-w-xl px-5 pt-2" style={{ paddingBottom: REPLY_CLEARANCE }}>
        <header>
          <h1 className="room-display text-[clamp(22px,6.5vw,30px)] uppercase leading-[1.05]">{subject}</h1>
          <p className="mt-2 text-[13px] opacity-70">
            {name ? `${name} · ` : ''}
            {status === 'closed' ? 'Closed. Write again to reopen.' : 'We answer here and by email.'}
          </p>
        </header>

        <ol className="mt-8 flex flex-col gap-6">
          {messages.map((m) => {
            const theirs = m.direction === 'out';
            const at = mounted ? when(m.created_at) : '';
            return (
              <li
                key={m.id}
                className={`w-[85%] border-t pt-3 ${theirs ? 'mr-auto text-left' : 'ml-auto text-right'}`}
                style={{ borderColor: HAIRLINE }}
              >
                <p className="room-eyebrow">
                  {theirs ? 'Odubo Studio' : 'You'}
                  {at ? ` · ${at}` : ''}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{m.body_text}</p>
              </li>
            );
          })}
        </ol>
        <div ref={bottom} style={{ scrollMarginBottom: REPLY_CLEARANCE }} />
      </main>

      {/* The reply: no box, a hairline above it, and Send the one drawn shape */}
      <div
        className="fixed inset-x-0 bottom-0"
        style={{ background: ROOM_DARK, boxShadow: `inset 0 1px 0 ${HAIRLINE}`, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto max-w-xl px-5 pb-3 pt-2">
          <label htmlFor="thread-reply" className="sr-only">
            Write back
          </label>
          <textarea
            id="thread-reply"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder="Write back"
            className="w-full resize-none bg-transparent py-2 text-[16px] leading-relaxed outline-none placeholder:text-[#f0d3ad]/45"
          />
          {error && (
            <p className="mt-1 text-[13px] text-[#f4a36b]" role="alert">
              {error}
            </p>
          )}
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="room-eyebrow !text-[10px]">Replies also reach your email</span>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !text.trim()}
              className="min-h-[44px] shrink-0 rounded-full px-7 text-[14px] font-semibold tracking-wide transition-[transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: on, color: ROOM_DARK }}
            >
              {busy ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </RoomShell>
  );
}
