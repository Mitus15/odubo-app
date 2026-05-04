'use client';

import { UserButton } from '@clerk/nextjs';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';

export function AuthButton() {
  return (
    <>
      <SignedOut>
        <Link
          href="/sign-in"
          className="text-sm text-[#b2a491] hover:text-[#ede8df] transition-colors"
        >
          Sign In
        </Link>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
            },
          }}
          afterSignOutUrl="/"
        />
      </SignedIn>
    </>
  );
}

export function AuthButtonLarge() {
  return (
    <>
      <SignedOut>
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
      </SignedOut>
      <SignedIn>
        <Link
          href="/mymoments"
          className="px-6 py-3 bg-[#843c2d] hover:bg-[#9a4636] text-white text-center font-medium rounded-lg transition-colors"
        >
          My Moments
        </Link>
      </SignedIn>
    </>
  );
}
