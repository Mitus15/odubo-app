import FlyClient from '@/components/fly/FlyClient';
import { flyAudioSources } from '@/lib/fly/audioSources';
import { publicChapters } from '@/lib/loop/film/public';

// Every visit mints fresh links to the songs, so this page is never cached.
export const dynamic = 'force-dynamic';

const UNSET_FIELD = '#d9aa7a';

/**
 * Each chapter's field colour, as the film admin sets it. When the database
 * cannot be read every chapter comes back as sand; the game then uses its own
 * walk around the hue wheel rather than ten levels of the same sky.
 */
async function chapterFields(): Promise<Record<string, string>> {
  const chapters = await publicChapters().catch(() => []);
  if (chapters.length === 0 || chapters.every((chapter) => chapter.field === UNSET_FIELD)) return {};
  return Object.fromEntries(chapters.map((chapter) => [chapter.slug, chapter.field]));
}

export default async function FlyPage() {
  const [audio, fields] = await Promise.all([flyAudioSources().catch(() => ({})), chapterFields()]);
  return <FlyClient audio={audio} fields={fields} />;
}
