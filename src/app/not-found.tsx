import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] px-4">
      <div className="max-w-md w-full text-center">
        {/* B.A.A.D Logo Mark */}
        <div className="mb-8">
          <Image
            src="/brand-logos/baad-icon.svg"
            alt="B.A.A.D"
            width={48}
            height={48}
            className="mx-auto opacity-40"
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-serif font-medium text-[#ede8df] mb-3">
          This page doesn&rsquo;t exist.
        </h1>

        {/* Description */}
        <p className="text-[#b2a491] mb-8">
          The page you&rsquo;re looking for may have moved or no longer exists.
        </p>

        {/* Single CTA — master button handles the rest */}
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl bg-[#843c2d] text-[#ede8df] font-medium hover:bg-[#6d3224] transition-colors"
        >
          Enter the Studio
        </Link>
      </div>
    </div>
  );
}
