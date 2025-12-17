export default function SearchPage() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df] relative overflow-hidden">
      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#843c2d]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#b2a491]/6 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#502d26]/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-lg">
        {/* Glass search icon container */}
        <div className="inline-flex items-center justify-center w-24 h-24 glass-surface border border-[#502d26]/30 rounded-full mb-8 shadow-[0_0_60px_rgba(132,60,45,0.15)]">
          <svg
            className="w-10 h-10 text-[#843c2d]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-serif font-medium mb-4 text-[#ede8df] tracking-wide">
          Search
        </h1>

        {/* Subtitle */}
        <p className="text-[#b2a491] text-base sm:text-lg mb-8 font-light tracking-wide">
          Discover music, videos, and moments
        </p>

        {/* Decorative search input placeholder */}
        <div className="glass-surface border border-[#502d26]/30 rounded-2xl p-1 mb-8 shadow-lg">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1817]/50 rounded-xl">
            <svg
              className="w-5 h-5 text-[#502d26]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <span className="text-[#502d26] text-sm tracking-wide">Search for anything...</span>
          </div>
        </div>

        {/* Coming soon badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 glass-surface border border-[#843c2d]/20 rounded-full">
          <div className="w-2 h-2 bg-[#843c2d] rounded-full animate-pulse shadow-[0_0_8px_rgba(132,60,45,0.5)]" />
          <span className="text-xs text-[#b2a491] uppercase tracking-[0.2em] font-medium">
            Coming Soon
          </span>
        </div>

        {/* Quick links */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/media"
            className="px-5 py-2.5 glass-surface border border-[#502d26]/20 rounded-xl text-sm text-[#b2a491] hover:text-[#ede8df] hover:border-[#843c2d]/30 hover:bg-[#843c2d]/5 transition-all duration-300"
          >
            Browse Media
          </a>
          <a
            href="/store"
            className="px-5 py-2.5 glass-surface border border-[#502d26]/20 rounded-xl text-sm text-[#b2a491] hover:text-[#ede8df] hover:border-[#843c2d]/30 hover:bg-[#843c2d]/5 transition-all duration-300"
          >
            Visit Store
          </a>
          <a
            href="/moments"
            className="px-5 py-2.5 glass-surface border border-[#502d26]/20 rounded-xl text-sm text-[#b2a491] hover:text-[#ede8df] hover:border-[#843c2d]/30 hover:bg-[#843c2d]/5 transition-all duration-300"
          >
            View Moments
          </a>
        </div>
      </div>
    </div>
  );
}
