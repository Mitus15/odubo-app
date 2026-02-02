import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface TusUploadRequestBody {
  name?: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const body = await req.json() as TusUploadRequestBody;
    const { name } = body;

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return NextResponse.json({ error: 'Missing Cloudflare credentials' }, { status: 500 });
    }

    // Return TUS endpoint and credentials for client-side upload
    // Cloudflare Stream TUS endpoint: https://api.cloudflare.com/client/v4/accounts/{account_id}/stream
    return NextResponse.json({
      tusEndpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      apiToken: apiToken,
      metadata: {
        name: name || 'Untitled',
        requiresignedurls: 'false',
        allowedorigins: 'localhost:3000,odubo.studio,www.odubo.studio,admin.odubo.studio'
      }
    });
  } catch (error: any) {
    console.error('Error generating TUS credentials:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
