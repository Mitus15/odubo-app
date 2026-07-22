import { NextResponse } from "next/server";
import { ADMIN_COOKIE, signAdminSession, verifyPassword } from "@/lib/loop/admin-auth";

/**
 * Admin login: exchange ADMIN_PASSWORD for a signed `ls_admin` session cookie.
 * Middleware gates /admin and /api/admin/* on this cookie. DELETE logs out.
 */
export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };

  if (!verifyPassword(password)) {
    // Same response whether the password is wrong or unconfigured — no oracle.
    return NextResponse.json({ error: "incorrect password" }, { status: 401 });
  }

  const token = await signAdminSession();
  if (!token) {
    return NextResponse.json({ error: "admin login is not configured" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
