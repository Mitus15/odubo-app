import { NextResponse } from 'next/server';

// Mock email campaigns data
const mockEmailCampaigns = [
  {
    id: '1',
    name: 'New Music Release Newsletter',
    subject: '🎵 New Album Out Now!',
    status: 'sent' as const,
    recipients: 15000,
    sent: 14856,
    opened: 8234,
    clicked: 2156,
    sentDate: '2025-12-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Holiday Sale Announcement',
    subject: '🎁 Exclusive Holiday Offers Inside',
    status: 'scheduled' as const,
    recipients: 18000,
    scheduledDate: '2025-12-24T09:00:00Z',
  },
];

export async function GET() {
  try {
    // TODO: Fetch email campaigns from database
    return NextResponse.json({ success: true, campaigns: mockEmailCampaigns });
  } catch (error) {
    console.error('Failed to fetch email campaigns:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const campaign = await request.json() as Record<string, unknown>;
    
    // TODO: Save email campaign to database
    console.log('Creating email campaign:', campaign);

    const newCampaign = {
      id: Date.now().toString(),
      ...campaign,
      status: 'draft',
    };

    return NextResponse.json({ success: true, campaign: newCampaign });
  } catch (error) {
    console.error('Failed to create email campaign:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create email campaign' },
      { status: 500 }
    );
  }
}
