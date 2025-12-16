import { NextRequest, NextResponse } from "next/server";
import { executeQuery, queryDatabase } from "@/lib/db";
import { userHasAnyRole } from "@/lib/auth";

const ALLOWED_ROLES = ["admin", "editor"] as const;

const PLATFORM_KEYS = ["TikTok", "Instagram", "Facebook", "YouTube"] as const;
type PlatformKey = (typeof PLATFORM_KEYS)[number];

interface ComposerPayload {
  TikTok?: string;
  Instagram?: string;
  Facebook?: string;
  YouTube?: string;
}

interface CreateSocialPostBody {
  sourceContentId?: string | number | null;
  contentType?: string | null;
  goal?: string | null;
  composer?: ComposerPayload;
  status?: string | null;
  scheduledAt?: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const posts = await queryDatabase(
      `SELECT 
        sp.id,
        sp.uid,
        sp.content_type,
        sp.content_id,
        sp.goal,
        sp.created_at,
        sp.updated_at,
        GROUP_CONCAT(spt.platform || ':' || spt.status) as platform_statuses,
        MIN(CASE WHEN spt.status = 'scheduled' THEN spt.scheduled_at END) as scheduled_at
       FROM social_posts sp
       LEFT JOIN social_post_targets spt ON spt.social_post_id = sp.id
       GROUP BY sp.id
       ORDER BY sp.created_at DESC
       LIMIT 100`,
      []
    );

    const formatted = posts.map((post: any) => {
      const platformStatuses = post.platform_statuses
        ? post.platform_statuses.split(',').map((ps: string) => {
            const [platform, status] = ps.split(':');
            return { platform, status };
          })
        : [];
      
      const overallStatus = platformStatuses.length > 0 
        ? platformStatuses[0].status 
        : 'draft';

      return {
        id: post.id,
        uid: post.uid,
        contentType: post.content_type,
        contentId: post.content_id,
        goal: post.goal,
        status: overallStatus,
        platforms: platformStatuses.map((ps: any) => ps.platform),
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        scheduledAt: post.scheduled_at || null,
      };
    });

    return NextResponse.json({ posts: formatted });
  } catch (error) {
    console.error("Error fetching social posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as CreateSocialPostBody;

    const composer = body.composer || {};
    const platforms: { platform: PlatformKey; caption: string }[] = [];
    for (const key of PLATFORM_KEYS) {
      const value = (composer as any)[key];
      if (typeof value === "string" && value.trim().length > 0) {
        platforms.push({ platform: key, caption: value.trim() });
      }
    }

    if (platforms.length === 0) {
      return NextResponse.json(
        { error: "At least one platform caption is required" },
        { status: 400 }
      );
    }

    const goal = body.goal ?? null;
    const contentType = body.contentType ?? "clip";
    const status = body.status ?? "draft";
    const scheduledAt = body.scheduledAt ?? null;

    const authHeader = req.headers.get("authorization");
    let createdByUserId: number | null = null;
    if (authHeader && authHeader.startsWith("UserId ")) {
      const idStr = authHeader.slice("UserId ".length).trim();
      const parsed = Number.parseInt(idStr, 10);
      if (!Number.isNaN(parsed)) {
        createdByUserId = parsed;
      }
    }

    const uid = crypto.randomUUID();

    // Insert social_post without wrapping in SQL transaction (D1 HTTP API limitation)
    await executeQuery(
      `INSERT INTO social_posts (uid, content_type, content_id, goal, created_by_user_id)
       VALUES (?, ?, ?, ?, ?);`,
      [
        uid,
        contentType,
        body.sourceContentId ?? null,
        goal,
        createdByUserId,
      ]
    );

    // Retrieve inserted id using the unique uid
    const idRows = await queryDatabase(
      `SELECT id FROM social_posts WHERE uid = ? LIMIT 1`,
      [uid]
    );
    const socialPostId = idRows && idRows[0] && idRows[0].id;

    if (!socialPostId) {
      return NextResponse.json(
        { error: "Failed to create social post" },
        { status: 500 }
      );
    }

    const targetSqlParts: string[] = [];
    const targetParams: any[] = [];

    for (const { platform, caption } of platforms) {
      targetSqlParts.push(
        `INSERT INTO social_post_targets (social_post_id, platform, status, scheduled_at, caption)
         VALUES (?, ?, ?, ?, ?);`
      );
      targetParams.push(socialPostId, platform.toLowerCase(), status, scheduledAt, caption);
    }

    if (targetSqlParts.length > 0) {
      // Execute inserts one-by-one to avoid multi-statement issues
      for (let i = 0, p = 0; i < targetSqlParts.length; i++) {
        const sql = targetSqlParts[i];
        const params = targetParams.slice(p, p + 5);
        p += 5;
        await executeQuery(sql, params);
      }
    }

    return NextResponse.json(
      {
        id: socialPostId,
        uid,
        contentType,
        goal,
        status,
        scheduledAt,
        platforms: platforms.map((p) => p.platform),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating social post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
