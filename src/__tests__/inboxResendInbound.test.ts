/**
 * @jest-environment node
 *
 * Svix signature verification for the Resend inbound webhook. The vectors
 * are computed here with the same primitive so the test pins the wire
 * format (id.timestamp.body, base64 secret after whsec_, v1 entries).
 */
import { verifySvix } from '@/lib/inbox/resend-inbound';

const SECRET_BYTES = new Uint8Array(24).map((_, i) => (i * 37) % 256);
const secret = `whsec_${Buffer.from(SECRET_BYTES).toString('base64')}`;

async function sign(id: string, ts: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', SECRET_BYTES, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  return Buffer.from(mac).toString('base64');
}

const body = JSON.stringify({ type: 'email.received', data: { email_id: 'e1' } });
const now = 1_789_349_727;

describe('verifySvix', () => {
  it('accepts a correctly signed request', async () => {
    const sig = await sign('msg_1', String(now), body);
    expect(await verifySvix({ id: 'msg_1', timestamp: String(now), signature: `v1,${sig}` }, body, secret, now)).toBe(true);
  });

  it('accepts when any of several v1 signatures matches', async () => {
    const sig = await sign('msg_1', String(now), body);
    const header = `v1,${Buffer.from('nope').toString('base64')} v1,${sig}`;
    expect(await verifySvix({ id: 'msg_1', timestamp: String(now), signature: header }, body, secret, now)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const sig = await sign('msg_1', String(now), body);
    expect(await verifySvix({ id: 'msg_1', timestamp: String(now), signature: `v1,${sig}` }, `${body} `, secret, now)).toBe(false);
  });

  it('rejects a stale timestamp', async () => {
    const old = String(now - 10 * 60);
    const sig = await sign('msg_1', old, body);
    expect(await verifySvix({ id: 'msg_1', timestamp: old, signature: `v1,${sig}` }, body, secret, now)).toBe(false);
  });

  it('rejects missing headers', async () => {
    expect(await verifySvix({ id: null, timestamp: String(now), signature: 'v1,x' }, body, secret, now)).toBe(false);
  });
});
