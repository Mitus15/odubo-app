'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/contexts/StoreContext';
import { useMemo, useEffect, useState } from 'react';
import LinkTreeModal from '@/components/linktree/LinkTreeModal';

/**
 * DesktopSidebar - Persistent navigation for desktop (lg+)
 *
 * Features:
 * - Icon-only at lg breakpoint (w-20)
 * - Icon + label at xl breakpoint (w-64)
 * - Nav items: Home, Store, Moments, Connect
 * - Cart badge on Store item
 * - Hidden on mobile (< 1024px)
 * - Store hidden when store is disabled
 * - Account accessible from within Store (matches mobile)
 */
export default function DesktopSidebar() {
  const pathname = usePathname();
  const { openStore, cartItemCount, isStoreAccessible, isCheckingAccess } = useStore();
  const [isAdminSubdomain, setIsAdminSubdomain] = useState(false);
  const [linkTreeOpen, setLinkTreeOpen] = useState(false);

  // Check if on admin subdomain
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      setIsAdminSubdomain(hostname.startsWith('admin.'));
    }
  }, []);

  // Nav items - always show all items, but disable store while checking
  // IMPORTANT: All hooks must be called before any conditional returns
  const navItems = useMemo(() => {
    // Determine if store should be enabled
    const storeEnabled = !isCheckingAccess && isStoreAccessible;

    const items = [
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
        action: storeEnabled ? openStore : undefined,
        badge: storeEnabled ? cartItemCount : undefined,
        disabled: isCheckingAccess,
        hidden: !isCheckingAccess && !isStoreAccessible,
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        ),
      },
      {
        id: 'connect',
        label: 'Connect',
        action: () => setLinkTreeOpen(true),
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        ),
      },
    ];
    // Filter out hidden items
    return items.filter(item => !item.hidden);
  }, [isCheckingAccess, isStoreAccessible, openStore, cartItemCount]);

  // Hide on admin/backend pages and admin subdomain (must be after all hooks)
  if (isAdminSubdomain || pathname?.startsWith('/admin') || pathname?.startsWith('/command-center') || pathname?.startsWith('/featured/manage')) {
    return null;
  }

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-20 xl:w-64 flex-col bg-[#0d0c0a] border-r border-[#502d26]/20 z-40">
      {/* Logo */}
      <div className="p-4 xl:p-6 flex justify-center xl:justify-start">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-logos/odubo-logo.png"
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
          const isDisabled = item.disabled;

          const content = (
            <div
              className={`
                flex items-center gap-3 px-4 xl:px-6 py-3 mx-2 rounded-xl
                transition-colors
                ${isDisabled
                  ? 'text-[#726d6c]/50 cursor-wait'
                  : isActive
                    ? 'bg-[#843c2d]/20 text-[#ede8df] cursor-pointer'
                    : 'text-[#726d6c] hover:text-[#b2a491] hover:bg-[#302927]/30 cursor-pointer'
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

          // Disabled items render as non-interactive divs
          if (isDisabled) {
            return (
              <div key={item.id} className="w-full">
                {content}
              </div>
            );
          }

          if (item.href) {
            return (
              <Link key={item.id} href={item.href}>
                {content}
              </Link>
            );
          }

          if (item.action) {
            return (
              <button key={item.id} onClick={item.action} className="w-full text-left">
                {content}
              </button>
            );
          }

          return null;
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

      {/* LinkTree Modal */}
      <LinkTreeModal isOpen={linkTreeOpen} onClose={() => setLinkTreeOpen(false)} />
    </aside>
  );
}
