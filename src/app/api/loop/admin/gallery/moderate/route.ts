import { NextRequest, NextResponse } from "next/server";
import { executeQuery, queryOne } from "@/lib/loop/db";
import { createStorageService } from "@/lib/storage/StorageService";

// StorageService (delete) needs the Node runtime.
export const runtime = "nodejs";

/**
 * Moderate / curate one Wall shot. Auth: middleware gates /api/loop/admin/*.
 *
 * Actions (moderated: 0|null unreviewed → visible, 1 approved, 2 hidden):
 *   approve   → moderated = 1
 *   hide      → moderated = 2, featured = 0
 *   feature   → featured = 1 (implies approve — Iconic Moments must be visible)
 *   unfeature → featured = 0
 *   delete    → remove the R2 object, then the row
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const action = String(body?.action ?? "");
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (action === "delete") {
    const row = await queryOne<{ r2_key: string; thumbnail_key: string | null }>(
      `SELECT r2_key, thumbnail_key FROM gallery_photos WHERE id = ?1`,
      [id],
    );
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Best-effort object cleanup; the row delete is what hides it either way.
    const storage = createStorageService();
    await storage.deleteFromR2(row.r2_key);
    if (row.thumbnail_key) await storage.deleteFromR2(row.thumbnail_key);

    await executeQuery(`DELETE FROM gallery_photos WHERE id = ?1`, [id]);
    return NextResponse.json({ success: true, id, deleted: true });
  }

  const updates: Record<string, string> = {
    approve: `moderated = 1, moderated_at = ?2, moderated_by = 'loop-admin'`,
    hide: `moderated = 2, featured = 0, moderated_at = ?2, moderated_by = 'loop-admin'`,
    feature: `featured = 1, moderated = 1, moderated_at = ?2, moderated_by = 'loop-admin'`,
    unfeature: `featured = 0, moderated_at = ?2, moderated_by = 'loop-admin'`,
  };
  const set = updates[action];
  if (!set) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const meta = await executeQuery(
    `UPDATE gallery_photos SET ${set} WHERE id = ?1`,
    [id, now],
  );
  if (meta.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, id, action });
}
