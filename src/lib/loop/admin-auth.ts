/**
 * Admin session identity for /loop/admin and /api/loop/admin/*.
 *
 * The marketing team logs in once with LOOP_ADMIN_PASSWORD; we hand back a signed,
 * tamper-evident cookie (`ls_admin`) that middleware checks on every admin
 * request. Same Web Crypto (crypto.subtle) approach as `anthem-identity.ts` so
 * it verifies identically in edge middleware and in route handlers.
 *
 * The HMAC key IS the admin password, so: only someone who knows the password
 * can forge a session, and rotating the password instantly invalidates old
 * sessions. Fails CLOSED — if no password is configured, login and verification
 * both reject.
 *
 * Set LOOP_ADMIN_PASSWORD before any deploy. A dev fallback keeps local work
 * frictionless (with a one-time warning); it is refused in production.
 * (Namespaced LOOP_ because this lives inside the shared odubo app — the
 * generic ADMIN_PASSWORD name is a landmine there.)
 */

const DEV_PASSWORD = "loop-soul-dev-admin";
const SESSION_PAYLOAD = "admin.v1";
let warnedAboutPassword = false;

/** The configured admin password, or a dev fallback outside production. */
function getAdminPassword(): string | null {
  const pw = process.env.LOOP_ADMIN_PASSWORD;
  if (pw) return pw;
  if (process.env.NODE_ENV === "production") return null; // fail closed in prod
  if (!warnedAboutPassword) {
    warnedAboutPassword = true;
    console.warn(
      "[loop:admin] LOOP_ADMIN_PASSWORD is not set — using an insecure dev fallback " +
        `("${DEV_PASSWORD}"). Set it before any deploy.`,
    );
  }
  return DEV_PASSWORD;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string, keyMaterial: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

/** Constant-time string compare so we don't leak the secret byte-by-byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True if the submitted password matches the configured one (constant-time). */
export function verifyPassword(input: string | undefined | null): boolean {
  const pw = getAdminPassword();
  if (!pw || !input) return false;
  return safeEqual(input, pw);
}

/** Mint a signed admin session token to set as the `ls_admin` cookie. */
export async function signAdminSession(): Promise<string | null> {
  const pw = getAdminPassword();
  if (!pw) return null;
  return `${SESSION_PAYLOAD}.${await hmac(SESSION_PAYLOAD, pw)}`;
}

/** Verify an `ls_admin` cookie token. Fails closed if no password configured. */
export async function verifyAdminSession(token: string | undefined | null): Promise<boolean> {
  const pw = getAdminPassword();
  if (!pw || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (payload !== SESSION_PAYLOAD || !sig) return false;
  const expected = await hmac(SESSION_PAYLOAD, pw);
  return safeEqual(sig, expected);
}

export const ADMIN_COOKIE = "ls_admin";
