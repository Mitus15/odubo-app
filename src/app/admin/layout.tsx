import { ToastProvider } from '@/contexts/ToastContext';

/**
 * Admin Layout - Minimal wrapper for admin pages
 *
 * Admin pages (like /admin) have their own built-in sidebar navigation,
 * so this layout just provides a clean pass-through wrapper.
 * 
 * The MainContentWrapper in root layout detects /admin routes and
 * removes the DesktopSidebar margin automatically.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
