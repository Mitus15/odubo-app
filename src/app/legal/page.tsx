import LegalClient from "./LegalClient";
import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { RoomShell } from "@/components/room/RoomParts";
import { onRoom, ROOM_DARK } from "@/lib/room";
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Legal',
  description: 'Privacy Policy, Terms of Service, and Shipping & Returns policies for Odubo Studio.',
  path: '/legal',
  noIndex: true,
});

/*
 * Set like a playbill's small print, inside .product-details (globals.css):
 * the paragraphs in the room's writing, muted, on a short measure; a bold
 * lead-in (<strong>) becomes a caps label; each section opens on a caps head.
 */
/** The first line of a policy, a touch larger */
const LEAD = "text-[15px] font-normal";
/** A section's head */
const HEAD = "room-display mb-3 mt-10 text-[12px] uppercase tracking-[0.18em]";
/** A date the policy carries */
const DATED = "room-eyebrow";
/** A link in the text */
const LINK = "font-normal underline decoration-current/40 underline-offset-[3px] transition-colors hover:decoration-current";
/** An address to write to */
const ADDRESS = "font-normal";
/** A sentence that must be read, not skimmed: bold at the size of the text, not a caps label */
const SPOKEN: CSSProperties = { fontSize: 'inherit', letterSpacing: 'normal', textTransform: 'none', fontWeight: 500, marginRight: 0 };

// Convert HTML content to React components for security
const LegalContent = {
  privacy: (
    <>
      <p className={LEAD}>Odubo Studio is run by one person, Emmanuel Morris-Odubo, in Kamloops, British Columbia. This page says what we hold about you, why, and how to see it or have it removed. It is written to the BC <em>Personal Information Protection Act</em>.</p>
      <p className={DATED}>Last updated 12 September 2026.</p>

      <h2 className={HEAD}>What we collect, and why</h2>
      <p><strong>When you buy something.</strong> Your name, email, shipping address and order contents. Payment is taken by Shopify and we never see your card number. We use this to fulfil the order, to email you about it, and to keep the records the law requires us to keep.</p>
      <p><strong>When you open a Loop Soul page.</strong> A cookie holding a random identifier, so the site can remember which device you are on for 180 days. It carries no name and no email until you give us one.</p>
      <p><strong>When you buy a pass, post a photo, or claim your name.</strong> A first name, an email, which volumes you attended, and which photographs you took. This is what lets your credit follow you, lets you find your pass again, and lets us pay you if your shot becomes a cover.</p>
      <p><strong>When you write to us.</strong> Whatever you send, kept only as long as it is useful to answer you.</p>
      <p><strong>Analytics.</strong> Only if you agree to it in the cookie bar. You can change that at any time from the same bar.</p>

      <h2 className={HEAD}>Filming and photography at our events</h2>
      <p>Loop Soul events are filmed, photographed and audio recorded throughout. The performance is recorded for release.</p>
      <p><strong style={SPOKEN}>By buying a ticket and attending, you agree that you may appear on camera and in photographs, and that Odubo Studio and Scott&rsquo;s Inn &amp; Suites may use that material for any purpose, including commercial and promotional use.</strong> In practice that means the album and its artwork, the Loop Soul magazine, video, and promotion of the project and of future volumes. There is no time limit on that use.</p>
      <p>You are told this before you buy, again at the door, and again on the signs in the room. We cannot promise to keep anyone out of shot, and we would rather say so than promise it and fail. Anyone featured as a recognisable subject, rather than as part of the crowd, signs a separate written release on the night.</p>
      <p>If a photograph of you is already published and you want it taken down, write to us. We will remove it from anything we control. We cannot recall a physical print or a copy someone else has already downloaded, and we will say so plainly rather than promise otherwise.</p>

      <h2 className={HEAD}>Who else sees it</h2>
      <p>We do not sell your information and we do not trade it. It reaches other companies only where they do a job for us: Shopify for the store and checkout, Cloudflare for storage and video, Vercel for hosting, Resend for email, and shipping carriers for deliveries. Some of them store data outside Canada, which means it can be reached by the courts and authorities of those countries.</p>
      <p>The one thing we publish is credit. If you post a photograph to the Wall, your first name appears beside it. That is the point of it. If you would rather it did not, do not post, or write to us and we will take it down.</p>

      <h2 className={HEAD}>Seeing your own record</h2>
      <p>You can ask us for a copy of everything we hold about you, ask us to correct it, or ask us to delete it. Write to the address below and we will answer within 30 days, free. We may need to check you are who you say you are first.</p>
      <p>Two things you can do without asking anyone:</p>
      <p><strong>Your pass.</strong> Find it any time at <Link href="/loop/code" className={LINK}>odubostudio.com/loop/code</Link> with the email you checked out with.</p>
      <p><strong>Your orders.</strong> Shopify keeps them at <a href="https://shop.odubostudio.com/account" target="_blank" rel="noopener noreferrer" className={LINK}>shop.odubostudio.com/account</a>. No password is needed. It emails you a code to sign in.</p>
      <p>Deleting your Loop Soul record removes your name, your email and the link between you and your device. Photographs you posted stay up unless you ask for those too, but they lose their credit line.</p>

      <h2 className={HEAD}>How long we keep it</h2>
      <p>Order records for seven years, because tax law requires it. Loop Soul attendee records for as long as the project runs, because credit on a released work has to outlast the night. Analytics for 26 months. Anything else, only as long as it is doing a job.</p>

      <h2 className={HEAD}>Security</h2>
      <p>Data sits with the providers named above, behind their access controls, reached over encrypted connections. We keep the number of people who can see it at one. No system is perfectly secure and we will not claim ours is.</p>

      <h2 className={HEAD}>Children</h2>
      <p>Loop Soul events are 19+. We do not knowingly collect information from anyone under 13. If you believe we have, write to us and it will be deleted.</p>

      <h2 className={HEAD}>Who to write to</h2>
      <p>Emmanuel Morris-Odubo is the privacy contact for Odubo Studio. <span className={ADDRESS}>maniodubo@gmail.com</span></p>
      <p>If you are not satisfied with how we answer, you can complain to the Office of the Information and Privacy Commissioner for British Columbia at <a href="https://www.oipc.bc.ca" target="_blank" rel="noopener noreferrer" className={LINK}>oipc.bc.ca</a>.</p>
    </>
  ),

  terms: (
    <>
      <p className={LEAD}>Welcome to Odubo Studio. These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Odubo Studio website and services.</p>

      <h2 className={HEAD}>Acceptance of Terms</h2>
      <p>By accessing or using our services, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these terms, please do not use our services.</p>

      <h2 className={HEAD}>Use of Services</h2>
      <p>You may use our services only in compliance with these Terms and all applicable laws and regulations. You agree not to misuse our services or help anyone else do so.</p>

      <h2 className={HEAD}>Intellectual Property</h2>
      <p>All content and materials available on our website, including but not limited to text, graphics, logos, images, audio, video, and software, are the property of Odubo Studio and are protected by intellectual property laws.</p>

      <h2 className={HEAD}>Event passes</h2>
      <p>A Loop Soul pass admits one person to one night and is also a pre-order of that volume&rsquo;s record. Buying one means you accept these things:</p>
      <p>The door is 19+ and photo ID is checked. We can refuse entry, or ask you to leave, if you are unsafe to others or to the room, and no refund is owed when we do. Capacity is real: once the passes are gone they are gone, and a pass does not guarantee entry if you arrive after the room is full.</p>
      <p>By buying a ticket and attending, you agree that you may appear on camera and in photographs, and that Odubo Studio and Scott&rsquo;s Inn &amp; Suites may use that material for any purpose, including commercial and promotional use. The <Link href="/legal?tab=privacy" className={LINK}>Privacy Policy</Link> sets out what that means and how to have something taken down.</p>
      <p>A pass is not refundable but it is transferable. Giving your pass to someone else gives them the seat.</p>

      <h2 className={HEAD}>What you post, and what you are owed for it</h2>
      <p>Photographs and video you post to the Wall stay yours. By posting, you give Odubo Studio permission to use them in the album and its artwork, in the magazine, and in promotion of the project, with your first name credited beside them.</p>
      <p>Where a piece of work earns, the credit is what we pay on. That is why we ask for your name once and never re-type it. If a shot of yours becomes an official cover, the prize stated at the time is paid to the person credited on it.</p>
      <p>Do not post a photograph you did not take, or one of someone who has asked you not to. We take those down.</p>

      <h2 className={HEAD}>Limitation of Liability</h2>
      <p>Odubo Studio shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services.</p>

      <h2 className={HEAD}>Contact Information</h2>
      <p>Questions about the Terms of Service should be sent to us at <span className={ADDRESS}>maniodubo@gmail.com</span>.</p>
    </>
  ),

  shipping: (
    <>
      <p className={LEAD}>We are one studio and most of what we make is made in small runs. Here is what happens after you pay.</p>

      <h2 className={HEAD}>Loop Soul pieces are pre-orders</h2>
      <p>Everything in the Loop Soul drop is a pre-order. It is made after the event and ships after Saturday 10 October 2026. You are charged when you order, which is what pays for the run. If a piece will be later than that, we email you rather than letting you wonder.</p>

      <h2 className={HEAD}>Everything else</h2>
      <p>Orders are packed within 1 to 3 business days. Standard and expedited shipping are both offered at checkout, and you get tracking the moment it leaves.</p>

      <h2 className={HEAD}>Outside Canada</h2>
      <p>We ship to selected countries. Customs duties and import taxes are yours to pay and are not included in what you see at checkout.</p>

      <h2 className={HEAD}>Returns and exchanges</h2>
      <p>Clothing can come back within 30 days of delivery, unworn, in its original condition with tags on. We will refund it or swap the size if we have it. Write to us first so we know it is coming. Return postage is yours unless the piece arrived wrong or faulty, in which case it is ours.</p>
      <p>Custom and personalised items are final sale.</p>

      <h2 className={HEAD}>Event passes</h2>
      <p>A pass is a ticket to a night and a pre-order of the record, so it is not returnable once bought. It is transferable: if you cannot come, send your pass to whoever takes your place and they can use it at the door.</p>
      <p>If the event is cancelled outright, every pass is refunded in full. If it is moved, your pass carries to the new date, and you can ask for a refund instead.</p>

      <h2 className={HEAD}>Questions</h2>
      <p>Write to <span className={ADDRESS}>maniodubo@gmail.com</span> and a person answers.</p>
    </>
  )
};

export default function LegalPage() {
  return (
    // While the link's tab is read, the room is already there: the dark field and the danceman
    <Suspense fallback={<RoomShell colour={ROOM_DARK} on={onRoom(ROOM_DARK)}>{null}</RoomShell>}>
      <LegalClient
        privacyContent={LegalContent.privacy}
        termsContent={LegalContent.terms}
        shippingContent={LegalContent.shipping}
      />
    </Suspense>
  );
}
