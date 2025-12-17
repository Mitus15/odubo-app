// ARCHIVED: Account functionality temporarily disabled for MVP
// Will be re-enabled later when accounts are needed

export default function AccountPage() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df] overflow-hidden relative">
      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-[#843c2d]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-[#b2a491]/8 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="glass-surface border border-[#502d26]/30 rounded-2xl p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          {/* Icon */}
          <div className="w-20 h-20 glass-surface border border-[#843c2d]/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(132,60,45,0.15)]">
            <svg className="w-9 h-9 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-serif font-medium text-[#ede8df] mb-3 tracking-wide">
            Account
          </h2>

          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 glass-surface border border-[#502d26]/20 rounded-full mb-6">
            <div className="w-2 h-2 bg-[#b2a491] rounded-full" />
            <span className="text-[10px] text-[#b2a491] uppercase tracking-[0.15em]">
              Coming Soon
            </span>
          </div>

          {/* Description */}
          <p className="text-[#b2a491] text-sm leading-relaxed mb-8">
            Account functionality is being refined for the best experience. Check back soon for personalized features, order history, and more.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <a
              href="/"
              className="w-full py-3 glass-surface border border-[#502d26]/30 rounded-xl text-sm text-[#ede8df] hover:bg-[#843c2d]/10 hover:border-[#843c2d]/30 transition-all duration-300 font-medium"
            >
              Return Home
            </a>
            <a
              href="/store"
              className="w-full py-3 bg-[#ede8df] text-[#302927] rounded-xl text-sm font-medium hover:bg-[#ede8df]/90 transition-all duration-300"
            >
              Browse Store
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
