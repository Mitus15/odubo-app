import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

// A single default live input name for the site
const LIVE_NAME = process.env.LIVE_INPUT_NAME || 'odubo-live';

// The existing live input by name, or null
async function findLiveInput(stream: CloudflareStreamAPI) {
  try {
    const list: any = await stream.listLiveInputs({ search: LIVE_NAME });
    return (Array.isArray(list?.result) ? list.result.find((li: any) => li?.meta?.name === LIVE_NAME) : null) ?? null;
  } catch {
    return null;
  }
}

async function ensureLiveInput(stream: CloudflareStreamAPI) {
  const found = await findLiveInput(stream);
  if (found) return found;

  // Create new with automatic recording and allowedOrigins
  const allowedOrigins = process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : undefined;
  const created: any = await stream.createLiveInput(LIVE_NAME, { recordingMode: 'automatic', allowedOrigins });
  return created?.result || created;
}

/**
 * The live input. `rtmps` holds the stream key and `whip` the WebRTC publish
 * URL: whoever has them can broadcast as the site. Until 2026-10-02 this
 * handed both to anyone, and a visit created the input when there was none.
 * Now an admin gets everything, as the admin Live page shows it, and anyone
 * else gets only what the public /live player uses: the uid and playback URLs.
 */
export async function GET(req: NextRequest) {
  try {
    const isAdmin = isAdminUser(await getUserFromRequest(req));
    const stream = new CloudflareStreamAPI();
    // An admin's visit creates the input if there is none; nobody else's does
    const li = isAdmin ? await ensureLiveInput(stream) : await findLiveInput(stream);
    // Normalize fields
    const result = li?.result || li;
    const playbackUid = result?.uid; // Stream live playback uses the live input UID
    const hls = playbackUid ? stream.getHlsUrl(playbackUid) : undefined;
    const embed = playbackUid ? stream.getEmbedUrl(playbackUid, { autoplay: false, controls: true }) : undefined;
    if (!isAdmin) {
      return NextResponse.json({
        success: true,
        liveInput: playbackUid ? { uid: playbackUid, playback: { hls, embed } } : null,
      });
    }
    const rtmps = result?.rtmps || {};
    const whip = result?.whip || {};
    return NextResponse.json({
      success: true,
      liveInput: {
        uid: result?.uid,
        created: result?.created,
        status: result?.status,
        meta: result?.meta,
        rtmps,
        whip,
        playback: { hls, embed },
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get live input', details: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Admin-only endpoint to (re)create the default live input
  const user = await getUserFromRequest(req);
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const stream = new CloudflareStreamAPI();
    const allowedOrigins = process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : undefined;
    const created: any = await stream.createLiveInput(LIVE_NAME, { recordingMode: 'automatic', allowedOrigins });
    const result = created?.result || created;
    const playbackUid = result?.uid;
    const hls = playbackUid ? stream.getHlsUrl(playbackUid) : undefined;
    const embed = playbackUid ? stream.getEmbedUrl(playbackUid, { autoplay: false, controls: true }) : undefined;
    return NextResponse.json({ success: true, liveInput: { ...result, playback: { hls, embed } } }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to create live input', details: String(e) }, { status: 500 });
  }
}
