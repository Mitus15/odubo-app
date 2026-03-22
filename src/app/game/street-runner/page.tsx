import type { Metadata } from 'next';
import StreetRunnerOverlay from '@/components/game/StreetRunnerOverlay';

export const metadata: Metadata = {
  title: 'Recoolman | ODUBO',
  description: 'Bring light to the city. An infinite runner by ODUBO.',
};

export default function StreetRunnerPage() {
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <StreetRunnerOverlay />
    </div>
  );
}
