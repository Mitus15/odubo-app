import type { Metadata } from 'next';
import { Suspense } from 'react';

import AdminGuard from '../release/components/AdminGuard';
import InboxClient from './InboxClient';

export const metadata: Metadata = {
  title: 'Inbox · Odubo Admin',
  robots: { index: false, follow: false },
};

export default function InboxPage() {
  return (
    <AdminGuard>
      <Suspense fallback={null}>
        <InboxClient />
      </Suspense>
    </AdminGuard>
  );
}
