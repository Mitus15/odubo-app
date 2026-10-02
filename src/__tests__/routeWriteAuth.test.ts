/**
 * @jest-environment node
 *
 * Every write route says who may call it.
 *
 * Reads every POST/PUT/PATCH/DELETE handler under src/app/api. Each must sit
 * behind one of middleware.ts's fail-closed gates, or verify something itself
 * (a signed session, a signature, a secret), or be listed below with the
 * reason it is open. A new handler that does none of these fails here: gate
 * it (requireAdmin from @/lib/api/requireAdmin is the house gate), or add it
 * to PUBLIC_WRITES and say why. An entry that no longer matches fails too.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const PUBLIC_WRITES: Record<string, string> = {
  'POST /api/admin/accept-invite': 'carries its own credential, the hashed, expiring invite token',
  'POST /api/analytics/events': 'fan analytics',
  'POST /api/analytics/funnel': 'fan analytics',
  'POST /api/analytics/identity': 'fan analytics',
  'POST /api/clips/engagement': 'fan engagement counts',
  'POST /api/contact': 'contact form',
  'POST /api/email/subscribe': 'fan email capture',
  'POST /api/game/scores': 'game leaderboard',
  'POST /api/linktree/[id]': 'link click counter',
  'DELETE /api/loop/admin/login': 'logout',
  'POST /api/loop/ballots/[kind]': 'Loop fan flow',
  'POST /api/loop/cover': 'Loop fan flow',
  'DELETE /api/loop/cover': 'Loop fan flow',
  'POST /api/loop/gift': 'Loop fan flow',
  'POST /api/loop/pass/intent': 'Loop pass flow',
  'POST /api/loop/pass/lookup': 'Loop pass flow',
  'POST /api/loop/pass/waitlist': 'Loop pass flow',
  'POST /api/moments/rsvp': 'public RSVP',
  'POST /api/moments/rsvp/unsubscribe': 'public RSVP',
  'POST /api/orders': 'the store checkout',
  'POST /api/shopify/checkout': 'the store checkout',
  'POST /api/store/cart/sync': "a visitor's cart",
  'POST /api/store/inventory': 'stock check for the cart page',
  // Verified, in a way this scan cannot see.
  'POST /api/webhooks/shopify': 'HMAC via crypto.subtle; fails closed in production',
  'POST /api/moments/thumbnail-job': 'x-thumbnail-secret, only the R2 worker holds it',
  // Write nothing.
  'POST /api/films': 'validates and echoes; no write',
  'POST /api/products': 'answers 405',
  'POST /api/webhooks/clerk': 'disabled; answers 200 and does nothing',
};

// Open, and should not be: each waits on a decision recorded in
// docs/sessions/2026-10-02-clips-banner-and-clip-count.md.
const KNOWN_OPEN: Record<string, string> = {
  'POST /api/stream/webhook': 'skips its signature check when the header is absent; needs the Stream webhook secret',
};

const METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const VERIFIES = /\b(requireAdmin|requireCronOrAdmin|getUserFromRequest|verifyUserFromRequest|isAdminUser|requireAuth|withAdmin|withAuth|isAdminRequest|isRequestFromAdmin|isAdminFromPayload|getAuthContext|getAuthenticatedUser|userHasAnyRole|getUserRoleFromRequest|verifyAdminSession|jwtVerify|verifyShopifyHmac|verifySvix|verifyVoter|lookupPassLink|claimPassOnDevice|findThreadByToken|verifyPassword|verifyEmailToken|timingSafeEqual|createHmac|CRON_SECRET)\b|crypto\.subtle\.verify/;

/** The prefixes middleware.ts verifies before any handler runs. Keep in step with it. */
function behindEdgeGate(route: string): boolean {
  if ((route === '/api/admin' || route.startsWith('/api/admin/')) && route !== '/api/admin/accept-invite') return true;
  if (route.startsWith('/api/command-center/')) return true;
  if (['/api/tracks', '/api/albums'].some((p) => route === p || route.startsWith(`${p}/`))) return true;
  return route.startsWith('/api/loop/admin') && route !== '/api/loop/admin/login';
}

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('_')) routeFiles(p, out);
    } else if (/^route\.(ts|js)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/** "METHOD /api/route" for every write handler that neither an edge gate nor its own code verifies. */
function unverifiedWrites(): string[] {
  const appDir = path.join(process.cwd(), 'src', 'app');
  const found: string[] = [];
  for (const file of routeFiles(path.join(appDir, 'api'))) {
    const route = '/' + path.relative(appDir, path.dirname(file)).split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join('/');
    if (behindEdgeGate(route)) continue;
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const locals = new Map<string, ts.Node>();
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name) locals.set(st.name.text, st);
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) locals.set(d.name.text, d.initializer);
      }
    }
    // A handler's text plus that of the same-file functions it calls.
    const withHelpers = (node: ts.Node, seen = new Set<string>()): string => {
      let text = node.getText(sf);
      const visit = (n: ts.Node) => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && locals.has(n.expression.text) && !seen.has(n.expression.text)) {
          seen.add(n.expression.text);
          text += '\n' + withHelpers(locals.get(n.expression.text)!, seen);
        }
        ts.forEachChild(n, visit);
      };
      visit(node);
      return text;
    };
    const exported = (n: ts.Node) => ts.canHaveModifiers(n) && (ts.getModifiers(n) || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const st of sf.statements) {
      const handlers: Array<[string, ts.Node]> = [];
      if (ts.isFunctionDeclaration(st) && st.name && METHODS.has(st.name.text) && exported(st)) handlers.push([st.name.text, st]);
      if (ts.isVariableStatement(st) && exported(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && METHODS.has(d.name.text) && d.initializer) handlers.push([d.name.text, d.initializer]);
      }
      for (const [method, node] of handlers) if (!VERIFIES.test(withHelpers(node))) found.push(`${method} ${route}`);
    }
  }
  return found.sort();
}

describe('write routes', () => {
  it('each sits behind a gate, verifies its caller, or is listed with a reason', () => {
    const expected = Object.keys({ ...PUBLIC_WRITES, ...KNOWN_OPEN }).sort();
    expect(unverifiedWrites()).toEqual(expected);
  });
});
