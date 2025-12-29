import { CommandCenterProvider } from '@/contexts/CommandCenterContext';

export const metadata = {
  title: 'Command Center | Odubo',
  description: 'Media distribution and analytics hub',
};

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CommandCenterProvider>{children}</CommandCenterProvider>;
}
