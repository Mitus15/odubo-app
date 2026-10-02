import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * Every exported route handler under src/app/api, read from its source, and
 * whether anything checks who is calling it.
 *
 * For the guard tests (src/__tests__/routeWriteAuth.test.ts and
 * routeReadAuth.test.ts); the app never imports it.
 *
 * A verifier counts where it runs: in the handler's code, or in a same-file
 * function the handler calls. A name in a comment does not count, and neither
 * does one inside writeAuditLog(...), which only labels the log line. Until
 * 2026-10-02 the write guard read the handler as text, so
 * POST /api/videos/cleanup, which deletes from R2, passed on the strength of
 * its audit call.
 *
 * A tripwire, not a proof: a handler that asks who the caller is and then
 * ignores the answer still counts as verifying.
 */

/** Checks of a caller: a session, a signature, a secret, a token. */
const VERIFIERS = new Set([
  'requireAdmin',
  'requireCronOrAdmin',
  'getUserFromRequest',
  'verifyUserFromRequest',
  'isAdminUser',
  'requireAuth',
  'withAdmin',
  'withAuth',
  'isAdminRequest',
  'isRequestFromAdmin',
  'isAdminFromPayload',
  'getAuthContext',
  'getAuthenticatedUser',
  'userHasAnyRole',
  'getUserRoleFromRequest',
  'verifyAdminSession',
  'jwtVerify',
  'verifyShopifyHmac',
  'verifySvix',
  'verifyVoter',
  'lookupPassLink',
  'claimPassOnDevice',
  'findThreadByToken',
  'verifyPassword',
  'verifyEmailToken',
  'timingSafeEqual',
  'createHmac',
  'CRON_SECRET',
]);

/** The paths middleware.ts verifies before any handler runs. Keep in step with it. */
export function behindEdgeGate(method: string, route: string): boolean {
  if ((route === '/api/admin' || route.startsWith('/api/admin/')) && route !== '/api/admin/accept-invite') return true;
  if (route.startsWith('/api/command-center/')) return true;
  if (route.startsWith('/api/loop/admin') && route !== '/api/loop/admin/login') return true;
  // Catalogue reads stay open; only its writes are gated.
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return false;
  return ['/api/tracks', '/api/albums'].some((p) => route === p || route.startsWith(`${p}/`));
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

/** Whether a node, or a same-file function it calls, names a verifier in code. */
function namesVerifier(node: ts.Node, locals: Map<string, ts.Node>, seen = new Set<string>()): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'writeAuditLog') return;
    if (ts.isIdentifier(n) && VERIFIERS.has(n.text)) {
      found = true;
      return;
    }
    if (ts.isPropertyAccessExpression(n) && /\bcrypto\.subtle\.verify$/.test(n.getText())) {
      found = true;
      return;
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const helper = locals.get(n.expression.text);
      if (helper && !seen.has(n.expression.text)) {
        seen.add(n.expression.text);
        if (namesVerifier(helper, locals, seen)) {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

export type RouteHandler = { method: string; route: string; verifies: boolean };

/** Every exported handler for these methods under src/app/api. */
export function routeHandlers(methods: readonly string[]): RouteHandler[] {
  const wanted = new Set(methods);
  const appDir = path.join(process.cwd(), 'src', 'app');
  const found: RouteHandler[] = [];
  for (const file of routeFiles(path.join(appDir, 'api'))) {
    const route = '/' + path.relative(appDir, path.dirname(file)).split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join('/');
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const locals = new Map<string, ts.Node>();
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name) locals.set(st.name.text, st);
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) locals.set(d.name.text, d.initializer);
      }
    }
    const exported = (n: ts.Node) => ts.canHaveModifiers(n) && (ts.getModifiers(n) || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const st of sf.statements) {
      const handlers: Array<[string, ts.Node]> = [];
      if (ts.isFunctionDeclaration(st) && st.name && wanted.has(st.name.text) && exported(st)) handlers.push([st.name.text, st]);
      if (ts.isVariableStatement(st) && exported(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && wanted.has(d.name.text) && d.initializer) handlers.push([d.name.text, d.initializer]);
      }
      for (const [method, node] of handlers) found.push({ method, route, verifies: namesVerifier(node, locals) });
    }
  }
  return found;
}

/** "METHOD /api/route" for each handler that neither middleware.ts nor its own code verifies, sorted. */
export function unverifiedHandlers(methods: readonly string[]): string[] {
  return routeHandlers(methods)
    .filter((h) => !h.verifies && !behindEdgeGate(h.method, h.route))
    .map((h) => `${h.method} ${h.route}`)
    .sort();
}
