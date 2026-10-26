/**
 * @jest-environment node
 */
import { SIGN_IN_SYNC_BODY, clearSignIn, liveApex, signInCookieDomain } from '@/lib/signIn';

describe('which addresses share a sign-in', () => {
  it('gives the whole live apex to www, admin and moments', () => {
    for (const host of ['www.odubostudio.com', 'admin.odubostudio.com', 'moments.odubostudio.com', 'odubostudio.com']) {
      expect(signInCookieDomain(host)).toBe('.odubostudio.com');
    }
  });

  it('keeps the cookie on its own host anywhere else, and is not fooled by a look-alike', () => {
    for (const host of ['odubo-studio-app.vercel.app', 'localhost', 'localhost:3000', 'evilodubostudio.com']) {
      expect(signInCookieDomain(host)).toBeUndefined();
    }
    expect(liveApex('Admin.OduboStudio.com:443')).toBe('odubostudio.com');
  });
});

describe('logging out', () => {
  const run = (hostname: string) => {
    const writes: string[] = [];
    const doc = { set cookie(v: string) { writes.push(v); }, get cookie() { return ''; } };
    const removed: string[] = [];
    clearSignIn(doc, hostname, { removeItem: (k: string) => { removed.push(k); } });
    return { writes, removed };
  };

  it('on a live address clears the local copy, the host cookie and the shared one', () => {
    const { writes, removed } = run('admin.odubostudio.com');
    expect(removed).toEqual(['token']);
    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatch(/^token=; path=\/;.*max-age=0$/);
    expect(writes[1]).toMatch(/; domain=\.odubostudio\.com$/);
  });

  it('elsewhere clears the local copy and the host cookie only', () => {
    const { writes, removed } = run('odubo-studio-app.vercel.app');
    expect(removed).toEqual(['token']);
    expect(writes).toHaveLength(1);
  });
});

describe('the page-load sync', () => {
  const sync = (hostname: string, cookie: string, local: string | null) => {
    const store = new Map<string, string>(local === null ? [] : [['token', local]]);
    const localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
    new Function('location', 'document', 'localStorage', SIGN_IN_SYNC_BODY)({ hostname }, { cookie }, localStorage);
    return store.get('token') ?? null;
  };

  it('takes in a sign-in made on another address', () => {
    expect(sync('admin.odubostudio.com', 'theme=dark; token=abc.def.ghi', null)).toBe('abc.def.ghi');
  });

  it('follows the cookie when the local copy is an older sign-in', () => {
    expect(sync('www.odubostudio.com', 'token=new', 'old')).toBe('new');
  });

  it('drops the local copy once the cookie is gone (signed out elsewhere, or expired)', () => {
    expect(sync('moments.odubostudio.com', 'theme=dark', 'stale')).toBeNull();
  });

  it('leaves other hosts alone', () => {
    expect(sync('odubo-studio-app.vercel.app', '', 'kept')).toBe('kept');
    expect(sync('localhost', '', 'kept')).toBe('kept');
  });
});

describe('the sign-in response', () => {
  it('sends the shared cookie and clears a host-only one, both kept by Next', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NextResponse } = require('next/server');
    const res = NextResponse.json({ ok: true });
    res.cookies.set('token', 'jwt', { path: '/', sameSite: 'lax', maxAge: 604800, domain: signInCookieDomain('www.odubostudio.com') });
    res.headers.append('Set-Cookie', 'token=; Path=/; Max-Age=0; SameSite=Lax; Secure');
    const sent: string[] = res.headers.getSetCookie();
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatch(/^token=jwt;.*Domain=\.odubostudio\.com/i);
    expect(sent[1]).toMatch(/^token=; Path=\/; Max-Age=0/);
    expect(sent[1]).not.toMatch(/Domain=/i);
  });
});
