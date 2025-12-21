import { NextResponse } from 'next/server';

// Mock discounts data
const mockDiscounts = [
  {
    id: '1',
    code: 'SUMMER25',
    type: 'percentage' as const,
    value: 25,
    status: 'active' as const,
    usageCount: 156,
    usageLimit: 500,
    startDate: '2025-06-01',
    endDate: '2025-08-31',
    minPurchase: 50,
  },
  {
    id: '2',
    code: 'FREESHIP',
    type: 'free_shipping' as const,
    value: 0,
    status: 'active' as const,
    usageCount: 423,
    startDate: '2025-01-01',
    minPurchase: 75,
  },
  {
    id: '3',
    code: 'WELCOME10',
    type: 'percentage' as const,
    value: 10,
    status: 'active' as const,
    usageCount: 892,
    startDate: '2025-01-01',
  },
];

export async function GET() {
  try {
    // TODO: Fetch discounts from database
    return NextResponse.json({ success: true, discounts: mockDiscounts });
  } catch (error) {
    console.error('Failed to fetch discounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const discount = await request.json() as Record<string, any>;
    
    // TODO: Save discount to database
    console.log('Creating discount:', discount);

    const newDiscount = {
      id: Date.now().toString(),
      ...discount,
      usageCount: 0,
    };

    return NextResponse.json({ success: true, discount: newDiscount });
  } catch (error) {
    console.error('Failed to create discount:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create discount' },
      { status: 500 }
    );
  }
}
