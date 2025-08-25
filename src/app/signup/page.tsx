// ARCHIVED: Signup functionality temporarily disabled for MVP
// Will be re-enabled later when accounts are needed

/*
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "signup", ...form }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setError('');
        // Signup successful - show verification message
        setForm({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
        // Redirect to login after 3 seconds
        setTimeout(() => router.push("/login"), 3000);
      } else {
        setError(data.error || "Signup failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-red-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="glass-morphism rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#ede8df] mb-4">Account Created!</h2>
            <p className="text-[#b2a491] mb-6">
              Please check your email and click the verification link to activate your account.
            </p>
            <div className="text-sm text-[#726d6c]">
              Redirecting to login page...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-red-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="glass-morphism rounded-3xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#ede8df] mb-2">Create Account</h1>
            <p className="text-[#b2a491]">Join Odubo Studio</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-[#b2a491] mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-[#302927]/50 border border-[#502d26]/30 rounded-2xl text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] focus:ring-1 focus:ring-[#843c2d] transition-all"
                  placeholder="First Name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-[#b2a491] mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-[#302927]/50 border border-[#502d26]/30 rounded-2xl text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] focus:ring-1 focus:ring-[#843c2d] transition-all"
                  placeholder="Last Name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#b2a491] mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-[#302927]/50 border border-[#502d26]/30 rounded-2xl text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] focus:ring-1 focus:ring-[#843c2d] transition-all"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#b2a491] mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-[#302927]/50 border border-[#502d26]/30 rounded-2xl text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] focus:ring-1 focus:ring-[#843c2d] transition-all"
                placeholder="••••••••"
              />
              <p className="mt-2 text-xs text-[#726d6c]">
                Must be at least 8 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#b2a491] mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-[#302927]/50 border border-[#502d26]/30 rounded-2xl text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] focus:ring-1 focus:ring-[#843c2d] transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-[#843c2d] to-[#502d26] text-[#ede8df] font-semibold rounded-2xl hover:from-[#b85d47] hover:to-[#843c2d] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[#b2a491]">
              Already have an account?{' '}
              <Link href="/login" className="text-stone-300 hover:text-red-400 transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
*/

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-red-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="glass-morphism rounded-3xl p-8 text-center">
          <div className="w-16 h-16 bg-[#843c2d]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#843c2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#ede8df] mb-4">Signup Temporarily Disabled</h2>
          <p className="text-[#b2a491]">
            Account functionality is currently disabled for MVP. Please check back later.
          </p>
        </div>
      </div>
    </div>
  );
}