import { productSchema } from '../../../lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product = productSchema.parse(body);
    // TODO: Insert product into DB (use parameterized queries)
    return NextResponse.json({ message: 'Product created', product }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Products endpoint placeholder' });
}
