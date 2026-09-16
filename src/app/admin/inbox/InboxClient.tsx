'use client';

/**
 * The inbox: one desk for every customer conversation.
 *
 * Three panes on a wide screen (threads, the conversation, the customer);
 * on a phone they stack and the list gives way to the thread. The owner's
 * design language applies: hairline rules instead of cards, tappable text
 * instead of dropdowns, one distinct shape for the one primary action.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { apiFetch } from '../release/components/api';
import { BackLink, Spinner } from '../release/components/ui';
import type { InboxStatus, ReplyTemplate, ThreadDetail, ThreadListRow } from '@/lib/inbox/types';

import ThreadList from './components/ThreadList';
import ThreadView from './components/ThreadView';
import CustomerPane from './components/CustomerPane';
import NewThread from './components/NewThread';

type Filter = InboxStatus | 'all';

export default function InboxClient() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('t');

  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [threads, setThreads] = useState<ThreadListRow[] | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prefillTo = params.get('to');
  const prefillName = params.get('name');
  const [composing, setComposing] = useState(Boolean(prefillTo));
  const [showCustomer, setShowCustomer] = useState(false);
  const detailReq = useRef(0);

  const loadList = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ status: filter });
      if (query.trim()) qs.set('q', query.trim());
      const data = await apiFetch<{ threads: ThreadListRow[] }>(`/api/admin/inbox/threads?${qs}`);
      setThreads(data.threads);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [filter, query]);

  const loadDetail = useCallback(async (id: string) => {
    const req = ++detailReq.current;
    try {
      const data = await apiFetch<ThreadDetail>(`/api/admin/inbox/threads/${id}`);
      if (req !== detailReq.current) return;
      setDetail(data);
      setThreads((prev) => prev?.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)) ?? prev);
    } catch (err) {
      if (req === detailReq.current) setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    apiFetch<{ templates: ReplyTemplate[] }>('/api/admin/inbox/templates')
      .then((d) => setTemplates(d.templates))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  // A light poll keeps the list honest while the desk is open.
  useEffect(() => {
    const t = setInterval(() => {
      void loadList();
      if (selectedId) void loadDetail(selectedId);
    }, 30_000);
    return () => clearInterval(t);
  }, [loadList, loadDetail, selectedId]);

  const select = (id: string | null) => {
    const qs = new URLSearchParams(params.toString());
    if (id) qs.set('t', id);
    else qs.delete('t');
    router.replace(`/admin/inbox${qs.size ? `?${qs}` : ''}`);
    setShowCustomer(false);
  };

  const onThreadChanged = (next: ThreadDetail) => {
    setDetail(next);
    void loadList();
  };

  const counts = useMemo(() => {
    const unread = threads?.filter((t) => t.unread_count > 0).length ?? 0;
    return { unread };
  }, [threads]);

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <BackLink href="/admin">Admin</BackLink>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">Inbox</h1>
          </div>
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="min-h-[44px] rounded-full border border-[#843c2d] bg-[#843c2d] px-5 text-sm font-medium text-[#ede8df] hover:bg-[#9a4736] transition-colors"
          >
            New message
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        <div className="mt-5 grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)_300px] lg:gap-6">
          {/* List */}
          <section className={`${selectedId ? 'hidden lg:block' : ''}`}>
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.14em] text-[#726d6c] border-b border-[#502d26]/50 pb-3">
              {(['open', 'waiting', 'closed', 'all'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`min-h-[44px] -my-2 transition-colors ${filter === f ? 'text-[#ede8df]' : 'hover:text-[#b2a491]'}`}
                >
                  {f}
                  {f === 'open' && counts.unread > 0 && <span className="ml-1 text-[#d9aa7a]">·{counts.unread}</span>}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, order"
              className="mt-3 w-full bg-transparent border-b border-[#502d26]/50 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]"
            />
            {threads === null ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : (
              <ThreadList threads={threads} selectedId={selectedId} onSelect={select} />
            )}
          </section>

          {/* Thread */}
          <section className={`${selectedId ? '' : 'hidden lg:block'} min-w-0`}>
            {!selectedId && (
              <p className="pt-16 text-center text-sm text-[#726d6c]">Pick a conversation.</p>
            )}
            {selectedId && !detail && (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            )}
            {selectedId && detail && (
              <ThreadView
                detail={detail}
                templates={templates}
                onBack={() => select(null)}
                onChanged={onThreadChanged}
                onToggleCustomer={() => setShowCustomer((v) => !v)}
                customerShown={showCustomer}
              />
            )}
          </section>

          {/* Customer */}
          <aside className={`${selectedId && detail ? (showCustomer ? '' : 'hidden lg:block') : 'hidden lg:block'}`}>
            {detail && <CustomerPane detail={detail} onChanged={onThreadChanged} />}
          </aside>
        </div>
      </div>

      {composing && (
        <NewThread
          initialEmail={prefillTo || ''}
          initialName={prefillName || ''}
          onClose={() => setComposing(false)}
          onCreated={(threadId) => {
            setComposing(false);
            void loadList();
            select(threadId);
          }}
        />
      )}
    </div>
  );
}

