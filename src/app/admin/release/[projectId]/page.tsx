import type { Metadata } from 'next';

import AdminGuard from '../components/AdminGuard';
import ProjectFloorClient from './ProjectFloorClient';

export const metadata: Metadata = {
  title: 'Release · Odubo Admin',
  robots: { index: false, follow: false },
};

export default async function ProjectFloorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <AdminGuard>
      <ProjectFloorClient projectId={projectId} />
    </AdminGuard>
  );
}
