import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MusicPlayerLayout from "./components/MusicPlayerLayout";
// AppHeader removed - navigation via expandable logo menu on clips
import { AudioProvider } from "@/contexts/AudioContext";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
import { OmniShopProvider } from "@/contexts/OmniShopContext";
import OmniShopOrchestrator from "@/components/shop/OmniShopOrchestrator";
import { UnifiedMediaProvider } from "@/contexts/UnifiedMediaContext";
import OmniMediaOrchestrator from "@/components/media/OmniMediaOrchestrator";
// Auth modal removed - customers redirected directly to account.odubo.studio
import MediaPriorityBridge from "@/components/player/MediaPriorityBridge";
import DesktopSidebar from "@/components/layout/DesktopSidebar";
import MainContentWrapper from "@/components/layout/MainContentWrapper";
// import { AuthProvider } from "@/contexts/AuthContext";
// import ClientCapabilities } from "./components/ClientCapabilities";
import GDPRConsent from "../components/GDPRConsent";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";
import OfflineIndicator from "../components/OfflineIndicator";
// import AccessibilityEnhancer from "./components/AccessibilityEnhancer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Odubo Studio",
  description: "Professional music and video content management platform",
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
  themeColor: "#843c2d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} overflow-hidden bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df] font-serif`}
        suppressHydrationWarning={true}
        style={{
          overscrollBehaviorY: 'none',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* <AuthProvider> */}
          <AudioProvider>
            <MusicPlayerProvider>
              {/* Media priority bridge - connects AudioContext and MusicPlayerContext */}
              <MediaPriorityBridge />
              <OmniShopProvider>
                <UnifiedMediaProvider>
                  {/* <ClientCapabilities /> */}
                  <ServiceWorkerRegistration />
                  <OfflineIndicator />
                  {/* Desktop sidebar - persistent navigation on lg+ */}
                  <DesktopSidebar />

                  {/* Main content wrapper - conditionally applies sidebar margin */}
                  <MainContentWrapper>
                    {/* Main content - full height, accounts for mini-bar dynamically */}
                    <main className="flex-1 min-h-0 safe-area-top safe-area-bottom minibar-aware overflow-y-auto">
                      {children}
                    </main>
                    {/* Music player - renders modal via VinylMiniPlayer */}
                    <MusicPlayerLayout />
                    <GDPRConsent />
                  </MainContentWrapper>
                  {/* Modal orchestrators - rendered at root level */}
                  <OmniShopOrchestrator />
                  <OmniMediaOrchestrator />
                </UnifiedMediaProvider>
              </OmniShopProvider>
            </MusicPlayerProvider>
          </AudioProvider>
        {/* </AuthProvider> */}
      </body>
    </html>
  );
}
