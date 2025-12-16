import { NextRequest, NextResponse } from "next/server";
import { queryDatabase } from "@/lib/db";
import { userHasAnyRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const type = (searchParams.get("type") || "").trim(); // clip | video | all

    // Build WHERE clauses optionally
    const where: string[] = [];
    const params: any[] = [];

    if (q) {
      where.push("LOWER(v.title) LIKE LOWER(?)");
      params.push(`%${q}%`);
    }
    if (type === "clip") {
      where.push("v.type = 'clip'");
    } else if (type === "video") {
      where.push("v.type != 'clip'");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await queryDatabase(
      `SELECT 
         v.id,
         v.uid,
         v.title,
         v.type,
         v.category,
         v.mood,
         v.created_at,
         v.poster_url,
         v.url,
         v.duration,
         CASE WHEN EXISTS (
           SELECT 1 FROM social_posts sp 
           WHERE CAST(sp.content_id AS TEXT) = CAST(v.id AS TEXT)
         ) THEN 1 ELSE 0 END AS distributed
       FROM videos v
       ${whereSql}
       ORDER BY COALESCE(v.created_at, datetime('now')) DESC
       LIMIT 500`,
      params
    );

    const formatted = rows.map((r: any) => ({
      id: String(r.id),
      uid: r.uid,
      type: r.type || 'video',
      title: r.title || 'Untitled',
      purpose: r.mood || r.category || 'General',
      createdAt: r.created_at,
      url: r.url,
      posterUrl: r.poster_url,
      duration: r.duration,
      distributed: !!r.distributed,
    }));

    return NextResponse.json({ media: formatted });
  } catch (error) {
    console.error("GET /api/media/all error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
