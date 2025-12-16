"use client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();

  const handleShopifySignup = () => {
    // Redirect to Shopify customer account creation
    const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
    window.location.href = `${shopifyStore}/account/register`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-red-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="glass-morphism rounded-3xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#ede8df] mb-2">Create Account</h1>
            <p className="text-[#b2a491]">Join Odubo Studio</p>
          </div>

          <div className="space-y-6">
            {/* Shopify Account Creation */}
            <div className="text-center">
              <button
                onClick={handleShopifySignup}
                className="w-full py-4 bg-gradient-to-r from-[#843c2d] to-[#502d26] text-[#ede8df] font-semibold rounded-2xl hover:from-[#b85d47] hover:to-[#843c2d] transition-all duration-200"
              >
                Create Shopify Account
              </button>
              <p className="mt-3 text-sm text-[#b2a491]">
                Create an account to shop and access exclusive content
              </p>
            </div>

            {/* Benefits */}
            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#843c2d] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-[#ede8df] font-medium">Shop Exclusive Merchandise</p>
                  <p className="text-sm text-[#b2a491]">Access to limited edition products</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#843c2d] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-[#ede8df] font-medium">Track Your Orders</p>
                  <p className="text-sm text-[#b2a491]">Easy order management and history</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#843c2d] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-[#ede8df] font-medium">Early Access</p>
                  <p className="text-sm text-[#b2a491]">Be first to know about new releases</p>
                </div>
              </div>
            </div>
          </div>

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
