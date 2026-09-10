import { NextResponse } from "next/server";
import { queryOne, executeQuery } from "@/lib/loop/db";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { claimIdentity, ensureAttendee } from "@/lib/loop/identity";

/**
 * The gift chain — mint a share code, and record who arrived on one.
 *
 * Deliberately account-free: a first name and a code, both volunteered. The
 * single is never gated behind this, so a refusal to share costs the visitor
 * nothing and the endpoint is allowed to fail without taking the song with it.
 */

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes
const CODE_LEN = 7;

function mintCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
}

/** First names only, and short — this string is rendered to strangers. */
function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const n = raw.trim().replace(/\s+/g, " ").slice(0, 24);
  return n.length >= 1 ? n : null;
}

export async function POST(req: Request) {
  let body: { action?: string; name?: string; code?: string; visitor?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (body.action === "mint") {
    const name = cleanName(body.name);
    if (!name)
      return NextResponse.json({ error: "name required" }, { status: 400 });

    const code = mintCode();

    // Sharing the single is the first thing anyone does with their name on it,
    // so it is also the first rung of the identity ladder: the name they type
    // here becomes their display name, and the code is tied to the attendee it
    // came from. Otherwise this would be a separate id space that has to be
    // reconciled with the real one later, and "later" means after the night.
    // Best-effort — a share must never fail because identity did.
    let attendeeId: string | null = null;
    try {
      const voterId = await currentVoterId();
      if (voterId && voterId !== "anonymous") {
        const me = await ensureAttendee(voterId);
        attendeeId = me.id;
        if (!me.displayName) await claimIdentity(voterId, name, null);
      }
    } catch (e) {
      console.error("[loop:gift] could not tie this code to an attendee:", e);
    }

    await executeQuery(
      `INSERT INTO loop_gift_codes (code, name, attendee_id) VALUES (?1, ?2, ?3)`,
      [code, name, attendeeId],
    );
    return NextResponse.json({ code, name });
  }

  if (body.action === "visit") {
    const code =
      typeof body.code === "string" ? body.code.trim().slice(0, 16) : "";
    const visitor =
      typeof body.visitor === "string" ? body.visitor.trim().slice(0, 64) : "";
    if (!code || !visitor)
      return NextResponse.json(
        { error: "code and visitor required" },
        { status: 400 },
      );

    const owner = await queryOne<{ name: string }>(
      `SELECT name FROM loop_gift_codes WHERE code = ?1`,
      [code],
    );
    // An unknown code is not an error worth surfacing — a mistyped or expired
    // link should still land on the song, just without a name attached to it.
    if (!owner) return NextResponse.json({ name: null });

    // The sender arriving on their own link would otherwise count themselves.
    await executeQuery(
      `INSERT OR IGNORE INTO loop_gifts (code, visitor) VALUES (?1, ?2)`,
      [code, visitor],
    );
    return NextResponse.json({ name: owner.name });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

/** How many people a code has reached — the sharer's own count. */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.trim().slice(0, 16);
  if (!code)
    return NextResponse.json({ error: "code required" }, { status: 400 });

  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM loop_gifts WHERE code = ?1`,
    [code],
  );
  return NextResponse.json({ count: row?.n ?? 0 });
}
