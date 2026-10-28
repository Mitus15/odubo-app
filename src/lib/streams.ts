/**
 * A site copy's stream, served sharp.
 *
 * Stream's own manifest offers every rendition down to 240p, and on a weak
 * start both players took it: Apple's measures the first segment, drops to
 * 240p or 480p and climbs back a step a time, which took a minute of blur on
 * his phone (2026-10-27); hls.js started where the browser's guess of the
 * line put it. The site serves the manifest itself (app/streams/[name]), with
 * only the renditions that read sharp on a phone (720 lines and up, the
 * sharp bar in RoomVideo), so neither player can go below them. Below about
 * half a megabit the picture holds rather than blurs; a copy's 720p averages
 * ~0.45 Mbps and its 1080p ~0.8 Mbps, so that is a line the site never
 * expects. The sharpest rendition stays first: Apple's player starts on it.
 */

/** The smaller side of a rendition that still reads sharp on a phone (720x1280 of a portrait copy) */
export const SHARP_LINES = 720;

/** The site's own address for a copy's manifest (app/streams/[name]) */
export function streamUrl(uid: string): string {
  return `/streams/${uid}.m3u8`;
}

/** Stream's own manifest for a copy, where the site's is made from */
export function streamSource(uid: string): string {
  return `https://videodelivery.net/${uid}/manifest/video.m3u8`;
}

/** A copy's uid from its manifest address, the site's or Stream's; undefined for anything else */
export function streamUid(url: string | null | undefined): string | undefined {
  return /(?:^|\/)(?:streams|videodelivery\.net)\/([a-f0-9]{32})(?:\.m3u8|\/)/.exec(url || '')?.[1];
}

/**
 * The manifest with its blurry renditions taken out and every address made
 * absolute, so it can be served from anywhere. The order is Stream's. A
 * rendition is a #EXT-X-STREAM-INF line and the address on the next; its
 * RESOLUTION is WxH. Everything else (I-frame playlists, media groups) is kept,
 * with the addresses in their URI="" made absolute too.
 */
export function sharpManifest(master: string, source: string): string {
  const absolute = (uri: string) => new URL(uri, source).toString();
  const lines = master.split(/\r?\n/);
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const uri = lines[++i] ?? '';
      const size = /RESOLUTION=(\d+)x(\d+)/.exec(line);
      if (size && Math.min(Number(size[1]), Number(size[2])) < SHARP_LINES) continue;
      kept.push(line, absolute(uri.trim()));
    } else if (line.startsWith('#')) {
      kept.push(line.replace(/URI="([^"]*)"/g, (_m, uri: string) => `URI="${absolute(uri)}"`));
    } else {
      kept.push(line.trim() ? absolute(line.trim()) : line);
    }
  }
  return kept.join('\n');
}
