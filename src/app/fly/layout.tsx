import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Into the World · Recoolman',
  description: 'Recoolman dives into the world. Slide to steer.',
  // A hidden link for now: not in the menu, not in search.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#ece5d6',
};

export default function FlyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#ece5d6] text-[#1a1716]" style={{ touchAction: 'none' }}>
      {children}
    </div>
  );
}
