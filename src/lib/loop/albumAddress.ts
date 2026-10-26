import { ALBUM_BASE } from "./singles";
import { songBySlug } from "./songs";

/**
 * Which /loop page an /signsoflife path serves (owner, 2026-10-03), for the
 * middleware's rewrite. Only the album's routes: the front door, the record,
 * the film and a page per song. Loop Soul's routes (the pass, the door, the
 * store, the admin) are not, so there is no second way into /loop/admin for
 * its gate to miss, and anything else under /signsoflife 404s.
 *
 * Returns the /loop path to serve, or null when the path is not the album's.
 */
const ALBUM_PAGES = new Set(["album", "film"]);

export function albumRoute(pathname: string): string | null {
  if (pathname !== ALBUM_BASE && !pathname.startsWith(`${ALBUM_BASE}/`)) return null;
  const rest = pathname.slice(ALBUM_BASE.length + 1);
  if (rest === "") return "/loop";
  if (ALBUM_PAGES.has(rest) || songBySlug(rest)) return `/loop/${rest}`;
  return null;
}
