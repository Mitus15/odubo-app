import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/loop/admin-auth";
import { parseScannedCode } from "@/lib/loop/door";

export const dynamic = "force-dynamic";

/**
 * /loop/d?c=LOOP-XXXX — where a ticket's QR points.
 *
 * The host's phone (signed admin cookie) goes straight to the door scanner
 * with the pass in hand. Anyone else scanned their own ticket, so they land on
 * "Enter your pass" with the code already typed. One QR, two readers, and
 * neither meets a login page.
 */
export default async function DoorLanding({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const code = parseScannedCode(c ?? null);
  const q = code ? `?c=${encodeURIComponent(code)}` : "";
  const admin = await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
  redirect(admin ? `/loop/admin/door${q}` : `/loop/code${q}`);
}
