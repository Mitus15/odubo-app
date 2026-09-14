'use client';

import { TOPIC_LABELS, type ThreadListRow } from '@/lib/inbox/types';
import { timeAgo } from './time';

export default function ThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: ThreadListRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (threads.length === 0) {
    return <p className="py-10 text-center text-sm text-[#726d6c]">Nothing here.</p>;
  }
  return (
    <ul className="divide-y divide-[#502d26]/40">
      {threads.map((t) => {
        const unread = t.unread_count > 0;
        const active = t.id === selectedId;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className={`w-full text-left py-3 pr-2 min-h-[44px] transition-colors ${active ? 'text-[#ede8df]' : 'hover:text-[#ede8df]'}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className={`truncate text-sm ${unread ? 'font-semibold text-[#ede8df]' : 'text-[#b2a491]'}`}>
                  {unread && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#d9aa7a] align-middle" />}
                  {t.contact_name || t.contact_email}
                </span>
                <span className="shrink-0 text-[11px] text-[#726d6c] tabular-nums">{timeAgo(t.last_message_at)}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-2 text-xs text-[#726d6c]">
                <span className="uppercase tracking-wider text-[10px]">{TOPIC_LABELS[t.topic]}</span>
                {t.order_number && <span>#{t.order_number}</span>}
                {t.status !== 'open' && <span className="text-[10px] uppercase tracking-wider">{t.status}</span>}
              </div>
              {t.last_snippet && (
                <p className={`mt-1 truncate text-xs ${unread ? 'text-[#b2a491]' : 'text-[#726d6c]'}`}>
                  {t.last_direction === 'out' ? 'You: ' : ''}
                  {t.last_snippet}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
