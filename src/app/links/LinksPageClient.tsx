'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import PlatformIcon from '@/components/linktree/PlatformIcon';
import ContactModal from '@/components/store/ContactModal';
import { useEmailCapture } from '@/contexts/EmailCaptureContext';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import { isStoreLink } from '@/lib/linktreeLinks';
import type { FeaturedProduct } from '@/lib/featuredProduct';
import type { LinkTreeItem } from '@/types/linktree';
import { formatMoney } from '@/lib/store/money';
import { ODUBO_MARK, ODUBO_MARK_ASPECT } from '@/lib/brand/marks';

/**
 * The landing: the piece first, then everywhere else Odubo lives.
 *
 *   the mark          small, the house's signature, not a header
 *   the piece         the featured product, cut out on the dark, its name and
 *                     price, and the page's one drawn shape: Shop
 *   the platforms     one row of marks in the page's own colour
 *   Home · Shop all   the way into the site (clips, the words) and the store
 *   the list          one line for an email
 *
 * No cards, no paragraphs: the piece and the marks are the page. No entrance
 * animation either: the server's HTML is the page, visible at first paint in
 * an in-app browser before any script has run. It covers
 * the layout's own chrome (z-150) and sits under the cookie banner (z-160),
 * which must stay answerable.
 */

/** The order the marks read in: where the audience is first, then listening. */
const PLATFORM_ORDER = ['instagram', 'tiktok', 'youtube', 'spotify', 'apple_music'];

interface Props {
  links: LinkTreeItem[];
  storeOpen: boolean;
  featured: FeaturedProduct | null;
}

export default function LinksPageClient({ links, storeOpen, featured }: Props) {
  const analytics = useAnalyticsSafe();
  const { hasSubscribed, subscribe, isSubmitting } = useEmailCapture();
  const [contactOpen, setContactOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const platforms = useMemo(
    () =>
      links
        .filter((link) => !isStoreLink(link))
        .sort((a, b) => {
          const ra = PLATFORM_ORDER.indexOf(a.platform || '');
          const rb = PLATFORM_ORDER.indexOf(b.platform || '');
          return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
        }),
    [links],
  );

  const count = useCallback((link: LinkTreeItem) => {
    fetch(`/api/linktree/${link.id}`, { method: 'POST', keepalive: true }).catch(() => {});
  }, []);

  const onJoin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setEmailError(null);
      if (!email.trim()) return;
      const result = await subscribe(email.trim());
      if (result.success) setJoined(true);
      else setEmailError(result.error || 'That did not go through. Try again.');
    },
    [email, subscribe],
  );

  const markHeight = featured ? 34 : 72;

  return (
    <div
      className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain"
      style={{
        background: 'linear-gradient(160deg, #1a1714 0%, #0d0c0a 55%, #14110f 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col items-center px-6 pb-6 pt-8 text-[#ede8df]">
        {/* the mark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ODUBO_MARK}
          alt="Odubo Studio"
          width={Math.round(markHeight * ODUBO_MARK_ASPECT)}
          height={markHeight}
          draggable={false}
          style={{ height: markHeight, width: 'auto', opacity: 0.85 }}
        />

        {/* the piece */}
        {featured && (
          <section
            aria-label={featured.title}
            className="mt-4 flex w-full flex-col items-center"
          >
            <Link
              href={`/store/product/${featured.handle}`}
              onClick={() => analytics?.trackShopVisit()}
              className="group block w-full"
              aria-label={`${featured.title}, ${formatMoney(featured.price, featured.currency)}`}
            >
              {featured.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.image}
                  alt=""
                  className="piece mx-auto aspect-square w-full max-w-[19rem] object-contain"
                  draggable={false}
                />
              )}
            </Link>
            <h1 className="mt-3 text-center text-[1.35rem] leading-tight tracking-wide">{featured.title}</h1>
            <p className="mt-1 text-sm tracking-[0.12em] text-[#b2a491]">
              {formatMoney(featured.price, featured.currency)}
            </p>
            <Link
              href={`/store/product/${featured.handle}`}
              onClick={() => analytics?.trackShopVisit()}
              className="mt-5 flex h-12 w-full max-w-[17rem] items-center justify-center rounded-full bg-[#ede8df] text-[0.95rem] font-semibold tracking-wide text-[#0d0c0a] transition-transform active:scale-[0.98]"
            >
              {featured.available ? 'Shop' : 'See it'}
            </Link>
          </section>
        )}

        {/* the platforms */}
        {platforms.length > 0 && (
          <nav
            aria-label="Odubo elsewhere"
            className={`${featured ? 'mt-8' : 'mt-10'} flex flex-wrap items-center justify-center gap-1`}
          >
            {platforms.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => count(link)}
                aria-label={link.title}
                title={link.title}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[#ede8df]/70 transition-colors hover:text-[#ede8df] active:scale-95"
              >
                <PlatformIcon platform={link.platform ?? null} mono className="h-[22px] w-[22px]" />
              </a>
            ))}
          </nav>
        )}

        {/* the way in */}
        <div
          className="mt-5 flex items-center gap-4 text-[0.7rem] uppercase tracking-[0.22em] text-[#ede8df]/60"
        >
          <Link href="/" className="flex min-h-[44px] items-center gap-1.5 hover:text-[#ede8df]">
            Home
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
            </svg>
          </Link>
          {storeOpen && (
            <>
              <span aria-hidden="true" className="text-[#ede8df]/25">·</span>
              <Link href="/store" onClick={() => analytics?.trackShopVisit()} className="flex min-h-[44px] items-center hover:text-[#ede8df]">
                Shop all
              </Link>
            </>
          )}
        </div>

        {/* the list */}
        <div
          className="mt-6 w-full max-w-[17rem]"
        >
          {joined || hasSubscribed ? (
            <p className="text-center text-xs tracking-wide text-[#ede8df]/45">You&rsquo;re on the list.</p>
          ) : (
            <form onSubmit={onJoin} className="flex items-end gap-3 border-b border-[#ede8df]/15 focus-within:border-[#ede8df]/40">
              <label htmlFor="links-email" className="sr-only">Email</label>
              <input
                id="links-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                placeholder="Email, for what comes next"
                required
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#ede8df] outline-none placeholder:text-[#ede8df]/30"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] text-xs uppercase tracking-[0.2em] text-[#ede8df]/70 transition-colors hover:text-[#ede8df] disabled:opacity-40"
              >
                {isSubmitting ? '…' : 'Join'}
              </button>
            </form>
          )}
          {emailError && <p className="mt-2 text-center text-xs text-red-300/70">{emailError}</p>}
        </div>

        {/* the small print */}
        <footer className="mt-auto flex items-center gap-3 pt-10 text-[0.65rem] tracking-wide text-[#ede8df]/30">
          <button type="button" onClick={() => setContactOpen(true)} className="min-h-[44px] hover:text-[#ede8df]/60">
            Contact
          </button>
          <span aria-hidden="true">·</span>
          <Link href="/legal?tab=shipping" className="flex min-h-[44px] items-center hover:text-[#ede8df]/60">
            Shipping &amp; returns
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/legal?tab=privacy" className="flex min-h-[44px] items-center hover:text-[#ede8df]/60">
            Privacy
          </Link>
        </footer>
      </main>

      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
