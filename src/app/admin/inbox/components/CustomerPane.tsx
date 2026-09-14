'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { apiSend } from '../../release/components/api';
import { TOPIC_LABELS, type ThreadDetail } from '@/lib/inbox/types';
import { timeAgo } from './time';

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'CAD' }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-[#502d26]/40">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#726d6c]">{label}</div>
      <div className="mt-0.5 text-sm text-[#ede8df] break-words">{children}</div>
    </div>
  );
}

export default function CustomerPane({ detail, onChanged }: { detail: ThreadDetail; onChanged: (next: ThreadDetail) => void }) {
  const { thread, contact, orders, loopCodes, priorThreads } = detail;
  const [notes, setNotes] = useState(contact.notes || '');
  const [orderNo, setOrderNo] = useState(thread.order_number || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => setNotes(contact.notes || ''), [contact.id, contact.notes]);
  useEffect(() => setOrderNo(thread.order_number || ''), [thread.id, thread.order_number]);

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      onChanged(await apiSend<ThreadDetail>(`/api/admin/inbox/threads/${thread.id}`, 'PATCH', body));
    } finally {
      setSaving(false);
    }
  };

  const linkedOrder = orders.find((o) => String(o.order_number) === thread.order_number);

  return (
    <div className="text-sm">
      <Row label="Customer">
        <div>{contact.name || <span className="text-[#726d6c]">No name yet</span>}</div>
        <a href={`mailto:${contact.email}`} className="text-[#b2a491] hover:text-[#ede8df] text-xs">
          {contact.email}
        </a>
        {contact.phone && <div className="text-xs text-[#b2a491]">{contact.phone}</div>}
        <div className="text-[11px] text-[#726d6c] mt-1">
          First wrote {timeAgo(contact.first_seen_at)} ago
          {contact.customer_id && ' · store account'}
        </div>
      </Row>

      <Row label="Order on this thread">
        <div className="flex items-center gap-2">
          <span className="text-[#726d6c]">#</span>
          <input
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            onBlur={() => (orderNo.trim() || '') !== (thread.order_number || '') && save({ orderNumber: orderNo.trim() || null })}
            placeholder="none"
            className="w-24 bg-transparent border-b border-[#502d26]/50 focus:border-[#843c2d] focus:outline-none text-sm py-1"
          />
          {linkedOrder && (
            <span className="text-xs text-[#b2a491]">
              {money(linkedOrder.total_amount, linkedOrder.currency)} · {linkedOrder.fulfillment_status}
            </span>
          )}
        </div>
      </Row>

      <Row label={`Orders (${orders.length})`}>
        {orders.length === 0 ? (
          <span className="text-[#726d6c] text-xs">None on record under this email.</span>
        ) : (
          <ul className="divide-y divide-[#502d26]/30">
            {orders.slice(0, 8).map((o) => (
              <li key={o.id} className="py-1.5 flex items-baseline justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => o.order_number && save({ orderNumber: String(o.order_number) })}
                  className={`min-h-[32px] text-left hover:text-[#ede8df] ${String(o.order_number) === thread.order_number ? 'text-[#ede8df]' : 'text-[#b2a491]'}`}
                  title="Attach to this thread"
                >
                  #{o.order_number ?? '—'} <span className="text-[#726d6c]">· {timeAgo(o.created_at)}</span>
                </button>
                <span className="text-[#b2a491] tabular-nums">
                  {money(o.total_amount, o.currency)} <span className="text-[#726d6c]">· {o.fulfillment_status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Row>

      {loopCodes.length > 0 && (
        <Row label="Loop Soul">
          <ul className="text-xs space-y-0.5">
            {loopCodes.map((c) => (
              <li key={`${c.event_id}-${c.code}`} className="flex justify-between gap-2">
                <span className="tabular-nums">{c.code}</span>
                <span className="text-[#726d6c]">{c.redeemed ? 'redeemed' : 'unused'}</span>
              </li>
            ))}
          </ul>
        </Row>
      )}

      {priorThreads.length > 0 && (
        <Row label="Earlier conversations">
          <ul className="text-xs space-y-1">
            {priorThreads.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/inbox?t=${p.id}`} className="text-[#b2a491] hover:text-[#ede8df]">
                  {p.subject || TOPIC_LABELS[p.topic]} <span className="text-[#726d6c]">· {p.status} · {timeAgo(p.last_message_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Row>
      )}

      <Row label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => (notes.trim() || '') !== (contact.notes || '') && save({ contactNotes: notes.trim() || null })}
          rows={3}
          placeholder="Sizes, preferences, what to remember"
          className="w-full resize-none bg-transparent text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none border-l-2 border-[#502d26]/60 focus:border-[#843c2d] pl-3 py-1"
        />
        {saving && <span className="text-[10px] text-[#726d6c]">Saving</span>}
      </Row>
    </div>
  );
}
