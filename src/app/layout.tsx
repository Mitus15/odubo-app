import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Validate environment on startup
import "@/lib/validateEnv";
// The clips, store, music and media machinery lives in components/layout/AppShell,
// which SiteFrame fetches only for pages outside the rooms (app/(room)); the cookie bar is there too
import SiteFrame from "@/components/layout/SiteFrame";
import { EmailCaptureProvider } from "@/contexts/EmailCaptureContext";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";
import { SIGN_IN_SYNC } from "@/lib/signIn";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Fetched by the pages that set something in it, not preloaded on every page (no room uses it)
  preload: false,
});

export const metadata: Metadata = {
  title: "Odubo Studio",
  description: "Odubo Studio: the music and dance of Mani Odubo, and B.A.A.D Creative Wear.",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Odubo Studio",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // The house ink: a room sets the bar to its own colour once it is drawn (useBrowserColour)
  themeColor: "#2a0f0a",
};

/**
 * What every page needs, the rooms included: the faces, the styles, analytics,
 * the email capture (the rooms' Save your progress) and the cookie bar.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* The sign-in follows the shared cookie on every address of the site, before anything reads it */}
        <script dangerouslySetInnerHTML={{ __html: SIGN_IN_SYNC }} />
        {/* Preconnect to video CDN - saves 100-300ms per video load */}
        <link rel="preconnect" href="https://videodelivery.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://videodelivery.net" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} overflow-hidden bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df] font-serif`}
        suppressHydrationWarning={true}
        style={{
          overscrollBehaviorY: 'none',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Google Analytics 4 - respects GDPR consent */}
        <GoogleAnalytics />
        <AnalyticsProvider>
          <EmailCaptureProvider>
            <SiteFrame>{children}</SiteFrame>
          </EmailCaptureProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
