/**
 * A site copy's stream, served sharp (lib/streams): the manifest the site
 * serves holds only the renditions that read sharp, so neither player can
 * start a room blurry.
 */
import { SHARP_LINES, sharpManifest, streamSource, streamUid, streamUrl } from '@/lib/streams';

const UID = '019a45a39ffbdedcbd23254230baeaf5';
const SOURCE = streamSource(UID);

/** Stream's manifest for a copy, as it came on 2026-10-28 */
const MASTER = [
  '#EXTM3U',
  '#EXT-X-VERSION:6',
  '#EXT-X-INDEPENDENT-SEGMENTS',
  '#EXT-X-STREAM-INF:RESOLUTION=1080x1920,CODECS="avc1.4d4028",BANDWIDTH=1252978,AVERAGE-BANDWIDTH=918484,SCORE=5.0,FRAME-RATE=30.000',
  'stream_t8237_r1974695156.m3u8',
  '#EXT-X-STREAM-INF:RESOLUTION=720x1280,CODECS="avc1.4d401f",BANDWIDTH=720652,AVERAGE-BANDWIDTH=531920,SCORE=4.0,FRAME-RATE=30.000',
  'stream_t8237_r1974694921.m3u8',
  '#EXT-X-STREAM-INF:RESOLUTION=480x852,CODECS="avc1.4d401f",BANDWIDTH=441042,AVERAGE-BANDWIDTH=335146,SCORE=3.0,FRAME-RATE=30.000',
  'stream_t8237_r1974694209.m3u8',
  '#EXT-X-STREAM-INF:RESOLUTION=360x640,CODECS="avc1.4d401e",BANDWIDTH=319760,AVERAGE-BANDWIDTH=240266,SCORE=2.0,FRAME-RATE=30.000',
  'stream_t8237_r1974694048.m3u8',
  '#EXT-X-STREAM-INF:RESOLUTION=240x426,CODECS="avc1.42c015",BANDWIDTH=236702,AVERAGE-BANDWIDTH=178990,SCORE=1.0,FRAME-RATE=30.000',
  'stream_t8237_r1974693991.m3u8',
].join('\n');

describe('sharpManifest', () => {
  const served = sharpManifest(MASTER, SOURCE);
  const lines = served.split('\n');

  it('keeps the 1080 and 720 renditions, sharpest first, and drops 480, 360 and 240', () => {
    const sizes = lines.filter((l) => l.startsWith('#EXT-X-STREAM-INF')).map((l) => /RESOLUTION=(\d+x\d+)/.exec(l)![1]);
    expect(sizes).toEqual(['1080x1920', '720x1280']);
    expect(SHARP_LINES).toBe(720);
  });

  it('makes every rendition address absolute, beside the manifest it came from', () => {
    expect(lines[4]).toBe(`https://videodelivery.net/${UID}/manifest/stream_t8237_r1974695156.m3u8`);
    expect(lines[6]).toBe(`https://videodelivery.net/${UID}/manifest/stream_t8237_r1974694921.m3u8`);
    expect(served).not.toContain('r1974693991');
  });

  it('keeps the header lines as they are', () => {
    expect(lines.slice(0, 3)).toEqual(['#EXTM3U', '#EXT-X-VERSION:6', '#EXT-X-INDEPENDENT-SEGMENTS']);
  });

  it('keeps a landscape copy by its shorter side, and I-frame playlists with their URI made absolute', () => {
    const master = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:RESOLUTION=1920x1080,BANDWIDTH=1000000',
      'wide.m3u8',
      '#EXT-X-STREAM-INF:RESOLUTION=852x480,BANDWIDTH=400000',
      'small.m3u8',
      '#EXT-X-I-FRAME-STREAM-INF:RESOLUTION=1920x1080,BANDWIDTH=90000,URI="iframes.m3u8"',
    ].join('\n');
    expect(sharpManifest(master, SOURCE)).toBe(
      [
        '#EXTM3U',
        '#EXT-X-STREAM-INF:RESOLUTION=1920x1080,BANDWIDTH=1000000',
        `https://videodelivery.net/${UID}/manifest/wide.m3u8`,
        `#EXT-X-I-FRAME-STREAM-INF:RESOLUTION=1920x1080,BANDWIDTH=90000,URI="https://videodelivery.net/${UID}/manifest/iframes.m3u8"`,
      ].join('\n'),
    );
  });

  it('keeps a rendition with no RESOLUTION, since it cannot be told blurry', () => {
    const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nonly.m3u8';
    expect(sharpManifest(master, SOURCE)).toContain(`https://videodelivery.net/${UID}/manifest/only.m3u8`);
  });
});

describe('streamUrl and streamUid', () => {
  it("names the site's own address for a copy, and reads the uid back from it or from Stream's", () => {
    expect(streamUrl(UID)).toBe(`/streams/${UID}.m3u8`);
    expect(streamUid(streamUrl(UID))).toBe(UID);
    expect(streamUid(`https://odubo.studio/streams/${UID}.m3u8`)).toBe(UID);
    expect(streamUid(SOURCE)).toBe(UID);
  });

  it('reads nothing from anything else', () => {
    expect(streamUid(null)).toBeUndefined();
    expect(streamUid('/streams/not-a-uid.m3u8')).toBeUndefined();
    expect(streamUid(`https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg`)).toBe(UID);
    expect(streamUid('/stills/019a45a39ffbdedcbd23254230baeaf5.jpg')).toBeUndefined();
  });
});
