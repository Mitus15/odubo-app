/**
 * Featured Layout - Minimal wrapper for featured management pages
 *
 * The MainContentWrapper in root layout detects /featured/manage routes 
 * and removes the DesktopSidebar margin automatically.
 */
export default function FeaturedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
