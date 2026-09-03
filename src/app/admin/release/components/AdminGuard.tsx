'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client-side admin guard for the Release routes.
 *
 * Lifted from the check in src/app/admin/page.tsx (L309-345). Pages under
 * /admin are a single client route that guards itself; a full route like
 * /admin/ark or /admin/release sits outside that and must do its own.
 *
 * This only decides what to render — it decodes the token without verifying
 * it, exactly as the admin shell does, and cannot be trusted for anything.
 * Every /api/admin/release route verifies the signature server-side via
 * requireAdmin(). This is chrome, not security.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'ok'>('checking');

  useEffect(() => {
    const cookieToken = () => {
      try {
        const all = typeof document !== 'undefined' ? document.cookie : '';
        const match = all
          .split(';')
          .map((s) => s.trim())
          .find((s) => s.startsWith('token='));
        return match ? decodeURIComponent(match.split('=')[1]) : null;
      } catch {
        return null;
      }
    };

    const token =
      (typeof window !== 'undefined' ? localStorage.getItem('token') : null) || cookieToken();

    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      const part = token.split('.')[1] || '';
      const pad = (s: string) => s + '==='.slice((s.length + 3) % 4);
      const base64 = pad(part.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(
        typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('utf-8')
      );
      if (payload?.is_admin || payload?.role === 'admin') {
        setState('ok');
      } else {
        router.replace('/');
      }
    } catch {
      window.location.href = '/login';
    }
  }, [router]);

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-[#502d26] border-t-[#843c2d] animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
