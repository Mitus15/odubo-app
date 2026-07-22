/**
 * Anonymous voter identity for the Soul Loop Anthem.
 *
 * The Gathering is public and pre-purchase, so a vote needs an identity without
 * a login. We mint a random id and sign it with HMAC so the cookie can't be
 * forged into someone else's id (it CAN be cleared — that limitation is by
 * design for a promo "soul of the room" vote, and is hardenable later by
 * binding identity to the event code).
 *
 * Web Crypto (crypto.subtle) is used so this runs identically in middleware
 * (edge) and in route handlers. The token format is `<id>.<base64url(hmac)>`.
 *
 * Set `ANTHEM_VOTE_SECRET` in the environment before any real run; a dev
 * fallback keeps local work frictionless (with a one-time warning).
 */

const DEV_SECRET = "loop-soul-dev-anthem-secret-change-me";
let warnedAboutSecret = false;

function getSecret(): string {
  const secret = process.env.ANTHEM_VOTE_SECRET;
  if (secret) return secret;
  // Fail closed in production: shipping the committed dev key would let anyone
  // who reads the repo forge vote cookies.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ANTHEM_VOTE_SECRET must be set in production so vote cookies can't be forged.",
    );
  }
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      "[anthem] ANTHEM_VOTE_SECRET is not set — using an insecure dev fallback. " +
        "Set it before any deploy so vote cookies can't be forged.",
    );
  }
  return DEV_SECRET;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

/** Constant-time string compare to avoid leaking the signature byte-by-byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Sign a raw voter id into a tamper-evident cookie token. */
export async function signVoter(id: string): Promise<string> {
  return `${id}.${await hmac(id)}`;
}

/** Verify a cookie token; returns the voter id, or null if missing/forged. */
export async function verifyVoter(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!id || !sig) return null;
  const expected = await hmac(id);
  return safeEqual(sig, expected) ? id : null;
}

/** Mint a fresh signed voter identity. */
export async function mintVoter(): Promise<{ id: string; token: string }> {
  const id = crypto.randomUUID();
  return { id, token: await signVoter(id) };
}

export const VOTER_COOKIE = "ls_voter";
