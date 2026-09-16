/**
 * @jest-environment node
 *
 * The JWT gate. It used to decode the payload without checking the signature,
 * so a forged unsigned `{"is_admin":true}` token passed. These lock the fix.
 */
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { getUserFromRequest, verifyUserFromRequest } from "@/lib/auth";

const SECRET = "test-secret-for-auth";

function reqWithToken(token: string): NextRequest {
  return new NextRequest("https://x.test/api/anything", {
    headers: { authorization: `Bearer ${token}` },
  });
}

/** A token whose payload claims admin but is signed with the "alg:none" trick. */
function forgedUnsigned(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.`;
}

async function signed(payload: Record<string, unknown>, opts: { expired?: boolean } = {}): Promise<string> {
  const t = new SignJWT(payload).setProtectedHeader({ alg: "HS256" });
  t.setExpirationTime(opts.expired ? "-1h" : "1h");
  return t.sign(new TextEncoder().encode(SECRET));
}

describe("getUserFromRequest", () => {
  const prev = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.JWT_SECRET = prev;
  });

  it("refuses a forged, unsigned admin token", async () => {
    const token = forgedUnsigned({ userId: "x", email: "x@x.com", is_admin: true });
    expect(await getUserFromRequest(reqWithToken(token))).toBeNull();
  });

  it("refuses a token signed with the wrong secret", async () => {
    const t = await new SignJWT({ userId: "x", email: "x@x.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("not-the-secret"));
    expect(await getUserFromRequest(reqWithToken(t))).toBeNull();
  });

  it("accepts a properly signed token", async () => {
    const token = await signed({ userId: "u1", email: "u1@x.com", is_admin: true });
    const user = await getUserFromRequest(reqWithToken(token));
    expect(user).toMatchObject({ userId: "u1", email: "u1@x.com", is_admin: true });
  });

  it("refuses an expired token", async () => {
    const token = await signed({ userId: "u1", email: "u1@x.com" }, { expired: true });
    expect(await getUserFromRequest(reqWithToken(token))).toBeNull();
  });

  it("refuses a signed token missing userId or email", async () => {
    expect(await getUserFromRequest(reqWithToken(await signed({ email: "u1@x.com" })))).toBeNull();
    expect(await getUserFromRequest(reqWithToken(await signed({ userId: "u1" })))).toBeNull();
  });

  it("returns null when there is no token", async () => {
    expect(await getUserFromRequest(new NextRequest("https://x.test/api/x"))).toBeNull();
  });

  it("verifyUserFromRequest is the same verified gate", () => {
    expect(verifyUserFromRequest).toBe(getUserFromRequest);
  });
});
