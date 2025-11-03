import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const hasD1Token = !!(process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN);
    const hasJwtSecret = !!process.env.JWT_SECRET;
    const hasResendKey = !!process.env.RESEND_API_KEY;
    const hasR2PublicUrl = !!process.env.CLOUDFLARE_R2_PUBLIC_URL;
    const hasAccountId = !!process.env.CLOUDFLARE_ACCOUNT_ID;

    const ok = hasDatabaseUrl && hasD1Token && hasJwtSecret;

    return NextResponse.json({
      ok,
      env: {
        hasDatabaseUrl,
        hasD1Token,
        hasJwtSecret,
        hasResendKey,
        hasR2PublicUrl,
        hasAccountId,
      },
      note: 'Only presence is reported, not values.',
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
