import type { Metadata, Viewport } from 'next';
import { HubUserProvider } from '@/contexts/HubUserContext';
import { HubShell } from '@/components/hub/layout';
import './hub-tokens.css';

export const metadata: Metadata = {
  title: 'The Hub | Odubo',
  description: 'Enterprise Business Operating System',
  robots: 'noindex, nofollow', // Admin should not be indexed
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#171616',
};

export default function AdminV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HubUserProvider loginPath="/admin/login">
      <HubShell>{children}</HubShell>
    </HubUserProvider>
  );
}
