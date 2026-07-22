import { NextResponse } from "next/server";
import { searchTracks } from "@/lib/loop/music/itunes";

/** Multi-result iTunes search powering the "suggest a song" box. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const results = await searchTracks(q, 8);
  return NextResponse.json({ results });
}
