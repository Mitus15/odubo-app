import { NextResponse, NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

// Mock API keys data
const mockApiKeys = [
  {
    id: '1',
    name: 'Production API',
    key: 'odubo_live_••••••••••••••••••••••••••••••••', // Masked for security
    scopes: ['read:products', 'read:orders', 'read:content'],
    status: 'active' as const,
    createdAt: '2025-01-15T10:00:00Z',
    lastUsed: '2025-12-18T14:23:00Z',
    requestCount: 15234,
  },
  {
    id: '2',
    name: 'Mobile App',
    key: 'odubo_live_••••••••••••••••••••••••••••••••', // Masked for security
    scopes: ['read:content', 'write:content', 'read:customers'],
    status: 'active' as const,
    createdAt: '2025-06-01T10:00:00Z',
    lastUsed: '2025-12-19T08:15:00Z',
    requestCount: 42156,
  },
];

export async function GET(req: NextRequest) {
  // Require authentication - API keys are highly sensitive
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }
  try {
    // TODO: Fetch API keys from database
    return NextResponse.json({ success: true, keys: mockApiKeys });
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Require authentication - only admins can create API keys
  const user = getUserFromRequest(request);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }
  try {
    const body = await request.json() as { name: string; scopes: string[] };
    const { name, scopes } = body;
    
    // Generate a secure API key
    const keyBytes = randomBytes(24);
    const key = `odubo_live_${keyBytes.toString('hex')}`;
    
    // TODO: Save API key to database (hash it!)
    console.log('Creating API key:', { name, scopes });

    const newKey = {
      id: Date.now().toString(),
      name,
      key, // In production, only return this once and store a hash
      scopes,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      requestCount: 0,
    };

    return NextResponse.json({ success: true, key: newKey });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
