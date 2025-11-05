import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import CloudflareStreamAPI from '@/lib/cloudflareStream';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

// A single default live input name for the site
const LIVE_NAME = process.env.LIVE_INPUT_NAME || 'odubo-live';

async function ensureLiveInput(stream: CloudflareStreamAPI) {
  // Try to find an existing live input by name
  try {
    const list: any = await stream.listLiveInputs({ search: LIVE_NAME });
    const found = Array.isArray(list?.result) ? list.result.find((li: any) => li?.meta?.name === LIVE_NAME) : null;
    if (found) return found;
  } catch {}

  // Create new with automatic recording and allowedOrigins
  const allowedOrigins = process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : undefined;
  const created: any = await stream.createLiveInput(LIVE_NAME, { recordingMode: 'automatic', allowedOrigins });
  return created?.result || created;
}

export async function GET() {
  try {
    const stream = new CloudflareStreamAPI();
    // Prefer returning existing live input if present, otherwise create one
    const li = await ensureLiveInput(stream);
    // Normalize fields
    const result = li?.result || li;
    const playbackUid = result?.uid; // Stream live playback uses the live input UID
    const rtmps = result?.rtmps || {};
    const whip = result?.whip || {};
    const hls = playbackUid ? stream.getHlsUrl(playbackUid) : undefined;
    const embed = playbackUid ? stream.getEmbedUrl(playbackUid, { autoplay: false, controls: true }) : undefined;
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
  const user = getUserFromRequest(req);
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
