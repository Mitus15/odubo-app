'use client';

import { useState, FormEvent, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ROOM_INK, ROOM_SAND } from '@/lib/room';

type InquiryType = 'order' | 'refund' | 'shipping' | 'general';

function newSubmissionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface FormData {
  name: string;
  email: string;
  orderNumber: string;
  inquiryType: InquiryType;
  message: string;
}

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** What it is about, in a word each (api/contact files it under the topic) */
const inquiryLabels: Record<InquiryType, string> = {
  order: 'Order',
  refund: 'Returns',
  shipping: 'Shipping',
  general: 'Other',
};

const FIELD =
  'min-h-[48px] w-full border-b border-[#f0d3ad]/40 bg-transparent text-[16px] outline-none placeholder:text-[#f0d3ad]/45 focus:border-[#f0d3ad]';

/**
 * Write to the studio: a sheet of the house's ink rising from the floor, the
 * same slot as Save your progress. Name, email, what it is about, the
 * message, and Send, the one drawn shape; api/contact opens the conversation
 * and answers with its private link. Closed with its X, never by dragging.
 *
 * The sheet is always in the page, out of sight and inert, and put on the
 * page's body (out of the room, the store and the link tree, z-200), so the
 * tap that opens it can put the keyboard up on the name: a phone only raises
 * it for a field focused inside the tap itself.
 */
export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    orderNumber: '',
    inquiryType: 'general',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [threadUrl, setThreadUrl] = useState<string | null>(null);
  // One id per open of the form: a double tap on Send is one message, not two.
  const [submissionId, setSubmissionId] = useState(() => newSubmissionId());
  const [host, setHost] = useState<HTMLElement | null>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const conversation = useRef<HTMLAnchorElement>(null);
  // More than one of these can be in the page at once (a room's small print, the store's), each out of sight
  const id = useId();

  useEffect(() => setHost(document.body), []);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Delay reset to allow exit animation
      const timer = setTimeout(() => {
        setFormData({
          name: '',
          email: '',
          orderNumber: '',
          inquiryType: 'general',
          message: '',
        });
        setStatus('idle');
        setErrorMessage('');
        setThreadUrl(null);
        setSubmissionId(newSubmissionId());
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Opening: the name takes the focus inside the opening tap (a layout effect
  // runs in the tap's own turn). Closing: the keyboard goes down and the focus
  // goes back where it was.
  useLayoutEffect(() => {
    if (!isOpen || !host) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    nameField.current?.focus({ preventScroll: true });
    return () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      back?.focus({ preventScroll: true });
    };
  }, [isOpen, host]);

  // Sent: the form is gone, so the focus goes on to the way into the conversation (and the keyboard down)
  useEffect(() => {
    if (status === 'success') (conversation.current ?? closer.current)?.focus({ preventScroll: true });
  }, [status]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, submissionId }),
      });

      const data = await res.json() as { error?: string; threadUrl?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setThreadUrl(data.threadUrl || null);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (!host) return null;

  return createPortal(
    <div className="room contents">
      {/* The room dims behind the sheet; a tap on it closes */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[210] bg-[#2a0f0a]/30 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        inert={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className={`fixed inset-x-0 bottom-0 z-[211] mx-auto w-full max-w-md px-3 transition-transform duration-500 ease-[cubic-bezier(0.2,0.9,0.25,1.1)] ${isOpen ? 'translate-y-0' : 'translate-y-[115%]'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div
          className="relative max-h-[calc(100dvh-env(safe-area-inset-top)-24px)] overflow-y-auto overscroll-contain px-5 pb-6 pt-5"
          style={{ background: ROOM_INK, color: ROOM_SAND, boxShadow: `inset 0 0 0 1.5px ${ROOM_SAND}40` }}
        >
          <button
            ref={closer}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center opacity-80 hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <p id={`${id}-title`} className="room-display text-[13px] uppercase tracking-[0.24em]">
            {status === 'success' ? 'Sent' : 'Write to the studio'}
          </p>

          {status === 'success' ? (
            <div role="status">
              <p className="mt-3 text-[15px]">The studio writes back within a day or two.</p>
              {threadUrl && (
                <a ref={conversation} href={threadUrl} className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] underline decoration-[#f0d3ad]/50 underline-offset-4 hover:decoration-[#f0d3ad]">
                  Open your conversation
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
              <label htmlFor={`${id}-name`} className="sr-only">
                Name
              </label>
              <input
                ref={nameField}
                type="text"
                id={`${id}-name`}
                required
                autoComplete="name"
                enterKeyHint="next"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={FIELD}
                placeholder="Your name"
              />
              <label htmlFor={`${id}-email`} className="sr-only">
                Email
              </label>
              <input
                type="email"
                id={`${id}-email`}
                required
                inputMode="email"
                autoComplete="email"
                enterKeyHint="next"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={FIELD}
                placeholder="Your email"
              />

              {/* What it is about: a word each, the chosen one underlined */}
              <div role="group" aria-label="What it is about" className="mt-1 flex flex-wrap gap-x-5">
                {(Object.keys(inquiryLabels) as InquiryType[]).map((type) => {
                  const chosen = formData.inquiryType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => setFormData({ ...formData, inquiryType: type })}
                      className={`min-h-[44px] text-[14px] underline-offset-[6px] transition-opacity ${chosen ? 'underline decoration-[1.5px]' : 'opacity-55 hover:opacity-85'}`}
                    >
                      {inquiryLabels[type]}
                    </button>
                  );
                })}
              </div>

              <label htmlFor={`${id}-order`} className="sr-only">
                Order number, if there is one
              </label>
              <input
                type="text"
                id={`${id}-order`}
                enterKeyHint="next"
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                className={FIELD}
                placeholder="Order number, if any"
              />
              <label htmlFor={`${id}-message`} className="sr-only">
                Message
              </label>
              <textarea
                id={`${id}-message`}
                required
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className={`${FIELD} resize-none py-3 leading-relaxed`}
                placeholder="Your message"
              />

              {status === 'error' && (
                <p className="text-[13px] text-[#f4a36b]" role="alert">
                  {sayError(errorMessage)}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="mt-3 flex min-h-[52px] items-center justify-center rounded-full text-[15px] font-semibold tracking-wide transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: ROOM_SAND, color: ROOM_INK }}
              >
                {status === 'loading' ? 'Sending…' : 'Send'}
              </button>
              <p className="room-eyebrow mt-1 text-center !text-[10px] opacity-70">No account needed</p>
            </form>
          )}
        </div>
      </div>
    </div>,
    host,
  );
}

/** api/contact's refusals, in the room's voice */
function sayError(error: string): string {
  if (/required/i.test(error)) return 'A name, an email and a message, please.';
  if (/valid email/i.test(error)) return 'That email does not look right.';
  if (/too many/i.test(error)) return 'Too many tries. Give it a minute.';
  if (/too long/i.test(error)) return 'That is too long. Keep it under 10,000 characters.';
  return 'That did not go through. Try again.';
}
