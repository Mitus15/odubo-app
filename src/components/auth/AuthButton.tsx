'use client';

import Link from 'next/link';

export function AuthButton() {
  return (
    <Link
      href="/sign-in"
      className="text-sm text-[#b2a491] hover:text-[#ede8df] transition-colors"
    >
      Sign In
    </Link>
  );
}

export function AuthButtonLarge() {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/sign-in"
        className="w-full px-6 py-3 bg-[#843c2d] hover:bg-[#9a4636] text-white text-center font-medium rounded-lg transition-colors"
      >
        Sign In
      </Link>
      <Link
        href="/sign-up"
        className="w-full px-6 py-3 bg-[#252221] hover:bg-[#2d2a27] text-[#ede8df] text-center font-medium rounded-lg border border-[#502d26]/30 transition-colors"
      >
        Create Account
      </Link>
    </div>
  );
}
