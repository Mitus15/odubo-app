import { getUserByEmail } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from '@/lib/api/requireAdmin';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;

  return NextResponse.json({
    error: 'Deprecated. Use POST /api/videos/upload for direct Cloudflare Stream ingestion.'
  }, { status: 410 });
}
