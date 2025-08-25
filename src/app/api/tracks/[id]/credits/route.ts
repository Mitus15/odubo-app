import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { executeQuery, queryDatabase } from '@/lib/db';
import { TrackCredit } from '@/types/music';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: trackId } = await params;
    const body = await req.json() as { credits: TrackCredit[] };
    const { credits } = body;

    // Start a transaction by first deleting all existing credits for this track
    await executeQuery('DELETE FROM track_credits WHERE track_id = ?', [trackId]);

    // Insert new credits
    if (credits && credits.length > 0) {
      for (const credit of credits) {
        if (credit.name && credit.role) {
          await executeQuery(`
            INSERT INTO track_credits (track_id, role, name, is_featured)
            VALUES (?, ?, ?, ?)
          `, [trackId, credit.role, credit.name, credit.is_featured ? 1 : 0]);
        }
      }
    }

    // Fetch updated credits to return
    const updatedCredits = await queryDatabase(
      'SELECT * FROM track_credits WHERE track_id = ?',
      [trackId]
    );

    return NextResponse.json({
      success: true,
      message: 'Credits updated successfully',
      credits: updatedCredits
    });
  } catch (error) {
    console.error('Error updating track credits:', error);
    return NextResponse.json(
      { error: 'Failed to update credits: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: trackId } = await params;
    
    const credits = await queryDatabase(
      'SELECT * FROM track_credits WHERE track_id = ? ORDER BY id',
      [trackId]
    );

    return NextResponse.json({
      success: true,
      credits
    });
  } catch (error) {
    console.error('Error fetching track credits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
