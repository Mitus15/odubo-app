export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden">
      {children}
    </div>
  );
}
