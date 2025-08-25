import LegalClient from "./LegalClient";

// Static content that can be served from the server
const legalContent = {
  privacy: `
    <p>Odubo Studio ("we," "us," or "our") is built on a foundation of trust. We understand that trusting us with your personal information is a big deal, and we don't take it lightly.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Information We Collect</h2>
    <p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">How We Use Your Information</h2>
    <p>We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Information Sharing</h2>
    <p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Contact Us</h2>
    <p>If you have any questions about this Privacy Policy, please contact us at privacy@odubo.com.</p>
  `,
  
  terms: `
    <p>Welcome to Odubo Studio. These Terms of Service ("Terms") govern your access to and use of the Odubo Studio website and services.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Acceptance of Terms</h2>
    <p>By accessing or using our services, you agree to be bound by these Terms and our Privacy Policy.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Use of Services</h2>
    <p>You may use our services only in compliance with these Terms and all applicable laws and regulations.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Intellectual Property</h2>
    <p>All content and materials available on our website are protected by intellectual property rights.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Contact Information</h2>
    <p>Questions about the Terms of Service should be sent to us at legal@odubo.com.</p>
  `,
  
  shipping: `
    <p>We are a small studio, and many items are made with care. Here's what you need to know about shipping and returns:</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Shipping Policy</h2>
    <p>Orders are typically processed within 1-3 business days. Shipping times vary based on your location and selected shipping method.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Returns</h2>
    <p>We accept returns within 30 days of delivery for most items in original condition. Custom or personalized items may not be returnable.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Exchanges</h2>
    <p>We're happy to exchange items for different sizes or colors when available.</p>
    
    <h2 class="text-xl font-semibold mt-6 mb-3">Questions?</h2>
    <p>Contact our support team at support@odubo.com for any shipping or returns questions.</p>
  `
};

export default function LegalPage() {
  return (
    <LegalClient 
      privacyContent={legalContent.privacy}
      termsContent={legalContent.terms}
      shippingContent={legalContent.shipping}
    />
  );
}
