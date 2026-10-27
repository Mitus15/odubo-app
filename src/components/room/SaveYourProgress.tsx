'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEmailCapture } from '@/contexts/EmailCaptureContext';
import { ROOM_INK, ROOM_SAND } from '@/lib/room';

/**
 * Save your progress: the list, as the game's save. The button is the room's
 * one drawn shape, filled in the room's writing colour; it opens the save
 * slot, a dialog box in ink rising from the floor, with an email and nothing
 * else (never a password: api/email/subscribe writes the fan profile and
 * sends the welcome). Closed with its X, never by dragging.
 *
 * The slot is always in the page, out of sight and inert, so the tap that
 * opens it can put the keyboard up: a phone only raises it for a field
 * focused inside the tap itself.
 */
export default function SaveYourProgress({ colour, on, className = '' }: { colour: string; on: string; className?: string }) {
  const { hasSubscribed, subscribe, isSubmitting } = useEmailCapture();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const openSlot = useCallback(() => {
    if (slot.current) slot.current.inert = false;
    field.current?.focus({ preventScroll: true });
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    field.current?.blur();
    opener.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (slot.current) slot.current.inert = !open;
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const onSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!email.trim()) return;
      const result = await subscribe(email.trim());
      if (result.success) {
        setSaved(true);
        field.current?.blur();
      } else setError(sayError(result.error));
    },
    [email, subscribe],
  );

  const done = saved || hasSubscribed;

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={done ? undefined : openSlot}
        aria-disabled={done}
        className={`flex min-h-[52px] items-center justify-center rounded-full px-8 text-[15px] font-semibold tracking-wide transition-[transform,background-color,color] duration-500 active:scale-[0.98] ${className}`}
        style={done ? { color: on, boxShadow: `inset 0 0 0 1.5px ${on}` } : { background: on, color: colour }}
      >
        {done ? 'Progress saved' : 'Save your progress'}
      </button>

      {/* The room dims behind the slot; a tap on it closes */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-[157] bg-[#2a0f0a]/30 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        ref={slot}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-slot-title"
        className={`fixed inset-x-0 z-[158] mx-auto w-full max-w-md px-3 pb-3 transition-transform duration-500 ease-[cubic-bezier(0.2,0.9,0.25,1.1)] ${open ? 'translate-y-0' : 'translate-y-[115%]'}`}
        style={{ bottom: 'var(--consent-h, 0px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div className="relative px-5 pb-6 pt-5" style={{ background: ROOM_INK, color: ROOM_SAND, boxShadow: `inset 0 0 0 1.5px ${ROOM_SAND}40` }}>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center opacity-80 hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <p id="save-slot-title" className="room-display text-[13px] uppercase tracking-[0.24em]">
            {saved ? 'Progress saved' : 'Save your progress'}
          </p>

          {saved ? (
            <p className="mt-3 text-[15px]" role="status">
              Player two. The next level comes to you first.
            </p>
          ) : (
            <form onSubmit={onSave} noValidate className="mt-4 flex flex-col gap-3">
              <label htmlFor="save-slot-email" className="sr-only">
                Email
              </label>
              <input
                ref={field}
                id="save-slot-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="go"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="Your email"
                className="min-h-[48px] w-full border-b border-[#f0d3ad]/40 bg-transparent text-[16px] outline-none placeholder:text-[#f0d3ad]/45 focus:border-[#f0d3ad]"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex min-h-[52px] items-center justify-center rounded-full text-[15px] font-semibold tracking-wide transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: ROOM_SAND, color: ROOM_INK }}
              >
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
              {error && (
                <p className="text-[13px] text-[#f4a36b]" role="alert">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function sayError(error?: string): string {
  if (!error) return 'That did not go through. Try again.';
  if (/invalid email|required/i.test(error)) return 'That email does not look right.';
  if (/too many/i.test(error)) return 'Too many tries. Give it a minute.';
  return 'That did not go through. Try again.';
}
