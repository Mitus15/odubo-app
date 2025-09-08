"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
      // Store token for client-side checks (cookie also set by server when possible)
      if (data.token) localStorage.setItem('token', data.token);
      router.replace('/admin');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full w-full flex items-center justify-center bg-gradient-to-br from-stone-950 via-stone-900 to-red-950 text-white">
      <form onSubmit={submit} className="glass-surface border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Sign in</h2>
        <label className="block text-sm mb-1">Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="w-full mb-3 px-3 py-2 rounded bg-[#171616] border border-white/10" />
        <label className="block text-sm mb-1">Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="w-full mb-4 px-3 py-2 rounded bg-[#171616] border border-white/10" />
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-2 rounded bg-[#ede8df] text-[#171616] hover:bg-[#d9d3c9]">{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}