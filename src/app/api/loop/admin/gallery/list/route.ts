import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { ensureLoopGallery, listWallPhotos } from "@/lib/loop/wall/server";

/** Admin view of the Wall — sees everything, including hidden shots.
 *  Auth: middleware gates every /api/loop/admin/* route behind `ls_admin`. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  const event = await getCurrentEvent();
  const gallery = await ensureLoopGallery(event);
  const all = await listWallPhotos({
    galleryId: gallery.id,
    includeHidden: true,
    limit,
    offset,
  });

  const photos =
    filter === "pending"
      ? all.filter((p) => !p.moderated)
      : filter === "featured"
        ? all.filter((p) => p.featured === 1)
        : filter === "hidden"
          ? all.filter((p) => p.moderated === 2)
          : all;

  return NextResponse.json({ photos, hasMore: all.length >= limit });
}
