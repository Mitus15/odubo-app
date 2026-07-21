'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });

      const data = await res.json() as { error?: string; token?: string; is_admin?: boolean };

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Store token
      localStorage.setItem('token', data.token || '');

      // Redirect based on admin status
      if (data.is_admin) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/mymoments';
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0c0b] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#1a1918] border border-[#502d26]/30 rounded-xl p-8">
          <h1 className="text-2xl font-bold text-[#ede8df] text-center mb-2">Sign In</h1>
          <p className="text-[#b2a491] text-center mb-6">Welcome back to Odubo</p>

          {error && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[#b2a491] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#252221] border border-[#502d26]/30 text-[#ede8df] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#843c2d]"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#b2a491] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#252221] border border-[#502d26]/30 text-[#ede8df] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#843c2d]"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#843c2d] hover:bg-[#9a4636] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/sign-up" className="text-[#843c2d] hover:text-[#9a4636] text-sm">
              Don't have an account? Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
