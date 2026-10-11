import { isStreamUrl, resolveStreamDownload } from '@/lib/social/streamDownload';

const redirect = (location: string | null, status = 302) =>
  (async () => ({ status, headers: new Headers(location ? { location } : {}) })) as unknown as typeof fetch;

describe('a Stream download link a browser can fetch', () => {
  const src = 'https://videodelivery.net/abc123/downloads/default.mp4';

  it('follows the redirect to the signed link', async () => {
    const signed = 'https://videodelivery.net/abc123/dl/default.mp4?p=x&s=y';
    await expect(resolveStreamDownload(src, redirect(signed))).resolves.toBe(signed);
  });

  it('keeps a relative redirect on Stream', async () => {
    await expect(resolveStreamDownload(src, redirect('/abc123/dl/default.mp4?p=1'))).resolves.toBe(
      'https://videodelivery.net/abc123/dl/default.mp4?p=1',
    );
  });

  it('returns the link itself when there is no redirect', async () => {
    await expect(resolveStreamDownload(src, redirect(null, 200))).resolves.toBe(src);
  });

  it('only ever touches Stream', async () => {
    expect(isStreamUrl('https://customer-tpkm273r1u0s40no.cloudflarestream.com/abc/downloads/default.mp4')).toBe(true);
    expect(isStreamUrl('https://evil.example.com/videodelivery.net')).toBe(false);
    expect(isStreamUrl('http://videodelivery.net/abc')).toBe(false);
    await expect(resolveStreamDownload('https://example.com/x.mp4', redirect(null))).rejects.toThrow();
    await expect(resolveStreamDownload(src, redirect('https://evil.example.com/x'))).rejects.toThrow();
  });
});
