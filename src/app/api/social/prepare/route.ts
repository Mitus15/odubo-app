import { NextRequest, NextResponse } from "next/server";
import { userHasAnyRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const hasRole = await userHasAnyRole(req, ["admin", "editor"]);
    if (!hasRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      purpose?: string;
      platforms?: string[];
    };

    const title = (body.title || "").toString();
    const purpose = (body.purpose || "").toString();
    const platforms = Array.isArray(body.platforms) && body.platforms.length > 0
      ? body.platforms
      : ["TikTok", "Instagram", "Facebook", "YouTube"];

    const base = title || purpose || "your content";

    const suggestions: Record<string, string> = {};
    for (const p of platforms) {
      const key = p as string;
      if (key.toLowerCase() === "tiktok") {
        suggestions["TikTok"] = `🔥 ${base} — quick hook, fast cuts. #fyp #${(purpose || "vibes").replace(/\s+/g, '')}`;
      } else if (key.toLowerCase() === "instagram") {
        suggestions["Instagram"] = `✨ ${base} — clean aesthetic, carousel-ready. #reels #${(purpose || "style").replace(/\s+/g, '')}`;
      } else if (key.toLowerCase() === "facebook") {
        suggestions["Facebook"] = `📣 ${base} — concise headline + link if relevant. #community`;
      } else if (key.toLowerCase() === "youtube") {
        suggestions["YouTube"] = `🎬 ${base} — engaging intro + value promise. #shorts`;
      }
    }

    return NextResponse.json({ composer: suggestions });
  } catch (error) {
    console.error("POST /api/social/prepare error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
