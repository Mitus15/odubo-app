import { getSetting, setSetting } from "./loopSetting";
import { parseReleases, singleStatuses, todayPacific, SINGLES, type SingleStatus } from "./singles";

/** The setting that holds every single's release date. See singles.ts. */
export const SINGLES_SETTING = "singles";

export async function getSingleStatuses(now: Date = new Date()): Promise<SingleStatus[]> {
  const raw = await getSetting(SINGLES_SETTING).catch(() => null);
  return singleStatuses(parseReleases(raw), todayPacific(now));
}

/** Titles anyone may hear right now, lowercased, for the audio gate. */
export async function releasedSingleTitles(now: Date = new Date()): Promise<Set<string>> {
  const statuses = await getSingleStatuses(now);
  return new Set(statuses.filter((s) => s.out).map((s) => s.title.toLowerCase()));
}

/** Set one single's date (YYYY-MM-DD) or clear it (null). Admin only, by the caller. */
export async function setSingleRelease(slug: string, date: string | null): Promise<void> {
  if (!SINGLES.some((s) => s.slug === slug)) throw new Error(`unknown single ${slug}`);
  const current = parseReleases(await getSetting(SINGLES_SETTING));
  current[slug] = date;
  await setSetting(SINGLES_SETTING, JSON.stringify(current));
}
