'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import PlatformIcon from '@/components/linktree/PlatformIcon';
import { useEmailCapture } from '@/contexts/EmailCaptureContext';
import type { LinkTreeItem } from '@/types/linktree';

/**
 * /music while nothing on the site is out: the record that is out lives on
 * the streaming services, and the next one is locked.
 *
 *   Mani Odubo              the artist
 *   Album one               where it streams, one row a service
 *   World 2 · Locked        the next record, with no title and no tracks: its
 *                           story is kept back until it is out (2026-10-24)
 *   Save your progress      the list, the page's one drawn line
 *
 * The /links landing's look: the same dark, the same type, no cards.
 */
const LISTEN = { spotify: 'Spotify', apple_music: 'Apple Music' } as const;

export default function MusicLocked({ listen }: { listen: LinkTreeItem[] }) {
  const { hasSubscribed, subscribe, isSubmitting } = useEmailCapture();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const onJoin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!email.trim()) return;
      const result = await subscribe(email.trim());
      if (result.success) setJoined(true);
      else setError(result.error || 'That did not go through. Try again.');
    },
    [email, subscribe],
  );

  return (
    <div
      className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain"
      style={{
        background: 'linear-gradient(160deg, #1a1714 0%, #0d0c0a 55%, #14110f 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-6 pt-16 text-[#ede8df]">
        <h1 className="text-[1.6rem] leading-tight tracking-wide">Mani Odubo</h1>

        {listen.length > 0 && (
          <section className="mt-10" aria-labelledby="album-one">
            <h2 id="album-one" className="text-[0.65rem] uppercase tracking-[0.28em] text-[#b2a491]">Album one</h2>
            <ul className="mt-2">
              {listen.map((link) => (
                <li key={link.id} className="border-b border-[#ede8df]/10">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[52px] items-center gap-3 text-[0.95rem] tracking-wide hover:text-white"
                  >
                    <PlatformIcon platform={link.platform ?? null} mono className="h-5 w-5 text-[#ede8df]/70" />
                    Listen on {LISTEN[link.platform as keyof typeof LISTEN] ?? link.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12" aria-labelledby="world-two">
          <h2 id="world-two" className="text-[0.65rem] uppercase tracking-[0.28em] text-[#b2a491]">World 2 · Locked</h2>
          {hasSubscribed || joined ? (
            <p className="mt-4 text-sm tracking-wide text-[#ede8df]/60">Progress saved. You hear it first.</p>
          ) : (
            <form onSubmit={onJoin} className="mt-4 flex items-end gap-3 border-b border-[#ede8df]/25 focus-within:border-[#ede8df]/60">
              <label htmlFor="music-email" className="sr-only">Email</label>
              <input
                id="music-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email, to hear it first"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#ede8df] outline-none placeholder:text-[#ede8df]/35"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] text-xs uppercase tracking-[0.2em] text-[#ede8df]/80 transition-colors hover:text-[#ede8df] disabled:opacity-40"
              >
                Save your progress
              </button>
            </form>
          )}
          {error && <p className="mt-2 text-xs text-red-300/70">{error}</p>}
        </section>

        <footer className="mt-auto flex items-center gap-4 pt-12 text-[0.7rem] uppercase tracking-[0.22em] text-[#ede8df]/50">
          <Link href="/" className="flex min-h-[44px] items-center hover:text-[#ede8df]">Home</Link>
          <span aria-hidden="true" className="text-[#ede8df]/25">·</span>
          <Link href="/links" className="flex min-h-[44px] items-center hover:text-[#ede8df]">Links</Link>
        </footer>
      </main>
    </div>
  );
}
