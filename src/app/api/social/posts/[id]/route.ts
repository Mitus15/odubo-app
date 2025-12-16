import { NextRequest, NextResponse } from "next/server";
import { executeQuery, queryDatabase } from "@/lib/db";
import { userHasAnyRole } from "@/lib/auth";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idStr } = await context.params;
    const id = Number.parseInt(idStr, 10);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const rows = await queryDatabase(
      `SELECT sp.id, sp.uid, sp.goal, sp.content_id, sp.content_type, sp.created_at, sp.updated_at,
              spt.platform, spt.caption, spt.status, spt.scheduled_at
       FROM social_posts sp
       LEFT JOIN social_post_targets spt ON spt.social_post_id = sp.id
       WHERE sp.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const base = rows[0];
    const targets = rows
      .filter((r: any) => r.platform)
      .map((r: any) => ({
        platform: (r.platform as string) || "",
        caption: r.caption || "",
        status: r.status || "draft",
        scheduledAt: r.scheduled_at || null,
      }));

    const post = {
      id: base.id,
      uid: base.uid,
      goal: base.goal,
      contentId: base.content_id,
      contentType: base.content_type,
      createdAt: base.created_at,
      updatedAt: base.updated_at,
      targets,
    };

    return NextResponse.json({ post });
  } catch (error) {
    console.error("GET /api/social/posts/:id error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idStr } = await context.params;
    const id = Number.parseInt(idStr, 10);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = (await req.json()) as {
      goal?: string | null;
      targets?: Array<{
        platform: string;
        caption?: string;
        status?: string; // draft | scheduled | published | archived
        scheduledAt?: string | null;
      }>;
    };

    // Update goal
    if (typeof body.goal === "string") {
      await executeQuery(
        "UPDATE social_posts SET goal = ?, updated_at = datetime('now') WHERE id = ?;",
        [body.goal, id]
      );
    }

    // Update targets
    if (Array.isArray(body.targets) && body.targets.length > 0) {
      const clauses: string[] = [];
      const paramsArr: any[] = [];
      for (const t of body.targets) {
        clauses.push(
          "UPDATE social_post_targets SET caption = COALESCE(?, caption), status = COALESCE(?, status), scheduled_at = COALESCE(?, scheduled_at), updated_at = datetime('now') WHERE social_post_id = ? AND platform = ?;"
        );
        paramsArr.push(
          t.caption ?? null,
          t.status ?? null,
          t.scheduledAt ?? null,
          id,
          (t.platform || '').toLowerCase()
        );
      }
      await executeQuery(clauses.join("\n"), paramsArr);
    }

    const updated = await queryDatabase(
      `SELECT sp.id, sp.uid, sp.goal, sp.content_id, sp.content_type, sp.created_at, sp.updated_at,
              GROUP_CONCAT(spt.platform || ':' || spt.status) as platform_statuses
       FROM social_posts sp
       LEFT JOIN social_post_targets spt ON spt.social_post_id = sp.id
       WHERE sp.id = ?
       GROUP BY sp.id`,
      [id]
    );

    return NextResponse.json({ ok: true, post: updated[0] || null });
  } catch (error) {
    console.error("PATCH /api/social/posts/:id error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idStr } = await context.params;
    const id = Number.parseInt(idStr, 10);
    const action = new URL(req.url).searchParams.get('action');

    if (action === 'archive') {
      if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      await executeQuery(
        "UPDATE social_post_targets SET status = 'archived', updated_at = datetime('now') WHERE social_post_id = ?;",
        [id]
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/social/posts/:id?action=archive error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idStr } = await context.params;
    const id = Number.parseInt(idStr, 10);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    // Delete targets first due to FK
    await executeQuery(
      "DELETE FROM social_post_targets WHERE social_post_id = ?;",
      [id]
    );
    await executeQuery(
      "DELETE FROM social_posts WHERE id = ?;",
      [id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/social/posts/:id error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
