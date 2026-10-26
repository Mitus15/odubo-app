import type { NextRequest } from "next/server";
import { verifyUserFromRequest, isAdminUser } from "@/lib/auth";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/loop/admin-auth";

/**
 * An owner or team session, verified: an Odubo admin's signed JWT, or the
 * Loop team's signed `ls_admin` cookie. Never a decoded-but-unchecked token.
 *
 * One definition for every gate that lets an admin past what the public may
 * not have yet (the unreleased record, a hidden video), so those gates cannot
 * disagree about who an admin is. Lives outside the Loop audio gate because
 * the video API asks it too.
 *
 * `req` is null from a server component; the Loop cookie is read from the
 * request scope either way.
 */
export async function isAdminRequest(req: NextRequest | null): Promise<boolean> {
  const [loopAdminOk, odubo] = await Promise.all([
    (async () => {
      try {
        const { cookies } = await import("next/headers");
        return await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
      } catch {
        return false;
      }
    })(),
    req ? verifyUserFromRequest(req).catch(() => null) : Promise.resolve(null),
  ]);
  return loopAdminOk || isAdminUser(odubo);
}
