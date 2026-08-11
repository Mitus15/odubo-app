import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { isHolder } from "@/lib/loop/event-codes";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/loop/admin-auth";
import { ensureLoopGallery, listWallPhotos } from "@/lib/loop/wall/server";

/**
 * Read the Wall. Media sharing is for attendees: the full wall requires a
 * redeemed event code (the same gate as the Portal). The exception is
 * ?featured=1 — Iconic Moments are admin-curated and public; they're Legacy's
 * outward face. Hidden shots are excluded either way.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "24", 10) || 24, 1), 60);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
  const featuredOnly = searchParams.get("featured") === "1";

  const event = await getCurrentEvent();

  if (!featuredOnly) {
    const store = await cookies();
    const isAdmin = await verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
    if (!isAdmin) {
      const voterId = await currentVoterId();
      if (voterId === "anonymous" || !(await isHolder(event.id, voterId))) {
        return NextResponse.json(
          { error: "The Wall is for attendees — redeem your event code." },
          { status: 403 },
        );
      }
    }
  }

  const gallery = await ensureLoopGallery(event);
  const photos = await listWallPhotos({ galleryId: gallery.id, featuredOnly, limit, offset });

  return NextResponse.json(
    { photos, hasMore: photos.length >= limit },
    {
      headers: {
        // Attendee-gated responses must not be shared through the CDN cache;
        // only the public curated cut is cacheable.
        "Cache-Control": featuredOnly
          ? "public, s-maxage=30, stale-while-revalidate=60"
          : "private, no-store",
      },
    },
  );
}
