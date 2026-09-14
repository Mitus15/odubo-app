'use client';

import { useEffect, useRef, useState } from 'react';

import { apiSend } from '../../release/components/api';
import { INBOX_STATUSES, INBOX_TOPICS, TOPIC_LABELS, type InboxMessage, type InboxStatus, type InboxTopic, type ReplyTemplate, type ThreadDetail } from '@/lib/inbox/types';
import { fillTemplate } from '@/lib/inbox/text';

import Composer from './Composer';
import { fullTime } from './time';

export default function ThreadView({
  detail,
  templates,
  onBack,
  onChanged,
  onToggleCustomer,
  customerShown,
}: {
  detail: ThreadDetail;
  templates: ReplyTemplate[];
  onBack: () => void;
  onChanged: (next: ThreadDetail) => void;
  onToggleCustomer: () => void;
  customerShown: boolean;
}) {
  const { thread, contact, messages, attachments } = detail;
  const bottom = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, thread.id]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy('patch');
    try {
      const next = await apiSend<ThreadDetail>(`/api/admin/inbox/threads/${thread.id}`, 'PATCH', body);
      onChanged(next);
    } finally {
      setBusy(null);
    }
  };

  const send = async (text: string, kind: 'reply' | 'note') => {
    const res = await fetch(`/api/admin/inbox/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, kind }),
    });
    const data = (await res.json().catch(() => null)) as { message?: InboxMessage; error?: string } | null;
    if (!data?.message) throw new Error(data?.error || `${res.status} ${res.statusText}`);
    const m = data.message;
    onChanged({
      ...detail,
      messages: [...messages, m],
      thread: {
        ...thread,
        last_message_at: m.created_at,
        last_direction: kind === 'reply' ? 'out' : thread.last_direction,
        status: kind === 'reply' && thread.status !== 'closed' ? 'waiting' : thread.status,
      },
    });
    if (m.delivery_status === 'failed') throw new Error(m.delivery_error || 'The email did not go out. It is saved here.');
  };

  const relevant = templates.filter((t) => t.topic === 'any' || t.topic === thread.topic);
  const attachmentsFor = (id: string) => attachments.filter((a) => a.message_id === id);

  return (
    <div className="flex flex-col lg:h-[calc(100vh-140px)]">
      {/* Header */}
      <header className="border-b border-[#502d26]/50 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={onBack} className="lg:hidden text-xs text-[#726d6c] hover:text-[#b2a491] min-h-[44px] -mt-2">
              ← Inbox
            </button>
            <h2 className="truncate text-lg font-medium">{contact.name || contact.email}</h2>
            <p className="truncate text-xs text-[#726d6c]">
              {contact.name ? `${contact.email} · ` : ''}
              {thread.subject || TOPIC_LABELS[thread.topic]}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleCustomer}
            className="lg:hidden shrink-0 text-xs text-[#b2a491] hover:text-[#ede8df] min-h-[44px]"
          >
            {customerShown ? 'Hide' : 'Customer'}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-[#726d6c]">
          <span className="flex items-center gap-3">
            {INBOX_STATUSES.map((s: InboxStatus) => (
              <button
                key={s}
                type="button"
                disabled={busy !== null}
                onClick={() => thread.status !== s && patch({ status: s })}
                className={`min-h-[44px] -my-2 transition-colors ${thread.status === s ? 'text-[#ede8df] underline underline-offset-4 decoration-[#843c2d]' : 'hover:text-[#b2a491]'}`}
              >
                {s}
              </button>
            ))}
          </span>
          <span className="hidden sm:inline text-[#502d26]">|</span>
          <span className="flex items-center gap-3">
            {INBOX_TOPICS.map((t: InboxTopic) => (
              <button
                key={t}
                type="button"
                disabled={busy !== null}
                onClick={() => thread.topic !== t && patch({ topic: t })}
                className={`min-h-[44px] -my-2 transition-colors ${thread.topic === t ? 'text-[#ede8df] underline underline-offset-4 decoration-[#843c2d]' : 'hover:text-[#b2a491]'}`}
              >
                {TOPIC_LABELS[t]}
              </button>
            ))}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-[240px]">
        {messages.map((m) => {
          if (m.direction === 'note') {
            return (
              <div key={m.id} className="px-2 text-xs text-[#9c5f3c] italic border-l border-[#9c5f3c]/50 ml-1">
                <span className="not-italic text-[10px] uppercase tracking-wider text-[#726d6c] mr-2">note · {fullTime(m.created_at)}</span>
                {m.body_text}
              </div>
            );
          }
          const mine = m.direction === 'out';
          const files = attachmentsFor(m.id);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] ${mine ? 'text-right' : 'text-left'}`}>
                <div
                  className={`inline-block text-left whitespace-pre-wrap text-[15px] leading-relaxed px-4 py-2.5 rounded-2xl ${
                    mine ? 'bg-[#843c2d]/25 text-[#ede8df] rounded-br-md' : 'bg-[#1c1a19] text-[#ede8df] rounded-bl-md'
                  }`}
                >
                  {m.body_text}
                </div>
                {files.length > 0 && (
                  <ul className="mt-1 text-xs text-[#b2a491] space-y-0.5">
                    {files.map((f) => (
                      <li key={f.id}>
                        {f.download_url ? (
                          <a href={f.download_url} target="_blank" rel="noopener noreferrer" className="underline decoration-[#502d26] underline-offset-2">
                            {f.filename || 'attachment'}
                          </a>
                        ) : (
                          <span>{f.filename || 'attachment'}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 text-[10px] text-[#726d6c] tabular-nums">
                  {fullTime(m.created_at)}
                  {m.channel === 'email' && !mine && ' · email'}
                  {m.channel === 'web' && !mine && ' · site'}
                  {mine && m.delivery_status === 'failed' && <span className="text-red-300"> · not sent</span>}
                  {mine && m.delivery_status === 'queued' && ' · sending'}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* Composer */}
      <Composer
        key={thread.id}
        templates={relevant}
        fill={(t) => fillTemplate(t.body, { name: contact.name, order: thread.order_number })}
        onSend={send}
      />
    </div>
  );
}
