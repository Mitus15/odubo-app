import { redirect } from 'next/navigation';

/** The runner is Soul Loop now: the old address forwards, song and all. */
export default async function StreetRunnerRedirect({ searchParams }: { searchParams: Promise<{ song?: string }> }) {
  const song = (await searchParams).song;
  redirect(song ? `/game/soul-loop?song=${encodeURIComponent(song)}` : '/game/soul-loop');
}
