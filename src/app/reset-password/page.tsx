"use client";

import Link from "next/link";

/*
// Original component commented out for MVP
export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const { searchParams } = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    if (!token || !email) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reset-password', 
          token, 
          email, 
          newPassword 
        })
      });

      if (res.ok) {
        setIsSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black text-white overflow-hidden">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
          <div className="absolute top-20 left-10 w-32 h-32 rounded-full glass-surface liquid-orb opacity-20" />
          <div className="absolute bottom-40 left-20 w-40 h-40 rounded-full liquid-glass liquid-orb opacity-25" />
          <div className="absolute inset-0 glass-morphism opacity-40" />
        </div>

        <div className="glass-surface border border-white/10 rounded-2xl p-8 w-full max-w-md z-10 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Password Reset Success!</h2>
          <p className="text-stone-400 mb-6">
            Your password has been successfully reset. You can now log in with your new password.
          </p>
          <div className="text-sm text-stone-500">
            Redirecting to login page...
          </div>
        </div>
      </div>
    );
  }

  if (error && !token && !email) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black text-white overflow-hidden">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
          <div className="absolute top-20 left-10 w-32 h-32 rounded-full glass-surface liquid-orb opacity-20" />
          <div className="absolute bottom-40 left-20 w-40 h-40 rounded-full liquid-glass liquid-orb opacity-25" />
          <div className="absolute inset-0 glass-morphism opacity-40" />
        </div>

        <div className="glass-surface border border-white/10 rounded-2xl p-8 w-full max-w-md z-10 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Invalid Reset Link</h2>
          <p className="text-stone-400 mb-6">
            {error}
          </p>
          <Link 
            href="/forgot-password" 
            className="inline-block px-6 py-3 bg-red-600/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Request New Reset
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-black text-white overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full glass-surface liquid-orb opacity-20" />
        <div className="absolute bottom-40 left-20 w-40 h-40 rounded-full liquid-glass liquid-orb opacity-25" />
        <div className="absolute inset-0 glass-morphism opacity-40" />
      </div>

      <div className="glass-surface border border-white/10 rounded-2xl p-8 w-full max-w-md z-10">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Set New Password</h1>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="sr-only">New Password</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 bg-black/20 rounded-lg border border-white/10 text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
              minLength={8}
            />
            <p className="mt-2 text-xs text-stone-500">
              Must be at least 8 characters long
            </p>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="sr-only">Confirm New Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-black/20 rounded-lg border border-white/10 text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-stone-400">
          Remember your password?{' '}
          <Link href="/login" className="text-stone-300 hover:text-red-400 transition-colors">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
*/

export default function ResetPasswordPage() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-black text-white overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full glass-surface liquid-orb opacity-20" />
        <div className="absolute bottom-40 left-20 w-40 h-40 rounded-full liquid-glass liquid-orb opacity-25" />
        <div className="absolute inset-0 glass-morphism opacity-40" />
      </div>

      <div className="glass-surface border border-white/10 rounded-2xl p-8 w-full max-w-md z-10 text-center">
        <div className="w-16 h-16 bg-[#843c2d]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#843c2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Password Reset Temporarily Disabled</h2>
        <p className="text-stone-400">
          Account functionality is currently disabled for MVP. Please check back later.
        </p>
      </div>
    </div>
  );
}
