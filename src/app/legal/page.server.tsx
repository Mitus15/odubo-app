import LegalClient from "./LegalClient";

// Static content that can be served from the server
const legalContent = {
  privacy: `
    <p class="text-sm text-[#b2a491]/70 mb-6">Last updated: December 25, 2025</p>

    <p>B.A.A.D by Odubo operates this store and website, including all related information, content, features, tools, products and services, in order to provide you, the customer, with a curated shopping experience (the "Services"). B.A.A.D by Odubo is powered by Shopify, which enables us to provide the Services to you. This Privacy Policy describes how we collect, use, and disclose your personal information when you visit, use, or make a purchase or other transaction using the Services or otherwise communicate with us. If there is a conflict between our Terms of Service and this Privacy Policy, this Privacy Policy controls with respect to the collection, processing, and disclosure of your personal information.</p>

    <p class="mt-4">Please read this Privacy Policy carefully. By using and accessing any of the Services, you acknowledge that you have read this Privacy Policy and understand the collection, use, and disclosure of your information as described in this Privacy Policy.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Personal Information We Collect or Process</h2>
    <p>When we use the term "personal information," we are referring to information that identifies or can reasonably be linked to you or another person. Personal information does not include information that is collected anonymously or that has been de-identified, so that it cannot identify or be reasonably linked to you. We may collect or process the following categories of personal information, including inferences drawn from this personal information, depending on how you interact with the Services, where you live, and as permitted or required by applicable law:</p>

    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li><strong>Contact details</strong> including your name, address, billing address, shipping address, phone number, and email address.</li>
      <li><strong>Financial information</strong> including credit card, debit card, and financial account numbers, payment card information, financial account information, transaction details, form of payment, payment confirmation and other payment details.</li>
      <li><strong>Account information</strong> including your username, password, security questions, preferences and settings.</li>
      <li><strong>Transaction information</strong> including the items you view, put in your cart, add to your wishlist, or purchase, return, exchange or cancel and your past transactions.</li>
      <li><strong>Communications with us</strong> including the information you include in communications with us, for example, when sending a customer support inquiry.</li>
      <li><strong>Device information</strong> including information about your device, browser, or network connection, your IP address, and other unique identifiers.</li>
      <li><strong>Usage information</strong> including information regarding your interaction with the Services, including how and when you interact with or navigate the Services.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Personal Information Sources</h2>
    <p>We may collect personal information from the following sources:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li><strong>Directly from you</strong> including when you create an account, visit or use the Services, communicate with us, or otherwise provide us with your personal information;</li>
      <li><strong>Automatically through the Services</strong> including from your device when you use our products or services or visit our websites, and through the use of cookies and similar technologies;</li>
      <li><strong>From our service providers</strong> including when we engage them to enable certain technology and when they collect or process your personal information on our behalf;</li>
      <li><strong>From our partners or other third parties.</strong></li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">How We Use Your Personal Information</h2>
    <p>Depending on how you interact with us or which of the Services you use, we may use personal information for the following purposes:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li><strong>Provide, Tailor, and Improve the Services.</strong> We use your personal information to provide you with the Services, including to perform our contract with you, to process your payments, to fulfill your orders, to remember your preferences and items you are interested in, to send notifications to you related to your account, to process purchases, returns, exchanges or other transactions, to create, maintain and otherwise manage your account, to arrange for shipping, to facilitate any returns and exchanges, to enable you to post reviews, and to create a customized shopping experience for you, such as recommending products related to your purchases.</li>
      <li><strong>Marketing and Advertising.</strong> We use your personal information for marketing and promotional purposes, such as to send marketing, advertising and promotional communications by email, text message or postal mail, and to show you online advertisements for products or services on the Services or other websites.</li>
      <li><strong>Security and Fraud Prevention.</strong> We use your personal information to authenticate your account, to provide a secure payment and shopping experience, detect, investigate or take action regarding possible fraudulent, illegal, unsafe, or malicious activity, protect public safety, and to secure our services.</li>
      <li><strong>Communicating with You.</strong> We use your personal information to provide you with customer support, to be responsive to you, to provide effective services to you and to maintain our business relationship with you.</li>
      <li><strong>Legal Reasons.</strong> We use your personal information to comply with applicable law or respond to valid legal process, including requests from law enforcement or government agencies.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">How We Disclose Personal Information</h2>
    <p>In certain circumstances, we may disclose your personal information to third parties for legitimate purposes subject to this Privacy Policy. Such circumstances may include:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li>With Shopify, vendors and other third parties who perform services on our behalf (e.g. IT management, payment processing, data analytics, customer support, cloud storage, fulfillment and shipping).</li>
      <li>With business and marketing partners to provide marketing services and advertise to you.</li>
      <li>When you direct, request us or otherwise consent to our disclosure of certain information to third parties.</li>
      <li>With our affiliates or otherwise within our corporate group.</li>
      <li>In connection with a business transaction such as a merger or bankruptcy, to comply with any applicable legal obligations, to enforce any applicable terms of service or policies, and to protect or defend the Services, our rights, and the rights of our users or others.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Relationship with Shopify</h2>
    <p>The Services are hosted by Shopify, which collects and processes personal information about your access to and use of the Services in order to provide and improve the Services for you. Information you submit to the Services will be transmitted to and shared with Shopify as well as third parties that may be located in countries other than where you reside. To learn more about how Shopify uses your personal information and any rights you may have, you can visit the <a href="https://www.shopify.com/legal/privacy" class="text-[#843c2d] hover:underline" target="_blank" rel="noopener noreferrer">Shopify Consumer Privacy Policy</a>.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Third Party Websites and Links</h2>
    <p>The Services may provide links to websites or other online platforms operated by third parties. If you follow links to sites not affiliated or controlled by us, you should review their privacy and security policies and other terms and conditions. We do not guarantee and are not responsible for the privacy or security of such sites, including the accuracy, completeness, or reliability of information found on these sites.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Children's Data</h2>
    <p>The Services are not intended to be used by children, and we do not knowingly collect any personal information about children under the age of majority in your jurisdiction. If you are the parent or guardian of a child who has provided us with their personal information, you may contact us using the contact details set out below to request that it be deleted.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Security and Retention of Your Information</h2>
    <p>Please be aware that no security measures are perfect or impenetrable, and we cannot guarantee "perfect security." In addition, any information you send to us may not be secure while in transit. We recommend that you do not use unsecure channels to communicate sensitive or confidential information to us. How long we retain your personal information depends on different factors, such as whether we need the information to maintain your account, to provide you with Services, comply with legal obligations, resolve disputes or enforce other applicable contracts and policies.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Your Rights and Choices</h2>
    <p>Depending on where you live, you may have some or all of the rights listed below in relation to your personal information:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li><strong>Right to Access / Know.</strong> You may have a right to request access to personal information that we hold about you.</li>
      <li><strong>Right to Delete.</strong> You may have a right to request that we delete personal information we maintain about you.</li>
      <li><strong>Right to Correct.</strong> You may have a right to request that we correct inaccurate personal information we maintain about you.</li>
      <li><strong>Right of Portability.</strong> You may have a right to receive a copy of the personal information we hold about you and to request that we transfer it to a third party.</li>
      <li><strong>Managing Communication Preferences.</strong> We may send you promotional emails, and you may opt out of receiving these at any time by using the unsubscribe option displayed in our emails to you.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">International Transfers</h2>
    <p>Please note that we may transfer, store and process your personal information outside the country you live in. If we transfer your personal information out of the European Economic Area or the United Kingdom, we will rely on recognized transfer mechanisms like the European Commission's Standard Contractual Clauses.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Changes to This Privacy Policy</h2>
    <p>We may update this Privacy Policy from time to time, including to reflect changes to our practices or for other operational, legal, or regulatory reasons. We will post the revised Privacy Policy on this website and update the "Last updated" date.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Contact</h2>
    <p>Should you have any questions about our privacy practices or this Privacy Policy, or if you would like to exercise any of the rights available to you, please email us at <a href="mailto:maniodubo@gmail.com" class="text-[#843c2d] hover:underline">maniodubo@gmail.com</a> or contact us at:</p>
    <p class="mt-2 ml-4">444 Saint Paul Street<br/>Kamloops, BC, V2C 0L2<br/>Canada</p>
  `,

  terms: `
    <p class="text-sm text-[#b2a491]/70 mb-6">Last updated: December 25, 2025</p>

    <p>Welcome to B.A.A.D by Odubo. These Terms of Service ("Terms") constitute a legally binding agreement between you and B.A.A.D by Odubo ("we," "us," or "our") governing your access to and use of the odubo.studio website, mobile applications, and all related services, content, and products (collectively, the "Services").</p>

    <p class="mt-4 font-semibold text-[#ede8df]">PLEASE READ THESE TERMS CAREFULLY BEFORE USING THE SERVICES. BY ACCESSING OR USING ANY PART OF THE SERVICES, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE TO ALL THE TERMS, DO NOT ACCESS OR USE THE SERVICES.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">1. Acceptance of Terms</h2>
    <p>By accessing or using the Services, you represent that you are at least 18 years of age, or the age of legal majority in your jurisdiction, and have the legal capacity to enter into these Terms. If you are using the Services on behalf of a business or other entity, you represent that you have the authority to bind such entity to these Terms.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">2. Changes to Terms</h2>
    <p>We reserve the right to modify these Terms at any time at our sole discretion. If we make material changes, we will notify you by updating the "Last updated" date above and, where appropriate, provide additional notice. Your continued use of the Services after any such changes constitutes your acceptance of the new Terms. If you do not agree to any changes, you must stop using the Services immediately.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">3. Account Registration</h2>
    <p>To access certain features of the Services, you may be required to create an account. You agree to:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li>Provide accurate, current, and complete information during registration;</li>
      <li>Maintain and promptly update your account information;</li>
      <li>Maintain the security and confidentiality of your login credentials;</li>
      <li>Accept responsibility for all activities that occur under your account;</li>
      <li>Notify us immediately of any unauthorized use of your account.</li>
    </ul>
    <p class="mt-3">We reserve the right to suspend or terminate your account at any time for any reason, including violation of these Terms.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">4. Products and Services</h2>
    <p>All products and services offered through the Services are subject to availability. We reserve the right to:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li>Limit quantities of any products or services;</li>
      <li>Discontinue any product or service at any time;</li>
      <li>Refuse service to anyone for any reason;</li>
      <li>Modify or discontinue features of the Services without notice.</li>
    </ul>
    <p class="mt-3">Product descriptions, images, and specifications are provided for informational purposes only. We do not warrant that product descriptions or other content is accurate, complete, reliable, current, or error-free. Colors may vary due to monitor settings and manufacturing processes.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">5. Pricing and Payment</h2>
    <p>All prices are displayed in the applicable currency and are subject to change without notice. We reserve the right to correct any pricing errors. Payment must be made through our approved payment processors (currently Shopify Payments). By providing payment information, you represent that you are authorized to use the payment method and authorize us to charge the full amount.</p>
    <p class="mt-3">You are responsible for any applicable taxes, duties, or fees associated with your purchase.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">6. Intellectual Property Rights</h2>
    <p>The Services and all content, features, and functionality (including but not limited to all information, software, text, displays, images, video, audio, music, designs, and the design, selection, and arrangement thereof) are owned by B.A.A.D by Odubo, its licensors, or other providers of such material and are protected by copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.</p>
    <p class="mt-3">You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Services for personal, non-commercial purposes only. You may not:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li>Copy, modify, distribute, sell, or lease any part of the Services;</li>
      <li>Reverse engineer or attempt to extract the source code of the Services;</li>
      <li>Remove any copyright, trademark, or other proprietary notices;</li>
      <li>Use the Services for any commercial purpose without our express written consent;</li>
      <li>Use any data mining, robots, or similar data gathering methods.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">7. User Content</h2>
    <p>You may have the opportunity to submit content through the Services, including reviews, comments, and other materials ("User Content"). By submitting User Content, you grant us a non-exclusive, worldwide, royalty-free, perpetual, irrevocable, sublicensable right to use, reproduce, modify, adapt, publish, translate, distribute, and display such content in any media.</p>
    <p class="mt-3">You represent and warrant that you own or have the necessary rights to submit User Content and that such content does not violate any third-party rights or applicable laws.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">8. Prohibited Conduct</h2>
    <p>You agree not to:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li>Use the Services for any unlawful purpose or in violation of these Terms;</li>
      <li>Impersonate any person or entity or misrepresent your affiliation;</li>
      <li>Interfere with or disrupt the Services or servers or networks connected to the Services;</li>
      <li>Attempt to gain unauthorized access to any portion of the Services;</li>
      <li>Use the Services to transmit any malware, viruses, or other harmful code;</li>
      <li>Engage in any conduct that restricts or inhibits anyone's use of the Services;</li>
      <li>Harvest or collect email addresses or other contact information of other users;</li>
      <li>Use the Services to send unsolicited commercial communications.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">9. Third-Party Services</h2>
    <p>The Services may contain links to third-party websites, services, or content that are not owned or controlled by us. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services. You acknowledge and agree that we shall not be responsible or liable for any damage or loss caused by your use of any such third-party websites or services.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">10. Disclaimer of Warranties</h2>
    <p class="font-semibold">THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.</p>
    <p class="mt-3">We do not warrant that the Services will be uninterrupted, secure, or error-free, that defects will be corrected, or that the Services or the servers that make the Services available are free of viruses or other harmful components.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">11. Limitation of Liability</h2>
    <p class="font-semibold">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL B.A.A.D BY ODUBO, ITS AFFILIATES, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li>Your access to or use of or inability to access or use the Services;</li>
      <li>Any conduct or content of any third party on the Services;</li>
      <li>Any content obtained from the Services;</li>
      <li>Unauthorized access, use, or alteration of your transmissions or content.</li>
    </ul>
    <p class="mt-3">Our total liability to you for all claims arising out of or relating to these Terms or your use of the Services shall not exceed the amount paid by you to us in the twelve (12) months preceding the claim.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">12. Indemnification</h2>
    <p>You agree to defend, indemnify, and hold harmless B.A.A.D by Odubo and its affiliates, licensors, and service providers from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Services.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">13. Governing Law and Dispute Resolution</h2>
    <p>These Terms shall be governed by and construed in accordance with the laws of British Columbia, Canada, without regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or the Services shall be resolved exclusively in the courts located in Kamloops, British Columbia, Canada, and you consent to the personal jurisdiction of such courts.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">14. Severability</h2>
    <p>If any provision of these Terms is held to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">15. Entire Agreement</h2>
    <p>These Terms, together with our Privacy Policy and Shipping & Returns Policy, constitute the entire agreement between you and B.A.A.D by Odubo regarding the Services and supersede all prior agreements and understandings.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">16. Contact Information</h2>
    <p>For questions about these Terms, please contact us at:</p>
    <p class="mt-2 ml-4">B.A.A.D by Odubo<br/>Email: <a href="mailto:maniodubo@gmail.com" class="text-[#843c2d] hover:underline">maniodubo@gmail.com</a><br/>444 Saint Paul Street<br/>Kamloops, BC, V2C 0L2<br/>Canada</p>
  `,

  shipping: `
    <p class="text-sm text-[#b2a491]/70 mb-6">Last updated: December 25, 2025</p>

    <p>Thank you for shopping with B.A.A.D by Odubo. Please read our Shipping and Returns Policy carefully before making a purchase. By placing an order, you acknowledge and agree to these policies.</p>

    <div class="bg-[#843c2d]/10 border border-[#843c2d]/30 rounded-xl p-4 mt-6 mb-6">
      <p class="font-semibold text-[#ede8df]">⚠️ Important Notice</p>
      <p class="mt-2"><strong>ALL SALES ARE FINAL.</strong> Due to the made-to-order and print-on-demand nature of our products, we do not accept returns or exchanges except in cases of damaged or defective items.</p>
    </div>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Order Processing</h2>
    <p>Most of our apparel items are produced on-demand through our fulfillment partner, Tapstitch. This means your items are printed and prepared specifically for you after your order is placed.</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li><strong>Processing Time:</strong> Orders typically take 3-7 business days to be produced and prepared for shipment.</li>
      <li><strong>Order Confirmation:</strong> You will receive an email confirmation once your order is placed and another when it ships.</li>
      <li><strong>Peak Periods:</strong> During high-demand periods (holidays, new releases), processing times may be extended.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Shipping Information</h2>
    <h3 class="text-lg font-medium mt-4 mb-2 text-[#c7b8a8]">Domestic Shipping (Canada)</h3>
    <ul class="list-disc list-inside mt-2 space-y-2 ml-4">
      <li><strong>Standard Shipping:</strong> 5-10 business days after processing</li>
      <li><strong>Expedited Shipping:</strong> 2-5 business days after processing (where available)</li>
    </ul>

    <h3 class="text-lg font-medium mt-4 mb-2 text-[#c7b8a8]">International Shipping</h3>
    <ul class="list-disc list-inside mt-2 space-y-2 ml-4">
      <li><strong>United States:</strong> 5-12 business days after processing</li>
      <li><strong>Europe:</strong> 10-20 business days after processing</li>
      <li><strong>Rest of World:</strong> 15-30 business days after processing</li>
    </ul>

    <p class="mt-4"><strong>Note:</strong> Shipping times are estimates and do not include processing time. Actual delivery times may vary based on carrier delays, customs processing, and other factors beyond our control.</p>

    <h3 class="text-lg font-medium mt-4 mb-2 text-[#c7b8a8]">Shipping Costs</h3>
    <p>Shipping costs are calculated at checkout based on your location, order weight, and selected shipping method. We occasionally offer free shipping promotions—follow us on social media to stay updated.</p>

    <h3 class="text-lg font-medium mt-4 mb-2 text-[#c7b8a8]">Customs and Import Duties</h3>
    <p>For international orders, you are responsible for any customs fees, import duties, or taxes imposed by your country. These charges are not included in the item price or shipping cost and are determined by your local customs authority.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Returns Policy</h2>

    <div class="bg-[#1a1615] border border-[#502d26]/40 rounded-xl p-5 mt-4">
      <h3 class="text-lg font-semibold text-[#ede8df] mb-3">All Sales Are Final</h3>
      <p>Due to the custom, made-to-order nature of our products, <strong>we do not accept returns or exchanges</strong> for:</p>
      <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
        <li>Change of mind</li>
        <li>Incorrect size selection (please refer to our size guide before ordering)</li>
        <li>Color variations due to monitor/screen settings</li>
        <li>Items that have been worn, washed, or altered</li>
      </ul>
    </div>

    <h3 class="text-lg font-medium mt-6 mb-2 text-[#c7b8a8]">Damaged or Defective Items</h3>
    <p>We stand behind the quality of our products. If you receive an item that is:</p>
    <ul class="list-disc list-inside mt-2 space-y-2 ml-4">
      <li>Damaged during shipping</li>
      <li>Defective due to manufacturing error</li>
      <li>Significantly different from what was ordered</li>
    </ul>

    <p class="mt-4">You may be eligible for <strong>store credit</strong> to be used on a future purchase. To request store credit for a damaged or defective item:</p>
    <ol class="list-decimal list-inside mt-3 space-y-2 ml-4">
      <li>Contact us within <strong>14 days</strong> of receiving your order</li>
      <li>Provide your order number and a description of the issue</li>
      <li>Include <strong>clear photographs</strong> showing the damage or defect</li>
      <li>Keep the original packaging until your claim is resolved</li>
    </ol>

    <p class="mt-4">We will review your request and, if approved, issue store credit within 5-7 business days. Store credit is valid for 12 months from the date of issue and cannot be redeemed for cash.</p>

    <h3 class="text-lg font-medium mt-6 mb-2 text-[#c7b8a8]">Lost or Missing Packages</h3>
    <p>If your tracking shows delivered but you haven't received your package:</p>
    <ol class="list-decimal list-inside mt-3 space-y-2 ml-4">
      <li>Check with neighbors, building management, or household members</li>
      <li>Look in safe locations where the carrier may have left the package</li>
      <li>Contact the shipping carrier directly with your tracking number</li>
      <li>If still unresolved, contact us within 14 days of the delivery date</li>
    </ol>
    <p class="mt-3">We are not responsible for packages marked as delivered. Claims for lost packages must be filed with the shipping carrier.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Order Cancellations</h2>
    <p>Due to our quick production process, orders cannot be cancelled or modified once placed. Please review your order carefully before completing your purchase, including:</p>
    <ul class="list-disc list-inside mt-3 space-y-2 ml-4">
      <li>Shipping address accuracy</li>
      <li>Size selection</li>
      <li>Product selection</li>
      <li>Quantity</li>
    </ul>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Size Guide</h2>
    <p>To help ensure you order the correct size, please refer to our size guide available on each product page. Measurements are provided in both inches and centimeters. If you're between sizes, we generally recommend sizing up for a more comfortable fit.</p>
    <p class="mt-3"><strong>Note:</strong> Incorrect size selection is not grounds for return or exchange. Please measure carefully and consult our size guide before ordering.</p>

    <h2 class="text-xl font-semibold mt-8 mb-3 text-[#ede8df]">Contact Us</h2>
    <p>For questions about shipping, returns, or your order, please contact us:</p>
    <p class="mt-2 ml-4">Email: <a href="mailto:maniodubo@gmail.com" class="text-[#843c2d] hover:underline">maniodubo@gmail.com</a></p>
    <p class="mt-3">Please include your order number in all correspondence for faster assistance. We typically respond within 1-2 business days.</p>

    <div class="bg-[#843c2d]/10 border border-[#843c2d]/30 rounded-xl p-4 mt-8">
      <p class="text-sm text-[#c7b8a8]">By placing an order with B.A.A.D by Odubo, you acknowledge that you have read, understood, and agree to this Shipping and Returns Policy.</p>
    </div>
  `
};

export default function LegalPage() {
  return (
    <LegalClient
      privacyContent={<div dangerouslySetInnerHTML={{ __html: legalContent.privacy }} />}
      termsContent={<div dangerouslySetInnerHTML={{ __html: legalContent.terms }} />}
      shippingContent={<div dangerouslySetInnerHTML={{ __html: legalContent.shipping }} />}
    />
  );
}
