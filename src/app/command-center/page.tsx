'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CommandCenterShell } from './components/CommandCenterShell';

type User = {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer' | null;
  is_admin: boolean;
};

export default function CommandCenterPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as { authenticated?: boolean; user?: any };
          if (data.authenticated && data.user) {
            const role = data.user.role || (data.user.is_admin ? 'admin' : null);
            if (role === 'admin' || role === 'editor') {
              setUser({ ...data.user, role, is_admin: data.user.is_admin || false });
            }
          }
        }
      } catch (e) {
        console.warn('[Command Center] Auth error', e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: loginEmail, password: loginPassword }),
        credentials: 'include',
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        setLoginError(data.error || 'Login failed');
        return;
      }
      if (data.token) localStorage.setItem('token', data.token);
      window.location.reload();
    } catch {
      setLoginError('An error occurred.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#726d6c]">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  // Login required
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🎛️</div>
            <h1 className="text-xl font-semibold text-[#ede8df] mb-1">Command Center</h1>
            <p className="text-sm text-[#726d6c]">Admin access required</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-[#726d6c] mb-1.5">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d] transition-colors"
                placeholder="admin@odubo.studio"
              />
            </div>

            <div>
              <label className="block text-xs text-[#726d6c] mb-1.5">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#171616] border border-[#502d26]/40 text-sm focus:outline-none focus:border-[#843c2d] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-[#ede8df] text-[#171616] text-sm font-semibold hover:bg-white disabled:opacity-50 transition-colors"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main shell
  return <CommandCenterShell user={user} />;
}
