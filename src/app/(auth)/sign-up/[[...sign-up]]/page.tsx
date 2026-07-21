'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          email,
          password,
          username,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      const data = await res.json() as { error?: string; message?: string };

      if (!res.ok) {
        setError(data.error || 'Sign up failed');
        return;
      }

      setSuccess(data.message || 'Account created! Please check your email to verify.');
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
          <h1 className="text-2xl font-bold text-[#ede8df] text-center mb-2">Create Account</h1>
          <p className="text-[#b2a491] text-center mb-6">Join Odubo Studio</p>

          {error && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-800/30 text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-[#252221] border border-[#502d26]/30 text-[#ede8df] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#843c2d]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#b2a491] mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-[#252221] border border-[#502d26]/30 text-[#ede8df] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#843c2d]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#b2a491] mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#252221] border border-[#502d26]/30 text-[#ede8df] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[#843c2d]"
                required
              />
            </div>
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
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#843c2d] hover:bg-[#9a4636] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/sign-in" className="text-[#843c2d] hover:text-[#9a4636] text-sm">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
