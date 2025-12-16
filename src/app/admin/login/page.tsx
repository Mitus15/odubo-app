"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      
      const data = (await res.json()) as { token?: string; is_admin?: boolean; error?: string };
      
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      // Admin login requires is_admin === true
      if (!data.is_admin) {
        throw new Error('Admin access required. Please use the regular login page.');
      }
      
      // Store token
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      // Redirect to admin dashboard
      router.replace('/admin');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full w-full flex items-center justify-center bg-gradient-to-br from-stone-950 via-stone-900 to-red-950 text-white">
      <div className="w-full max-w-md">
        <form onSubmit={submit} className="glass-surface border border-white/10 rounded-2xl p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#ede8df]">Admin Login</h2>
            <p className="text-sm text-[#b2a491] mt-1">Sign in to access the admin dashboard</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#b2a491] mb-1">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                className="w-full px-3 py-2 rounded bg-[#171616] border border-white/10 text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                placeholder="admin@example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm text-[#b2a491] mb-1">Password</label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                required
                className="w-full px-3 py-2 rounded bg-[#171616] border border-white/10 text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                placeholder="••••••••"
              />
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2 rounded bg-[#ede8df] text-[#171616] font-medium hover:bg-[#d9d3c9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-sm text-[#726d6c] text-center">
              Not an admin?{' '}
              <Link href="/login" className="text-[#b2a491] hover:text-[#ede8df] transition-colors">
                Use regular login
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
