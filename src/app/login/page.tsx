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
    // Use Shopify Customer Account API v2 OAuth
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Store for verification in callback
    sessionStorage.setItem('shopify_auth_state', state);
    sessionStorage.setItem('shopify_auth_nonce', nonce);
    
    // Build OAuth authorization URL
    const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubo.studio';
    const clientId = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID || '843046fe-e8cb-4fd1-9f46-ac5c8acd876b';
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://odubo.com'}/api/auth/shopify/callback`;
    
    const authUrl = new URL(`${shopifyStore}/account/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', 'openid email customer-account-api:full');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    
    window.location.href = authUrl.toString();
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-2xl font-serif font-medium text-[#ede8df] tracking-wide">Sign In</h2>
          </div>

          {/* Regular User - Shopify Account */}
          <div className="mb-6">
            <button
              onClick={handleShopifyLogin}
              className="w-full py-3.5 rounded-xl bg-[#ede8df] text-[#302927] font-medium hover:bg-[#ede8df]/90 transition-all duration-300 shadow-lg"
            >
              Sign in with Shopify Account
            </button>
            <p className="mt-2 text-xs text-[#726d6c] text-center">
              For customers and regular users
            </p>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#502d26]/30"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-[#726d6c] bg-transparent">or</span>
            </div>
          </div>

          {/* Admin Login */}
          <form onSubmit={submit} className="space-y-4">
            <p className="text-[10px] text-[#726d6c] text-center uppercase tracking-[0.15em]">Admin Access</p>

            <div>
              <label className="block text-xs text-[#b2a491] mb-1.5 uppercase tracking-wider">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                className="w-full px-4 py-3 rounded-xl bg-[#1a1817]/50 border border-[#502d26]/30 text-[#ede8df] placeholder-[#502d26] focus:outline-none focus:border-[#843c2d]/50 transition-colors"
                placeholder="admin@odubo.com"
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
              className="w-full py-3.5 rounded-xl glass-surface border border-[#502d26]/30 text-[#ede8df] font-medium hover:bg-[#843c2d]/10 hover:border-[#843c2d]/30 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Admin Sign In'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#726d6c]">
              Don't have an account?{' '}
              <a href="/signup" className="text-[#b2a491] hover:text-[#ede8df] transition-colors">
                Create one
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
