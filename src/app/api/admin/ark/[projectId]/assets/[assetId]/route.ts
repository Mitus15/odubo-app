import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params;
    const body = await req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowed = ['title', 'asset_type', 'url', 'r2_key', 'description', 'category', 'integration_id', 'sort_order'];
    for (const f of allowed) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f]); }
    }
    if (body.metadata !== undefined) { fields.push('metadata = ?'); values.push(body.metadata ? JSON.stringify(body.metadata) : null); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(assetId);

    await executeQuery(`UPDATE ark_assets SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update asset error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update asset' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params;
    await executeQuery('DELETE FROM ark_assets WHERE id = ?', [assetId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete asset error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete asset' }, { status: 500 });
  }
}
