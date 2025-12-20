import { NextResponse } from 'next/server';

// Mock campaigns data - replace with database queries
const mockCampaigns = [
  {
    id: '1',
    name: 'Summer Sale 2025',
    type: 'email' as const,
    status: 'active' as const,
    startDate: '2025-06-01',
    endDate: '2025-08-31',
    budget: 5000,
    spent: 3200,
    impressions: 125000,
    clicks: 8500,
    conversions: 450,
  },
  {
    id: '2',
    name: 'New Album Launch',
    type: 'social' as const,
    status: 'active' as const,
    startDate: '2025-12-01',
    impressions: 85000,
    clicks: 5200,
    conversions: 320,
  },
];

export async function GET() {
  try {
    // TODO: Fetch campaigns from database
    return NextResponse.json({ success: true, campaigns: mockCampaigns });
  } catch (error) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const campaign = await request.json();
    
    // TODO: Save campaign to database
    console.log('Creating campaign:', campaign);

    const newCampaign = {
      id: Date.now().toString(),
      ...campaign,
      status: 'draft',
      impressions: 0,
      clicks: 0,
      conversions: 0,
    };

    return NextResponse.json({ success: true, campaign: newCampaign });
  } catch (error) {
    console.error('Failed to create campaign:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
