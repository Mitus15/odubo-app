import { NextRequest, NextResponse } from "next/server";
import { queryDatabase } from "@/lib/db";
import { userHasAnyRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find videos not yet used in any social_post_targets
    // (videos that don't have a social_posts row linking to them via content_id)
    const clips = await queryDatabase(
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
        v.duration
       FROM videos v
       WHERE v.publication_status = 'live'
         AND v.status = 'published'
         AND NOT EXISTS (
           SELECT 1 FROM social_posts sp 
           WHERE CAST(sp.content_id AS TEXT) = CAST(v.id AS TEXT)
         )
       ORDER BY v.created_at DESC
       LIMIT 100`,
      []
    );

    const formatted = clips.map((clip: any) => ({
      id: clip.id.toString(),
      uid: clip.uid,
      type: clip.type || 'video',
      title: clip.title || 'Untitled',
      purpose: clip.mood || clip.category || 'General',
      createdAt: clip.created_at,
      url: clip.url,
      posterUrl: clip.poster_url,
      duration: clip.duration,
    }));

    return NextResponse.json({ clips: formatted });
  } catch (error) {
    console.error("Error fetching undistributed clips:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
