"use client";
import { useState, ReactNode } from "react";
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
  const [activeTab, setActiveTab] = useState("privacy");

  const renderContent = () => {
    switch (activeTab) {
      case "privacy":
        return (
          <div>
            <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
            <p className="text-xs text-gray-500 mb-4">
              <strong>Last Updated:</strong> July 26, 2025
            </p>
            <div className="legal-content">
              {privacyContent}
            </div>
          </div>
        );
      case "terms":
        return (
          <div>
            <h1 className="text-2xl font-bold mb-2">Terms of Service</h1>
            <p className="text-xs text-gray-500 mb-4">
              <strong>Last Updated:</strong> July 26, 2025
            </p>
            <div className="legal-content">
              {termsContent}
            </div>
          </div>
        );
      case "shipping":
        return (
          <div>
            <h1 className="text-2xl font-bold mb-2">Shipping & Returns Policy</h1>
            <p className="text-xs text-gray-500 mb-4">
              <strong>Last Updated:</strong> July 26, 2025
            </p>
            <div className="legal-content">
              {shippingContent}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 mt-8">
      <TabSwitcher onTabChange={setActiveTab} activeTab={activeTab} />
      <div className="legal-content">
        {renderContent()}
      </div>
    </div>
  );
}
