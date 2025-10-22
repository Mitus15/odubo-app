import { getUserByEmail } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return NextResponse.json({
    error: 'Deprecated. Use POST /api/videos/upload for direct Cloudflare Stream ingestion.'
  }, { status: 410 });
}
