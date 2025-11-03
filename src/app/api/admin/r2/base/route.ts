import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

export async function GET() {
  const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
  return NextResponse.json({ base });
}
