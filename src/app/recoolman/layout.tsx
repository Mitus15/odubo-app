import type { Metadata } from "next";
import { Inter, Pinyon_Script } from "next/font/google";

/**
 * The world of Loop Soul, at the name Recoolman goes by (@recoolman). It wears
 * the Loop Soul theme like /loop does (see src/app/loop/layout.tsx): the same
 * `.loop-theme` wrapper, fonts and sand and ink, without the /loop intro.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const script = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  title: "Recoolman",
  description: "The world of Loop Soul.",
};

export default function WorldLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`loop-theme ${inter.variable} ${script.variable}`}>{children}</div>;
}
