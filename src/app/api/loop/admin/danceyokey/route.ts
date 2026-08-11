import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import {
  drawRandom,
  getSettings,
  listAll,
  move,
  promote,
  setSetting,
  setStatus,
  signUp,
  type SignupStatus,
} from "@/lib/loop/danceyokey";

/**
 * Danceyokey, host side — the surface the night actually runs on.
 * Auth: middleware gates /api/loop/admin/*.
 */
export async function GET() {
  const event = await getCurrentEvent();
  const [signups, settings] = await Promise.all([listAll(event.id), getSettings()]);
  return NextResponse.json({ signups, settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const event = await getCurrentEvent();
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    id?: string;
    status?: SignupStatus;
    direction?: "up" | "down";
    // wildcard
    performers?: string;
    songTitle?: string;
    songArtist?: string;
    // settings
    spots?: number;
    mode?: string;
    open?: boolean;
  } | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  switch (body.action) {
    case "promote":
      if (!body.id) break;
      return NextResponse.json({ success: await promote(body.id) });

    case "status":
      if (!body.id || !body.status) break;
      // Starting an act finishes whoever's on the floor — one floor, one act.
      if (body.status === "performing") {
        const current = (await listAll(event.id)).find((s) => s.status === "performing");
        if (current && current.id !== body.id) await setStatus(current.id, "done");
      }
      return NextResponse.json({ success: await setStatus(body.id, body.status) });

    case "move":
      if (!body.id || !body.direction) break;
      return NextResponse.json({ success: await move(body.id, body.direction) });

    case "draw": {
      const winner = await drawRandom(event.id);
      return winner
        ? NextResponse.json({ success: true, winner })
        : NextResponse.json({ error: "Nobody's waiting." }, { status: 409 });
    }

    case "wildcard": {
      const performers = body.performers?.trim();
      if (!performers) break;
      const created = await signUp({
        eventId: event.id,
        attendeeId: null,
        performers,
        songTitle: body.songTitle?.trim() || null,
        songArtist: body.songArtist?.trim() || null,
        note: null,
        source: "wildcard",
        queued: true,
      });
      return NextResponse.json({ success: true, signup: created });
    }

    case "settings": {
      if (body.spots !== undefined) {
        await setSetting("danceyokey_spots", String(Math.min(Math.max(body.spots, 1), 20)));
      }
      if (body.mode !== undefined && ["firstcome", "hostpick", "random"].includes(body.mode)) {
        await setSetting("danceyokey_mode", body.mode);
      }
      if (body.open !== undefined) await setSetting("danceyokey_open", body.open ? "1" : "0");
      return NextResponse.json({ success: true, settings: await getSettings() });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
