import type { Metadata, Viewport } from "next";
import { Inter, Pinyon_Script } from "next/font/google";
import LoopIntro from "@/components/loop/brand/LoopIntro";
import { ALBUM_NAME } from "@/lib/loop/albumName";

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

// The defaults name the album, Signs of Life (2026-10-03): with the night
// called off, /loop's front door is the album's singles, and the app a guest
// keeps on their home screen is the record. Loop Soul is the night again, a
// series that may come back; its own pages (the pass, the store, the door)
// name it in their own metadata.
export const metadata: Metadata = {
  title: ALBUM_NAME,
  description: `${ALBUM_NAME}, an album by Mani Odubo.`,
  applicationName: ALBUM_NAME,
  // Loop-scoped manifest → "Add to Home Screen" installs /loop as its own
  // standalone app (overrides odubo's /site.webmanifest for this segment).
  manifest: "/loop/manifest.webmanifest",
  // Chrome's install prompt needs a PNG of at least 192px; Safari's home
  // screen needs apple-touch-icon. The SVG alone satisfied neither, so "Get
  // it on your home screen" could not, until 2026-09-16.
  icons: { icon: "/loop/icon.svg", apple: "/loop/icon-192.png" },
  appleWebApp: {
    capable: true,
    title: ALBUM_NAME,
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
