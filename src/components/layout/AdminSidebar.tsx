'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

/**
 * AdminSidebar - Persistent admin navigation adapted from DesktopSidebar design
 *
 * Features:
 * - Icon-only at lg breakpoint (w-20)
 * - Icon + label at xl breakpoint (w-64)
 * - Organized sections: Content, System, Analytics
 * - Replaces AdminNavigation horizontal bar
 * - Matches DesktopSidebar aesthetic
 */
export default function AdminSidebar() {
  const pathname = usePathname();

  const adminSections = [
    {
      title: 'Content',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          href: '/admin',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          ),
        },
        {
          id: 'videos',
          label: 'Videos',
          href: '/admin/videos',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          ),
        },
        {
          id: 'live',
          label: 'Live Streams',
          href: '/admin/live',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          ),
        },
        {
          id: 'music',
          label: 'Music',
          href: '/admin/tracks',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          ),
        },
        {
          id: 'featured',
          label: 'Featured',
          href: '/featured/manage',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          ),
        },
        {
          id: 'linktree',
          label: 'Link Tree',
          href: '/admin/linktree',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          id: 'database',
          label: 'Database',
          href: '/admin/db',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          ),
        },
        {
          id: 'storage',
          label: 'Storage',
          href: '/admin/storage',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          ),
        },
        {
          id: 'users',
          label: 'Users',
          href: '/admin/users',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Analytics',
      items: [
        {
          id: 'analytics',
          label: 'Analytics',
          href: '/admin/analytics',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-20 xl:w-64 flex-col bg-[#0d0c0a] border-r border-[#502d26]/20 z-40">
      {/* Logo / Header */}
      <div className="p-4 xl:p-6 flex flex-col gap-1 justify-center xl:justify-start border-b border-[#502d26]/10">
        <Link href="/admin" className="flex items-center gap-3 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/odubo_logo_emboss.webp"
            alt="Odubo Admin"
            className="w-10 h-10 xl:w-12 xl:h-12 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
            draggable={false}
          />
          <div className="hidden xl:block">
            <h1 className="text-sm font-bold text-[#ede8df]">Odubo Admin</h1>
            <p className="text-[10px] text-[#726d6c]">Content Management</p>
          </div>
        </Link>
      </div>

      {/* Navigation - Scrollable sections */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {adminSections.map((section) => (
          <div key={section.title} className="mb-6">
            {/* Section title - only visible on xl */}
            <div className="px-4 xl:px-6 mb-2">
              <h2 className="hidden xl:block text-[10px] text-[#502d26]/60 uppercase tracking-widest font-bold">
                {section.title}
              </h2>
            </div>

            {/* Section items */}
            {section.items.map((item) => {
              const isActive = pathname ? (pathname === item.href || pathname.startsWith(item.href + '/')) : false;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 xl:px-6 py-3 mx-2 rounded-xl
                    transition-colors
                    ${isActive
                      ? 'bg-[#843c2d]/20 text-[#ede8df]'
                      : 'text-[#726d6c] hover:text-[#b2a491] hover:bg-[#302927]/30'
                    }
                  `}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">{item.icon}</div>
                  {/* Label - only visible on xl */}
                  <span className="hidden xl:block text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 xl:p-6 border-t border-[#502d26]/10">
        <Link
          href="/"
          className="flex items-center justify-center xl:justify-start gap-2 text-[#502d26]/60 hover:text-[#726d6c] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          <span className="hidden xl:block text-xs font-medium">Back to Site</span>
        </Link>
      </div>
    </aside>
  );
}
