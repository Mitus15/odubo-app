import { correctedStill } from '@/lib/stillsServer';

/**
 * /stills/<uid>.jpg?h=<height>[&t=<seconds>]: a site copy's still in its true colour
 * (lib/stills). A copy never changes under its uid, so the still is kept a
 * year, at the edge and in the browser, and Stream and the correction are
 * paid once.
 */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const uid = (await params).name.replace(/\.jpg$/, '');
  const query = new URL(req.url).searchParams;
  const height = Number(query.get('h')) || 1920;
  const still = await correctedStill(uid, height, Number(query.get('t')) || 0).catch(() => null);
  if (!still) return new Response('No still', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  return new Response(new Uint8Array(still), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      // next.config's rule for *.jpg rewrites Cache-Control without s-maxage; this one it leaves, and Vercel's edge reads it
      'Vercel-CDN-Cache-Control': 'max-age=31536000',
    },
  });
}
