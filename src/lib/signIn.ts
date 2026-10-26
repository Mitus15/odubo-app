/**
 * The sign-in, on every address of the site at once.
 *
 * A sign-in is one JWT kept twice: the `token` cookie, which the server reads
 * first (getAuthTokenFromRequest), and localStorage `token`, which much of the
 * client reads. On the live domains the cookie belongs to the whole apex, so
 * signing in on www also signs you in on admin. and moments. localStorage
 * belongs to one address only, so every page load copies the cookie in
 * (SIGN_IN_SYNC, inlined in the root layout's head), and logging out clears
 * the copy and the cookie in both its forms (clearSignIn).
 *
 * Elsewhere (localhost, *.vercel.app) the cookie stays on its own host and
 * nothing is synced, as before.
 */

/** The site's live apexes; admin.<apex> and moments.<apex> share their sign-in. */
export const LIVE_APEXES = ['odubostudio.com', 'odubo.studio'];

/** The live apex a hostname belongs to, or null. */
export function liveApex(hostname: string): string | null {
  const host = (hostname.split(':')[0] || '').toLowerCase();
  return LIVE_APEXES.find((apex) => host === apex || host.endsWith(`.${apex}`)) ?? null;
}

/** The Domain for the sign-in cookie on this host: the whole apex when live, else none (host-only). */
export function signInCookieDomain(hostname: string): string | undefined {
  if (process.env.AUTH_COOKIE_DOMAIN) return process.env.AUTH_COOKIE_DOMAIN;
  const apex = liveApex(hostname);
  return apex ? `.${apex}` : undefined;
}

const GONE = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';

/** Log out here and on every other address: the local copy and both kinds of cookie. */
export function clearSignIn(
  doc: { cookie: string } | undefined = typeof document !== 'undefined' ? document : undefined,
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
  store: Pick<Storage, 'removeItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): void {
  try {
    store?.removeItem('token');
  } catch {}
  if (!doc) return;
  doc.cookie = GONE; // a cookie on this host only (signed in before the sign-in was shared)
  const domain = signInCookieDomain(hostname);
  if (domain) doc.cookie = `${GONE}; domain=${domain}`;
}

/**
 * Runs in the head before the page: on a live domain the cookie is the
 * sign-in, so the local copy follows it, taken in when signed in elsewhere,
 * dropped when signed out elsewhere (or expired: both last 7 days).
 * Plain ES5 over `location`, `document` and `localStorage`, so it can be
 * inlined as is, and tested with those three passed in.
 */
export const SIGN_IN_SYNC_BODY = `
  var h = location.hostname, apexes = ${JSON.stringify(LIVE_APEXES)}, live = false;
  for (var i = 0; i < apexes.length; i++) {
    var a = apexes[i];
    if (h === a || h.slice(-(a.length + 1)) === '.' + a) { live = true; break; }
  }
  if (!live) return;
  var m = document.cookie.match(/(?:^|;\\s*)token=([^;]*)/);
  var cookie = m ? decodeURIComponent(m[1]) : '';
  var local = localStorage.getItem('token');
  if (cookie) { if (local !== cookie) localStorage.setItem('token', cookie); }
  else if (local) { localStorage.removeItem('token'); }
`;

export const SIGN_IN_SYNC = `(function(){try{${SIGN_IN_SYNC_BODY}}catch(e){}})();`;
