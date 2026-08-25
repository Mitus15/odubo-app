import type { Metadata, Viewport } from "next";
import { Inter, Pinyon_Script } from "next/font/google";
import LoopIntro from "@/components/loop/brand/LoopIntro";

/**
 * Loop Soul's layout — NESTED inside odubo's root layout, not a root layout of
 * its own. It therefore renders no <html>/<body>; instead everything sits in a
 * `.loop-theme` wrapper that (a) carries the brand fonts' CSS variables,
 * (b) scopes Loop Soul's sand/ink token assignments (see globals.css), and
 * (c) hosts vault mode's `data-mode` flip so the brand can never leak onto the
 * odubo surfaces sharing the same <body>.
 */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Elegant script for the "Soul" wordmark accent — approximates the poster
// lettering until the final brand font is confirmed.
const script = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Loop Soul — the album",
  description:
    "Loop Soul is an album by Mani Odubo. Each volume is the record brought into a room — Volume 1 is the first time it's played anywhere, at Scott's Inn, Kamloops.",
  applicationName: "Loop Soul",
  // Loop-scoped manifest → "Add to Home Screen" installs /loop as its own
  // standalone app (overrides odubo's /site.webmanifest for this segment).
  manifest: "/loop/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Loop Soul",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#d9aa7a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function LoopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`loop-theme ${inter.variable} ${script.variable}`}>
      <LoopIntro />
      {children}
    </div>
  );
}
