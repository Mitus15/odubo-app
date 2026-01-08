"use client";
import { useState, useEffect, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TabSwitcher from "./TabSwitcher";

interface LegalClientProps {
  privacyContent: ReactNode;
  termsContent: ReactNode;
  shippingContent: ReactNode;
}

export default function LegalClient({ 
  privacyContent, 
  termsContent, 
  shippingContent 
}: LegalClientProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("privacy");

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['privacy', 'terms', 'shipping'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const renderContent = () => {
    switch (activeTab) {
      case "privacy":
        return (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df] mb-6">Privacy Policy</h1>
            <div className="legal-content text-[#c7b8a8] leading-relaxed space-y-4">
              {privacyContent}
            </div>
          </div>
        );
      case "terms":
        return (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df] mb-6">Terms of Service</h1>
            <div className="legal-content text-[#c7b8a8] leading-relaxed space-y-4">
              {termsContent}
            </div>
          </div>
        );
      case "shipping":
        return (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df] mb-6">Shipping & Returns</h1>
            <div className="legal-content text-[#c7b8a8] leading-relaxed space-y-4">
              {shippingContent}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b0b0b] via-[#111111] to-[#0b0b0b]">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-[#843c2d22] via-[#ff8a4a11] to-transparent blur-3xl" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-gradient-to-br from-[#b2a49111] via-[#ede8df0a] to-transparent blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/store" className="inline-block mb-6">
            <span className="text-xs uppercase tracking-[0.3em] text-[#b2a491]/50 hover:text-[#ede8df] transition-colors">
              ← Back to Shop
            </span>
          </Link>
          <h2 className="text-[10px] uppercase tracking-[0.4em] text-[#843c2d] mb-2">Legal</h2>
        </div>

        {/* Tabs */}
        <div className="mb-10">
          <TabSwitcher onTabChange={setActiveTab} activeTab={activeTab} />
        </div>

        {/* Content Card */}
        <div className="rounded-3xl border border-[#502d26]/20 bg-[#1a1615]/40 backdrop-blur-sm p-6 sm:p-10">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#502d26]/40">
            © {new Date().getFullYear()} Odubo Studio
          </p>
        </div>
      </div>
    </div>
  );
}
