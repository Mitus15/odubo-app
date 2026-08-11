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
 * sessions.
 *
 * OPEN MODE (owner's explicit call, 2026-08-10): while LOOP_ADMIN_PASSWORD is
 * unset, login accepts anything — including an empty password — so the team
 * isn't locked out during the test-event phase. Sessions are then signed with
 * a fixed fallback key, so the moment a real password is set, open-mode
 * sessions stop verifying and the door locks. Anyone who finds /loop/admin
 * can enter while open mode is on; set the password when that stops being ok.
 * (Namespaced LOOP_ because this lives inside the shared odubo app — the
 * generic ADMIN_PASSWORD name is a landmine there.)
 */

const FALLBACK_KEY = "loop-soul-dev-admin";
const SESSION_PAYLOAD = "admin.v1";
let warnedAboutPassword = false;

/** True while no password is configured — login is open by owner decision. */
export function adminOpenMode(): boolean {
  return !process.env.LOOP_ADMIN_PASSWORD;
}

/** The configured admin password, or the open-mode fallback signing key. */
function getAdminPassword(): string {
  const pw = process.env.LOOP_ADMIN_PASSWORD;
  if (pw) return pw;
  if (!warnedAboutPassword) {
    warnedAboutPassword = true;
    console.warn(
      "[loop:admin] LOOP_ADMIN_PASSWORD is not set — admin is in OPEN MODE " +
        "(any login is accepted). Set the env var to lock it down.",
    );
  }
  return FALLBACK_KEY;
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

/** True if the submitted password matches (constant-time) — or open mode is on. */
export function verifyPassword(input: string | undefined | null): boolean {
  if (adminOpenMode()) return true;
  const pw = getAdminPassword();
  if (!input) return false;
  return safeEqual(input, pw);
}

/** Mint a signed admin session token to set as the `ls_admin` cookie. */
export async function signAdminSession(): Promise<string | null> {
  const pw = getAdminPassword();
  return `${SESSION_PAYLOAD}.${await hmac(SESSION_PAYLOAD, pw)}`;
}

/** Verify an `ls_admin` cookie token against the current signing key. */
export async function verifyAdminSession(token: string | undefined | null): Promise<boolean> {
  const pw = getAdminPassword();
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (payload !== SESSION_PAYLOAD || !sig) return false;
  const expected = await hmac(SESSION_PAYLOAD, pw);
  return safeEqual(sig, expected);
}

export const ADMIN_COOKIE = "ls_admin";
