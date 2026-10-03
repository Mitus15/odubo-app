/**
 * The singles: the album's way out into the world, one song and one music
 * video at a time (decided 2026-09-29, when the live night was called off).
 *
 * Order is the owner's: Makunahea, 1984, News Peak. Each has its own page at
 * /loop/<slug>, and each is either OUT (anyone can hear it) or COMING (the
 * page exists to be linked from a teaser post, and plays nothing).
 *
 * The release date is a SETTING (`loop_settings.singles`), never a constant,
 * for the same reason the featured track and the price are: the owner moves a
 * date without a deploy, and the page, the share card and the audio gate all
 * read the same value. The list of songs and their slugs is code, because a
 * slug is a URL and a URL that has been posted must not move.
 *
 * The pure half (no imports) is what the tests and the audio gate share.
 */

export type SingleDef = {
  /** The URL segment: /loop/<slug>. Never changes once posted. */
  slug: string;
  /** The track title exactly as in D1 `tracks.title`. */
  title: string;
  /** Its stem-field pack under warehouse/field/<pack>/, once one is uploaded.
   *  Absent means Fract has nothing to offer for this song yet. */
  fieldPack?: string;
};

/** In release order. */
export const SINGLES: readonly SingleDef[] = [
  { slug: "makunahea", title: "Makunahea" },
  { slug: "1984", title: "1984" },
  { slug: "newspeak", title: "News Peak", fieldPack: "newspeak" },
];

/**
 * When nothing is stored. 1984 has been public since Sep 2026 (its link is on
 * printed flyers), so it is out; the other two wait for a date.
 */
export const DEFAULT_RELEASES: Record<string, string | null> = {
  makunahea: null,
  "1984": "2026-09-08",
  newspeak: null,
};

export type SingleStatus = SingleDef & {
  /** YYYY-MM-DD in Pacific time, or null when no date is set. */
  releaseDate: string | null;
  out: boolean;
  /** 1-based position in the rollout. */
  number: number;
};

export function singleBySlug(slug: string): SingleDef | null {
  const s = slug.trim().toLowerCase();
  return SINGLES.find((d) => d.slug === s) ?? null;
}

export function singleByTitle(title: string | null | undefined): SingleDef | null {
  const t = (title ?? "").trim().toLowerCase();
  return SINGLES.find((d) => d.title.toLowerCase() === t) ?? null;
}

export function singlePath(slug: string): string {
  return `/loop/${slug}`;
}

/**
 * The album's own address (owner, 2026-10-03, when Loop Soul went back to
 * being the night and the record became Signs of Life). The middleware serves
 * /signsoflife/<slug> from /loop/<slug>, so this is what a link people pass
 * around says: the share button, the canonical URL, a caption. Navigation
 * inside the site stays on singlePath, the installed app's scope, and every
 * /loop link already posted keeps working.
 */
export const ALBUM_BASE = "/signsoflife";

/** Set by the middleware when /loop's front door was reached as ALBUM_BASE. */
export const ALBUM_ADDRESS_HEADER = "x-album-address";

export function sharePath(slug: string): string {
  return `${ALBUM_BASE}/${slug}`;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse the stored setting: a JSON object `{ "<slug>": "YYYY-MM-DD" | null }`.
 * Anything unreadable falls back to the defaults for that slug, loudly, rather
 * than releasing or hiding a song by accident.
 */
export function parseReleases(raw: string | null): Record<string, string | null> {
  const out: Record<string, string | null> = { ...DEFAULT_RELEASES };
  if (!raw) return out;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const d of SINGLES) {
      if (!(d.slug in obj)) continue;
      const v = obj[d.slug];
      if (v === null) out[d.slug] = null;
      else if (typeof v === "string" && YMD.test(v)) out[d.slug] = v;
      else console.error(`[singles] ignoring bad release date for ${d.slug}: ${JSON.stringify(v)}`);
    }
  } catch {
    console.error("[singles] loop_settings.singles is not JSON; using defaults");
  }
  return out;
}

/** Today in the venue's timezone, YYYY-MM-DD. A single drops at midnight Pacific. */
export function todayPacific(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function singleStatuses(releases: Record<string, string | null>, today: string): SingleStatus[] {
  return SINGLES.map((d, i) => {
    const releaseDate = releases[d.slug] ?? null;
    return { ...d, releaseDate, out: !!releaseDate && releaseDate <= today, number: i + 1 };
  });
}

/** The newest single that is out, else the next one coming: where /loop lands. */
export function frontSingle(statuses: SingleStatus[]): SingleStatus {
  const out = statuses.filter((s) => s.out);
  if (out.length) {
    return out.reduce((a, b) => ((b.releaseDate ?? "") >= (a.releaseDate ?? "") ? b : a));
  }
  return statuses[0];
}

/** "Oct 16" from "2026-10-16", read as a calendar date (no timezone shift). */
export function releaseLabel(ymd: string | null): string | null {
  if (!ymd || !YMD.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The field pack a media key belongs to: `warehouse/field/<pack>/<file>`.
 * The shared codec probe (`warehouse/field/probe.opus`) is no pack's.
 */
export function fieldPackOfKey(key: string): string | null {
  const m = /^warehouse\/field\/([^/]+)\/[^/]+$/.exec(key);
  return m ? m[1] : null;
}

export function singleByFieldPack(pack: string): SingleDef | null {
  return SINGLES.find((d) => d.fieldPack === pack) ?? null;
}
