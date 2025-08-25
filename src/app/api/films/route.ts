import { filmSchema } from '../../../lib/validation';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const film = filmSchema.parse(body);
    // TODO: Insert film into DB (use parameterized queries)
    return NextResponse.json({ message: 'Film created', film }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Films endpoint placeholder' });
}
