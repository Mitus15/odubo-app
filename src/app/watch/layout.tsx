export default function WatchLayout({ children }: { children: React.ReactNode }) {
  // Full-screen overlay so the sidebar and app chrome don't show —
  // watch pages are standalone shareable links.
  return (
    <div
      className="fixed inset-0 z-50 bg-[#0d0c0a] overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  );
}
