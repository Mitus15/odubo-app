import type { Metadata } from 'next';
import StreetRunnerOverlay, { type RunnerSoundtrack } from '@/components/game/StreetRunnerOverlay';
import { getTrackAsSingle } from '@/lib/loop/single';
import { singleBySlug, singlePath } from '@/lib/loop/singles';
import { getSingleStatuses } from '@/lib/loop/singlesStore';
import { isAdminRequest } from '@/lib/loop/audioAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Recoolman | ODUBO',
  description: 'Bring light to the city. An infinite runner by ODUBO.',
};

/**
 * ?song=<slug> runs to a Loop Soul single: the way a single is played rather
 * than listened to. Only a single that is out (or an admin previewing) gets a
 * soundtrack; anything else runs silent, the game as it always was.
 */
async function soundtrackFor(slug: string | undefined): Promise<RunnerSoundtrack | undefined> {
  const def = slug ? singleBySlug(slug) : null;
  if (!def) return undefined;
  const status = (await getSingleStatuses().catch(() => [])).find((s) => s.slug === def.slug);
  if (!status?.out && !(await isAdminRequest(null))) return undefined;
  const track = await getTrackAsSingle(def.title);
  if (!track) return undefined;
  return { title: track.title, src: track.audioUrl, backHref: singlePath(def.slug) };
}

export default async function StreetRunnerPage({ searchParams }: { searchParams: Promise<{ song?: string }> }) {
  const soundtrack = await soundtrackFor((await searchParams).song);
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <StreetRunnerOverlay soundtrack={soundtrack} />
    </div>
  );
}
