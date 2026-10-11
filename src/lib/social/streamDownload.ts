/**
 * Cloudflare Stream's download link (`/<uid>/downloads/default.mp4`) answers
 * with a redirect to a signed `/dl/` URL. The file itself allows any origin to
 * fetch it, but the redirect does not carry that header, so a browser's fetch
 * of the first link fails. The Post view needs the bytes in the browser (to
 * hand the video to the share sheet), so the server follows the redirect once
 * and gives back the signed link.
 *
 * Only Stream's own hosts, so this cannot be pointed at anything else.
 */

const STREAM_HOSTS = [/^videodelivery\.net$/, /^customer-[a-z0-9]+\.cloudflarestream\.com$/];

export function isStreamUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && STREAM_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

/** The URL a browser can fetch for this Stream link: the redirect's target, or the link itself. */
export async function resolveStreamDownload(src: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (!isStreamUrl(src)) throw new Error('Not a Stream URL');
  const res = await fetchImpl(src, { redirect: 'manual' });
  const location = res.headers.get('location');
  if (res.status >= 300 && res.status < 400 && location) {
    const target = new URL(location, src).toString();
    if (!isStreamUrl(target)) throw new Error('Stream redirected off Stream');
    return target;
  }
  return src;
}
