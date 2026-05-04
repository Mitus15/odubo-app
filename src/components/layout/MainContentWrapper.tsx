'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * MainContentWrapper - Conditionally applies sidebar margin
 *
 * Admin and featured/manage pages have their own sidebars,
 * so we don't apply the left margin for DesktopSidebar on those routes.
 * Also checks for admin subdomain (admin.odubo.studio).
 * Homepage doesn't use sidebar - no margin applied.
 */
export default function MainContentWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isAdminSubdomain, setIsAdminSubdomain] = useState(false);

  // Check if on admin subdomain
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAdminSubdomain(window.location.hostname.startsWith('admin.'));
    }
  }, []);

  // Admin/backend pages don't use the sidebar - don't add margin
  // Also homepage doesn't use sidebar
  const isAdminPage = isAdminSubdomain || pathname?.startsWith('/admin') || pathname?.startsWith('/command-center') || pathname?.startsWith('/featured/manage');
  const isHomePage = pathname === '/';

  return (
    <div className={`h-full w-full flex flex-col overflow-hidden ${isAdminPage || isHomePage ? '' : 'lg:ml-20 xl:ml-64'}`}>
      {children}
    </div>
  );
}
