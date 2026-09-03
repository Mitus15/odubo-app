import type { Metadata } from 'next';

import AdminGuard from './components/AdminGuard';
import ReleaseListClient from './ReleaseListClient';

export const metadata: Metadata = {
  title: 'Release · Odubo Admin',
  robots: { index: false, follow: false },
};

export default function ReleasePage() {
  return (
    <AdminGuard>
      <ReleaseListClient />
    </AdminGuard>
  );
}
