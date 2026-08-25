import { getSetting, setSetting } from "./loopSetting";

/**
 * Where a printed piece sends people.
 *
 * A QR code is the one thing in this system that CANNOT be corrected after the
 * fact — once a poster is at the print shop the URL inside it is permanent. So
 * the destination is deliberately DATA, never a constant in a script:
 * `loop_settings.public_base_url` is the single value both runtimes read, and
 * changing domains is one field plus a re-run of `npm run loop:posters`.
 *
 * This module is import-free apart from the D1 client (which is itself
 * import-free), so the Node poster kit can use it exactly as the app does.
 */

/** The setting that holds the origin every printed QR is built from. */
export const PUBLIC_BASE_URL_KEY = "public_base_url";

/** Every piece the studio and the kit can render. */
export type DestinationPiece = "event" | "tournament" | "ticket" | "pass" | "flyer";

/**
 * Default path per piece. `null` means the piece carries no QR at all — the
 * pass card is a store-shelf face and has deliberately never had one.
 *
 * These are paths, not URLs: the origin comes from the setting, so a domain
 * change never has to touch this table.
 */
export const PIECE_PATHS: Record<DestinationPiece, string | null> = {
  event: "/loop",
  tournament: "/loop",
  ticket: "/loop",
  pass: null,
  flyer: "/loop",
};

/**
 * Normalise an origin, or return null if it could not survive being printed.
 *
 * A relative path is the dangerous input here — it looks fine in a preview and
 * produces a QR no phone can resolve. Rejecting it is the whole point.
 */
export function normalizeBaseUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;
  return u.origin + (u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, ""));
}

/** True when a string is a URL a phone camera can actually open. */
export function isScannable(url: string | null | undefined): boolean {
  return normalizeBaseUrl(url) !== null;
}

/**
 * Build the absolute destination for a piece.
 *
 * `placement` tags where the asset physically went (`campus`, `scotts`, …) so
 * the print run can be told apart from the story post. It is a bare label, not
 * an identifier — nothing personal ever goes in a printed URL.
 */
export function buildDestination(
  baseUrl: string,
  pathOrUrl: string | null,
  placement?: string | null,
): string | null {
  if (pathOrUrl === null) return null;
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return null;

  // An absolute override wins outright; otherwise the path rides the base.
  const absolute = normalizeBaseUrl(pathOrUrl);
  const url = new URL(absolute ?? base + (pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`));

  const tag = (placement ?? "").trim();
  if (tag) url.searchParams.set("p", tag);
  return url.toString();
}

/** The default destination for a piece, or null when it carries no QR. */
export function destinationFor(
  piece: DestinationPiece,
  baseUrl: string,
  placement?: string | null,
): string | null {
  return buildDestination(baseUrl, PIECE_PATHS[piece], placement);
}

/** Read the configured origin from D1. Null when unset — callers must refuse. */
export async function getPublicBaseUrl(): Promise<string | null> {
  return normalizeBaseUrl(await getSetting(PUBLIC_BASE_URL_KEY));
}

/** Upsert the origin; empty clears it. */
export async function setPublicBaseUrl(value: string | null): Promise<void> {
  await setSetting(PUBLIC_BASE_URL_KEY, normalizeBaseUrl(value));
}
