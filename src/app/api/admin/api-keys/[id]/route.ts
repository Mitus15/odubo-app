import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // TODO: Revoke API key in database
    console.log('Revoking API key:', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
