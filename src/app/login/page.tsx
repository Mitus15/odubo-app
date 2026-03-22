"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Admin Login Page
 * Customer login handled by Shopify at account.odubo.studio
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', email, password }) });
      const data = (await res.json()) as { token?: string; is_admin?: boolean; error?: string };
      if (!res.ok) throw new Error((data && data.error) || 'Login failed');
      if (data.token) localStorage.setItem('token', data.token);

      if (data.is_admin) {
        router.replace('/admin');
      } else {
        router.replace('/');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full w-full flex items-center justify-center bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df] p-4 relative overflow-hidden">
      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#843c2d]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-[#b2a491]/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-surface border border-[#502d26]/30 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 glass-surface border border-[#843c2d]/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(132,60,45,0.15)]">
              <svg className="w-7 h-7 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h2 className="text-2xl font-serif font-medium text-[#ede8df] tracking-wide">Admin Login</h2>
            <p className="mt-2 text-sm text-[#726d6c]">Authorized personnel only</p>
          </div>

          {/* Admin Login Form */}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#b2a491] mb-1.5 uppercase tracking-wider">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                className="w-full px-4 py-3 rounded-xl bg-[#1a1817]/50 border border-[#502d26]/30 text-[#ede8df] placeholder-[#502d26] focus:outline-none focus:border-[#843c2d]/50 transition-colors"
                placeholder="info@odubo.studio"
              />
            </div>

            <div>
              <label className="block text-xs text-[#b2a491] mb-1.5 uppercase tracking-wider">Password</label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl bg-[#1a1817]/50 border border-[#502d26]/30 text-[#ede8df] placeholder-[#502d26] focus:outline-none focus:border-[#843c2d]/50 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="px-4 py-2 rounded-lg bg-[#843c2d]/10 border border-[#843c2d]/30 text-[#843c2d] text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#ede8df] text-[#302927] font-medium hover:bg-[#ede8df]/90 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Customer redirect */}
          <div className="mt-8 pt-6 border-t border-[#502d26]/20 text-center">
            <p className="text-sm text-[#726d6c]">
              Looking for your orders?{' '}
              <a
                href="https://account.odubo.studio"
                className="text-[#b2a491] hover:text-[#ede8df] transition-colors"
              >
                Customer Account
              </a>
            </p>
          </div>

          {/* Back to home */}
          <div className="mt-4 text-center">
            <Link href="/" className="text-xs text-[#502d26] hover:text-[#726d6c] transition-colors">
              ← Back to site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
