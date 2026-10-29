import type { Metadata } from 'next';
import { Suspense } from 'react';
import { houseFont } from '@/lib/brand/houseFont';
import AdminHome from './AdminHome';

export const metadata: Metadata = {
  title: 'Odubo Studio',
  robots: { index: false, follow: false },
};

/**
 * The admin home: today's post and his five jobs (AdminHome), in the Studio's
 * paper and ink, with the house face for "Odubo Studio" beside the danceman.
 * The old dashboard, its sidebar and its tabs are in the home's ⋯ menu.
 */
export default function AdminPage() {
  return (
    <div className={houseFont.variable}>
      <Suspense fallback={null}>
        <AdminHome />
      </Suspense>
    </div>
  );
}
