import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

// GET /api/command-center/releases - List all releases
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    let query = `
      SELECT
        id,
        title,
        release_type as releaseType,
        artist_name as artistName,
        label_name as labelName,
        upc,
        catalog_number as catalogNumber,
        cover_art_url as coverArtUrl,
        original_release_date as originalReleaseDate,
        distribution_release_date as distributionReleaseDate,
        distributor,
        distributor_release_id as distributorReleaseId,
        status,
        price_tier as priceTier,
        territories,
        explicit_content as explicitContent,
        genre,
        subgenre,
        language,
        copyright_line as copyrightLine,
        phonographic_line as phonographicLine,
        internal_album_id as internalAlbumId,
        created_at as createdAt,
        updated_at as updatedAt,
        submitted_at as submittedAt,
        live_at as liveAt
      FROM distribution_releases
    `;

    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const result = await queryDatabase(query, params) || [];

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM distribution_releases';
    const countParams: any[] = [];
    if (status && status !== 'all') {
      countQuery += ' WHERE status = ?';
      countParams.push(status);
    }
    const countResults = await queryDatabase(countQuery, countParams);
    const countResult = countResults?.[0] as { total: number } | undefined;

    const releases = result.map((row: any) => ({
      ...row,
      territories: row.territories ? JSON.parse(row.territories) : ['worldwide'],
      explicitContent: Boolean(row.explicitContent),
    }));

    return NextResponse.json({
      releases,
      total: countResult?.total || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Releases API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 500 });
  }
}

// POST /api/command-center/releases - Create a new release
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      title,
      releaseType,
      artistName,
      labelName,
      upc,
      catalogNumber,
      coverArtUrl,
      originalReleaseDate,
      distributionReleaseDate,
      distributor = 'labelgrid',
      priceTier,
      territories = ['worldwide'],
      explicitContent = false,
      genre,
      subgenre,
      language = 'en',
      copyrightLine,
      phonographicLine,
      internalAlbumId,
    } = body;

    if (!title || !artistName || !releaseType) {
      return NextResponse.json(
        { error: 'title, artistName, and releaseType are required' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    await executeQuery(
      `
      INSERT INTO distribution_releases (
        id, title, release_type, artist_name, label_name,
        upc, catalog_number, cover_art_url,
        original_release_date, distribution_release_date,
        distributor, status, price_tier, territories,
        explicit_content, genre, subgenre, language,
        copyright_line, phonographic_line, internal_album_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        title,
        releaseType,
        artistName,
        labelName || null,
        upc || null,
        catalogNumber || null,
        coverArtUrl || null,
        originalReleaseDate || null,
        distributionReleaseDate || null,
        distributor,
        priceTier || null,
        JSON.stringify(territories),
        explicitContent ? 1 : 0,
        genre || null,
        subgenre || null,
        language,
        copyrightLine || null,
        phonographicLine || null,
        internalAlbumId || null,
        now,
        now
      ]
    );

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error('[Releases API] POST error:', error);
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 });
  }
}

export const runtime = 'edge';
