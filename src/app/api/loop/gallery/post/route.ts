import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { hasRoomAccess } from "@/lib/loop/doors";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/loop/admin-auth";
import { ensureLoopGallery, insertWallPhoto } from "@/lib/loop/wall/server";
import { attendeeForVoter, claimIdentity, creditMedia } from "@/lib/loop/identity";
import { createStorageService } from "@/lib/storage/StorageService";
import { gallery as galleryPaths } from "@/lib/storage/pathGenerators";
import { rateLimit } from "@/lib/rateLimit";

// StorageService uses the AWS SDK; multipart parsing needs the Node runtime.
export const runtime = "nodejs";

/** One atomic post: gate → upload to R2 → record the row. No partial states
 *  (the presigned-PUT + record two-step can orphan objects mid-event). */

const MAX_BYTES = 30 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/webm": "webm",
  "video/mp4": "mp4",
};

export async function POST(req: NextRequest) {
  const event = await getCurrentEvent();

  // The Wall accepts posts while the room is live; the admin can post any time.
  const store = await cookies();
  const isAdmin = await verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
  const voterId = await currentVoterId();

  if (!isAdmin) {
    if (event.phase !== "live") {
      return NextResponse.json(
        { error: "The Wall opens during the event." },
        { status: 403 },
      );
    }
    if (!(await hasRoomAccess(event.id, voterId))) {
      return NextResponse.json(
        { error: "Redeem your event code to post to the Wall." },
        { status: 403 },
      );
    }
  }

  const limiter = await rateLimit({
    key: `loop:wall:post:${isAdmin ? "admin" : voterId}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Easy — try again in a moment." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (30 MB max)" }, { status: 413 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: `Unsupported type: ${file.type || "unknown"}` }, { status: 415 });
  }

  const mediaType = file.type.startsWith("video/") ? "video" : "photo";
  const userName = String(form.get("userName") ?? "").trim().slice(0, 60) || null;
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300) || null;

  const loopGallery = await ensureLoopGallery(event);
  const uid = crypto.randomUUID().slice(0, 8);
  const filename = `${uid}.${ext}`;
  const key =
    mediaType === "video"
      ? galleryPaths.video(loopGallery.slug, filename)
      : galleryPaths.photo(loopGallery.slug, filename);

  const storage = createStorageService();
  const uploaded = await storage.uploadToR2({
    contentType: mediaType === "video" ? "gallery-video" : "gallery-photo",
    file,
    filename,
    metadata: { gallerySlug: loopGallery.slug, filename },
    customKey: key,
  });
  if (!uploaded.success || !uploaded.key) {
    return NextResponse.json(
      { error: uploaded.error ?? "Upload failed — try again." },
      { status: 502 },
    );
  }

  const photo = await insertWallPhoto({
    galleryId: loopGallery.id,
    uid,
    r2Key: uploaded.key,
    originalFilename: file.name || filename,
    userName,
    caption,
    mediaType,
  });
  if (!photo) {
    return NextResponse.json({ error: "Saved the file but not the record — try again." }, { status: 500 });
  }

  // Credit the shot to its author — the row that later powers "your shots",
  // profiles, contributor credits and magazine royalties. Best-effort: a
  // credit failure must never lose the guest their photo.
  try {
    const attendee = await attendeeForVoter(voterId);
    if (attendee) {
      await creditMedia(uid, attendee.id, event.id);
      // The name typed on a post is the display name, if they've not set one.
      if (userName && !attendee.displayName) {
        await claimIdentity(voterId, userName, null);
      }
    }
  } catch (e) {
    console.error("[loop:identity] credit not recorded:", e);
  }

  return NextResponse.json({ success: true, photo });
}
