import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// Mock API keys data
const mockApiKeys = [
  {
    id: '1',
    name: 'Production API',
    key: 'odubo_live_4f8a2b9c3e1d7f6a5b4c3d2e1f0a9b8c',
    scopes: ['read:products', 'read:orders', 'read:content'],
    status: 'active' as const,
    createdAt: '2025-01-15T10:00:00Z',
    lastUsed: '2025-12-18T14:23:00Z',
    requestCount: 15234,
  },
  {
    id: '2',
    name: 'Mobile App',
    key: 'odubo_live_7e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b',
    scopes: ['read:content', 'write:content', 'read:customers'],
    status: 'active' as const,
    createdAt: '2025-06-01T10:00:00Z',
    lastUsed: '2025-12-19T08:15:00Z',
    requestCount: 42156,
  },
];

export async function GET() {
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

export async function POST(request: Request) {
  try {
    const { name, scopes } = await request.json();
    
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
