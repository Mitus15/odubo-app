import { isStreamUid } from '@/lib/stills';
import { sharpManifest, streamSource } from '@/lib/streams';

/**
 * /streams/<uid>.m3u8: a site copy's manifest with only its sharp renditions
 * (lib/streams). The renditions themselves come from Stream as they are. A
 * copy never changes under its uid, so the manifest is kept a day at the
 * edge and an hour in the browser.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const uid = (await params).name.replace(/\.m3u8$/, '');
  if (!isStreamUid(uid)) return new Response('No stream', { status: 404 });
  const source = streamSource(uid);
  const res = await fetch(source, { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) return new Response('No stream', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  return new Response(sharpManifest(await res.text(), source), {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'Vercel-CDN-Cache-Control': 'max-age=86400, stale-while-revalidate=604800',
    },
  });
}
