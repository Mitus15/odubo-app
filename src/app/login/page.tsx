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
      
      // Redirect based on role
      if (data.is_admin) {
        router.replace('/admin');
      } else {
        // Regular users go to home or clips
        router.replace('/');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleShopifyLogin = () => {
    // Redirect to Shopify customer login
    const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
    window.location.href = `${shopifyStore}/account/login`;
  };

  return (
    <div className="min-h-full w-full flex items-center justify-center bg-gradient-to-br from-stone-950 via-stone-900 to-red-950 text-white p-4">
      <div className="glass-surface border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign in</h2>
        
        {/* Regular User - Shopify Account */}
        <div className="mb-6">
          <button
            onClick={handleShopifyLogin}
            className="w-full py-3 rounded-lg bg-[#843c2d] hover:bg-[#6d3123] text-[#ede8df] font-medium transition-colors"
          >
            Sign in with Shopify Account
          </button>
          <p className="mt-2 text-xs text-[#b2a491] text-center">
            For customers and regular users
          </p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#171616] text-[#b2a491]">or</span>
          </div>
        </div>

        {/* Admin Login */}
        <form onSubmit={submit}>
          <p className="text-xs text-[#b2a491] mb-3 text-center">Admin Access</p>
          <label className="block text-sm mb-1">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="w-full mb-3 px-3 py-2 rounded bg-[#171616] border border-white/10" />
          <label className="block text-sm mb-1">Password</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="w-full mb-4 px-3 py-2 rounded bg-[#171616] border border-white/10" />
          {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-2 rounded bg-[#ede8df] text-[#171616] hover:bg-[#d9d3c9]">{loading ? 'Signing in…' : 'Admin Sign in'}</button>
        </form>

        <div className="mt-4 text-center text-sm text-[#b2a491]">
          Don't have a Shopify account?{' '}
          <a href="/signup" className="text-[#ede8df] hover:text-[#b2a491] transition-colors">
            Create one
          </a>
        </div>
      </div>
    </div>
  );
}