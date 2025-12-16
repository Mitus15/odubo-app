import { NextRequest, NextResponse } from "next/server";
import { executeQuery, queryDatabase } from "@/lib/db";
import { userHasAnyRole } from "@/lib/auth";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idStr } = await context.params;
    const id = Number.parseInt(idStr, 10);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as { uid?: string | null };
    const uid = body.uid ? String(body.uid) : null;
    if (!uid || uid.trim().length === 0) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    await executeQuery("UPDATE videos SET uid = ?, updated_at = datetime('now') WHERE id = ?", [uid, id]);

    const updated = await queryDatabase(
      `SELECT id, uid, title, type, category, mood, created_at, poster_url, url FROM videos WHERE id = ? LIMIT 1`,
      [id]
    );

    return NextResponse.json({ ok: true, media: updated && updated[0] ? updated[0] : null });
  } catch (error) {
    console.error("PATCH /api/media/:id error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
