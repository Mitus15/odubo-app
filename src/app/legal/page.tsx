import LegalClient from "./LegalClient";
import { Suspense } from "react";

// Convert HTML content to React components for security
const LegalContent = {
  privacy: (
    <>
      <p className="text-base">Odubo Studio ("we," "us," or "our") is built on a foundation of trust. We understand that trusting us with your personal information is a big deal, and we don't take it lightly.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Information We Collect</h2>
      <p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us. This may include your name, email address, shipping address, and payment information.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">How We Use Your Information</h2>
      <p>We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you about orders, products, and promotional offers.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Information Sharing</h2>
      <p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as necessary to fulfill orders (such as shipping carriers) or as required by law.</p>

      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Data Security</h2>
      <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us at <span className="text-[#ede8df]">privacy@odubo.com</span>.</p>
    </>
  ),
  
  terms: (
    <>
      <p className="text-base">Welcome to Odubo Studio. These Terms of Service ("Terms") govern your access to and use of the Odubo Studio website and services.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Acceptance of Terms</h2>
      <p>By accessing or using our services, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these terms, please do not use our services.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Use of Services</h2>
      <p>You may use our services only in compliance with these Terms and all applicable laws and regulations. You agree not to misuse our services or help anyone else do so.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Intellectual Property</h2>
      <p>All content and materials available on our website, including but not limited to text, graphics, logos, images, audio, video, and software, are the property of Odubo Studio and are protected by intellectual property laws.</p>

      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Limitation of Liability</h2>
      <p>Odubo Studio shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Contact Information</h2>
      <p>Questions about the Terms of Service should be sent to us at <span className="text-[#ede8df]">legal@odubo.com</span>.</p>
    </>
  ),
  
  shipping: (
    <>
      <p className="text-base">We are a small studio, and many items are crafted with care. Here's what you need to know about shipping and returns:</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Processing Time</h2>
      <p>Orders are typically processed within 1-3 business days. During high-volume periods or for custom items, processing may take longer.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Shipping Options</h2>
      <p>We offer standard and expedited shipping options. Shipping times vary based on your location. You will receive tracking information once your order ships.</p>

      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">International Shipping</h2>
      <p>We ship internationally to select countries. International customers are responsible for any customs duties or import taxes.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Returns</h2>
      <p>We accept returns within 30 days of delivery for most items in original, unworn condition with tags attached. Custom or personalized items are final sale.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Exchanges</h2>
      <p>We're happy to exchange items for different sizes or colors when available. Contact us to arrange an exchange.</p>
      
      <h2 className="text-lg font-semibold mt-8 mb-3 text-[#ede8df]">Questions?</h2>
      <p>Contact our support team at <span className="text-[#ede8df]">support@odubo.com</span> for any shipping or returns questions.</p>
    </>
  )
};

export default function LegalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0b0b]" />}>
      <LegalClient 
        privacyContent={LegalContent.privacy}
        termsContent={LegalContent.terms}
        shippingContent={LegalContent.shipping}
      />
    </Suspense>
  );
}
