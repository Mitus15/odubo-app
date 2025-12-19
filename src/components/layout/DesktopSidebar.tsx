'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useOmniShop } from '@/contexts/OmniShopContext';
import { useAuthModal } from '@/contexts/AuthModalContext';

/**
 * DesktopSidebar - Persistent navigation for desktop (lg+)
 *
 * Features:
 * - Icon-only at lg breakpoint (w-20)
 * - Icon + label at xl breakpoint (w-64)
 * - Nav items: Home, Store, Media, Moments, Account
 * - Cart badge on Store item
 * - Hidden on mobile (< 1024px)
 */
export default function DesktopSidebar() {
  const pathname = usePathname();
  const { openMaison, cartCount } = useOmniShop();
  const { openSignIn } = useAuthModal();

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      href: '/',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      id: 'store',
      label: 'Store',
      action: openMaison,
      badge: cartCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
    },
    {
      id: 'media',
      label: 'Media',
      href: '/media',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
        </svg>
      ),
    },
    {
      id: 'moments',
      label: 'Moments',
      href: '/moments',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
    },
    {
      id: 'account',
      label: 'Account',
      action: openSignIn,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-20 xl:w-64 flex-col bg-[#0d0c0a] border-r border-[#502d26]/20 z-40">
      {/* Logo */}
      <div className="p-4 xl:p-6 flex justify-center xl:justify-start">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/odubo_logo_emboss.png"
            alt="Odubo"
            className="w-10 h-10 xl:w-12 xl:h-12 object-contain opacity-80 hover:opacity-100 transition-opacity"
            draggable={false}
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = item.href && pathname === item.href;

          const content = (
            <div
              className={`
                flex items-center gap-3 px-4 xl:px-6 py-3 mx-2 rounded-xl
                transition-colors cursor-pointer
                ${isActive
                  ? 'bg-[#843c2d]/20 text-[#ede8df]'
                  : 'text-[#726d6c] hover:text-[#b2a491] hover:bg-[#302927]/30'
                }
              `}
            >
              {/* Icon with badge */}
              <div className="relative flex-shrink-0">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#843c2d] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              {/* Label - only visible on xl */}
              <span className="hidden xl:block text-sm font-medium">{item.label}</span>
            </div>
          );

          if (item.href) {
            return (
              <Link key={item.id} href={item.href}>
                {content}
              </Link>
            );
          }

          return (
            <button key={item.id} onClick={item.action} className="w-full text-left">
              {content}
            </button>
          );
        })}
      </nav>

      {/* Footer - brand mark */}
      <div className="p-4 xl:p-6 border-t border-[#502d26]/10">
        <div className="flex justify-center xl:justify-start">
          <span className="text-[10px] text-[#502d26]/40 uppercase tracking-widest hidden xl:block">
            Odubo Studio
          </span>
        </div>
      </div>
    </aside>
  );
}
