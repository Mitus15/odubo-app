'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const [orderInfo, setOrderInfo] = useState<any>(null);
  
  useEffect(() => {
    // Get order details from URL params if available
    if (searchParams) {
      const orderId = searchParams.get('order_id');
      const orderNumber = searchParams.get('order_number');
      
      if (orderId || orderNumber) {
        setOrderInfo({
          orderId,
          orderNumber
        });
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1817] via-[#302927] to-[#1a1817] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-gradient-to-br from-[#302927]/80 to-[#1a1817]/80 backdrop-blur-xl rounded-2xl border border-[#502d26]/30 p-8 md:p-12 text-center shadow-2xl">
          {/* Success Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-3xl md:text-4xl font-bold text-[#ede8df] mb-3">
            Thank You!
          </h1>
          
          <p className="text-lg text-[#ede8df]/70 mb-8">
            Your order has been successfully placed
          </p>

          {/* Order Info */}
          {orderInfo?.orderNumber && (
            <div className="mb-8 p-4 bg-[#502d26]/20 rounded-lg border border-[#843c2d]/30">
              <p className="text-sm text-[#ede8df]/60 mb-1">Order Number</p>
              <p className="text-2xl font-bold text-[#ede8df]">#{orderInfo.orderNumber}</p>
            </div>
          )}

          {/* Info Text */}
          <div className="space-y-4 mb-8 text-left">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#843c2d]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-[#ede8df]/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-[#ede8df]/80 font-medium mb-1">Order Confirmation</p>
                <p className="text-sm text-[#ede8df]/60">
                  We've sent a confirmation email with your order details and tracking information.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#843c2d]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-[#ede8df]/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div>
                <p className="text-[#ede8df]/80 font-medium mb-1">Processing</p>
                <p className="text-sm text-[#ede8df]/60">
                  Your order is being prepared and will ship within 1-3 business days.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#843c2d]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-[#ede8df]/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[#ede8df]/80 font-medium mb-1">Delivery</p>
                <p className="text-sm text-[#ede8df]/60">
                  You'll receive a tracking number once your order ships.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/shop"
              className="px-6 py-3 bg-gradient-to-r from-[#843c2d] to-[#502d26] text-[#ede8df] rounded-lg font-medium hover:from-[#9a4837] hover:to-[#5f3429] transition-all shadow-lg"
            >
              Continue Shopping
            </a>
            
            <a
              href="https://odubo.studio/account"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border border-[#502d26] text-[#ede8df] rounded-lg font-medium hover:bg-[#502d26]/20 transition-all"
            >
              View Order Status
            </a>
          </div>

          {/* Support */}
          <p className="mt-8 text-sm text-[#ede8df]/50">
            Questions? Contact us at{' '}
            <a href="mailto:info@odubo.studio" className="text-[#b2a491] hover:text-[#ede8df] transition-colors">
              info@odubo.studio
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#1a1817] via-[#302927] to-[#1a1817] flex items-center justify-center">
        <div className="text-[#ede8df]">Loading...</div>
      </div>
    }>
      <ThankYouContent />
    </Suspense>
  );
}