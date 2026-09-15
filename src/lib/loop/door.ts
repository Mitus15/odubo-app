/**
 * The door, the pure part.
 *
 * A ticket QR encodes the door's own URL with the pass in it, so that a scan
 * from a plain camera app lands the host on /loop/admin/door with the code
 * already in hand. The in-page scanner reads the same QR, and it also reads a
 * bare code (an older screenshot, a code typed by hand). Everything funnels
 * through here so the two paths cannot disagree about what a pass looks like.
 */

/** LOOP- and four characters from the code alphabet (no 0/O/1/I). */
const CODE = /LOOP-[A-Z2-9]{4}/i;

/** Pull a pass out of whatever was scanned or typed. Null when there is none. */
export function parseScannedCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const raw = text.trim();
  // A door URL: the code travels as ?c=
  try {
    const u = new URL(raw);
    const c = u.searchParams.get("c");
    if (c) {
      const m = c.match(CODE);
      if (m) return m[0].toUpperCase();
    }
  } catch {
    /* not a URL */
  }
  const m = raw.match(CODE);
  return m ? m[0].toUpperCase() : null;
}

/** What a ticket QR encodes: the door, with the pass in hand. */
export function doorUrlFor(code: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/loop/admin/door?c=${encodeURIComponent(code)}`;
}
