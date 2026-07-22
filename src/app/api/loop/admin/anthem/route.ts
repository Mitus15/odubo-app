import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import {
  closeNow,
  extend,
  lockSeeds,
  setClosesAt,
  unlockSeeds,
  type RoundKey,
  ROUND_KEYS,
} from "@/lib/loop/anthem-rounds";
import { setHidden } from "@/lib/loop/anthem-candidates";
import { generate, setGate, type GateMode } from "@/lib/loop/event-codes";

/**
 * Anthem control surface for the (non-technical) marketing team: lock the 8
 * seeds the crowd surfaced, nudge round cutoffs (Close-now / Extend / set time),
 * and hide off-brand nominations. Mirrors /api/admin/phase; persisted in D1.
 *
 * Gated by the `ls_admin` session cookie in middleware (see admin-auth.ts).
 */
function isRoundKey(k: unknown): k is RoundKey {
  return typeof k === "string" && (ROUND_KEYS as string[]).includes(k);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action?: string;
    key?: string;
    minutes?: number;
    iso?: string;
    ids?: string[];
    candidateId?: string;
    hidden?: boolean;
    count?: number;
    mode?: string;
  };
  const event = await getCurrentEvent();

  switch (body.action) {
    case "lockSeeds": {
      if (!Array.isArray(body.ids) || body.ids.length !== 8) {
        return NextResponse.json({ error: "need exactly 8 seed ids" }, { status: 400 });
      }
      await lockSeeds(event.id, body.ids);
      break;
    }
    case "unlockSeeds":
      await unlockSeeds(event.id);
      break;
    case "closeNow":
      if (!isRoundKey(body.key)) return NextResponse.json({ error: "bad key" }, { status: 400 });
      await closeNow(event, body.key, Date.now());
      break;
    case "extend":
      if (!isRoundKey(body.key) || typeof body.minutes !== "number") {
        return NextResponse.json({ error: "bad extend" }, { status: 400 });
      }
      await extend(event, body.key, body.minutes);
      break;
    case "setClosesAt":
      if (!isRoundKey(body.key) || !body.iso) {
        return NextResponse.json({ error: "bad setClosesAt" }, { status: 400 });
      }
      await setClosesAt(event.id, body.key, body.iso);
      break;
    case "hideCandidate":
      if (!body.candidateId) return NextResponse.json({ error: "bad candidate" }, { status: 400 });
      await setHidden(event.id, body.candidateId, body.hidden ?? true);
      break;
    case "generateCodes": {
      const n = Number(body.count);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ error: "count must be at least 1" }, { status: 400 });
      }
      const codes = await generate(event.id, Math.min(Math.floor(n), 100), Date.now());
      return NextResponse.json({ ok: true, codes });
    }
    case "setGate": {
      if (body.mode !== "open" && body.mode !== "ticket") {
        return NextResponse.json({ error: "bad gate mode" }, { status: 400 });
      }
      await setGate(event.id, body.mode as GateMode);
      break;
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
