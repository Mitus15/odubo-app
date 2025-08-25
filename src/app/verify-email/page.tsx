// ARCHIVED: Email verification functionality temporarily disabled for MVP
// Will be re-enabled later when accounts are needed

export default function VerifyEmailPage() {
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
        <h2 className="text-2xl font-bold text-white mb-4">Email Verification Temporarily Disabled</h2>
        <p className="text-stone-400">
          Account functionality is currently disabled for MVP. Please check back later.
        </p>
      </div>
    </div>
  );
}
