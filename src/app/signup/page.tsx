"use client";
import Link from 'next/link';

export default function SignupPage() {
  const handleShopifySignup = () => {
    // Redirect to Shopify customer account creation
    const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
    window.location.href = `${shopifyStore}/account/register`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#843c2d]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-[#b2a491]/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#502d26]/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        <div className="glass-surface border border-[#502d26]/30 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 glass-surface border border-[#843c2d]/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(132,60,45,0.15)]">
              <svg className="w-7 h-7 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </div>
            <h1 className="text-2xl font-serif font-medium text-[#ede8df] mb-2 tracking-wide">Create Account</h1>
            <p className="text-[#b2a491] text-sm">Join Odubo Studio</p>
          </div>

          <div className="space-y-6">
            {/* Shopify Account Creation */}
            <div className="text-center">
              <button
                onClick={handleShopifySignup}
                className="w-full py-4 bg-[#ede8df] text-[#302927] font-medium rounded-xl hover:bg-[#ede8df]/90 transition-all duration-300 shadow-lg"
              >
                Create Shopify Account
              </button>
              <p className="mt-3 text-xs text-[#726d6c]">
                Create an account to shop and access exclusive content
              </p>
            </div>

            {/* Benefits */}
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3 p-3 glass-surface border border-[#502d26]/20 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#843c2d]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#843c2d]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[#ede8df] font-medium text-sm">Shop Exclusive Merchandise</p>
                  <p className="text-xs text-[#726d6c] mt-0.5">Access to limited edition products</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 glass-surface border border-[#502d26]/20 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#843c2d]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#843c2d]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[#ede8df] font-medium text-sm">Track Your Orders</p>
                  <p className="text-xs text-[#726d6c] mt-0.5">Easy order management and history</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 glass-surface border border-[#502d26]/20 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#843c2d]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#843c2d]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[#ede8df] font-medium text-sm">Early Access</p>
                  <p className="text-xs text-[#726d6c] mt-0.5">Be first to know about new releases</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[#726d6c]">
              Already have an account?{' '}
              <Link href="/login" className="text-[#b2a491] hover:text-[#ede8df] transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
