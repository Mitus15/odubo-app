import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MusicPlayerLayout from "./components/MusicPlayerLayout";
import AppHeader from "./components/AppHeader";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
// import { AuthProvider } from "@/contexts/AuthContext";
// import ClientCapabilities } from "./components/ClientCapabilities";
import SecurityMonitor from "../components/SecurityMonitor";
import GDPRConsent from "../components/GDPRConsent";
import PerformanceMonitor from "../components/PerformanceMonitor";
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
          <MusicPlayerProvider>
            {/* <ClientCapabilities /> */}
            <ServiceWorkerRegistration />
            <OfflineIndicator />
            <div className="h-full w-full flex flex-col overflow-hidden">
              <AppHeader />
              <main className="flex-1 min-h-0 pt-14 safe-area-header pb-24 safe-area-bottom overflow-y-auto">
                {children}
              </main>
              <MusicPlayerLayout />
              {/* <SecurityMonitor /> */}
              <GDPRConsent />
              {/* <PerformanceMonitor /> */}
              {/* <AccessibilityEnhancer /> */}
            </div>
          </MusicPlayerProvider>
        {/* </AuthProvider> */}
      </body>
    </html>
  );
}
