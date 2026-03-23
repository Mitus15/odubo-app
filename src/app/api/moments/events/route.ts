import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { EventCreateSchema } from '@/lib/momentsSchemas';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rl = await rateLimit({ key: `events-create:${ip}`, limit: 10, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Admin authentication
    const user = getUserFromRequest(req);
    if (!user || !isAdminUser(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    // Parse and validate input
    const body = await req.json();
    const validatedData = EventCreateSchema.parse(body);

    // Generate event ID
    const eventId = uuidv4();

    // Insert event into database
    const sql = `
      INSERT INTO events (
        id, name, description, location, starts_at, ends_at, 
        capacity, ticket_price, is_public, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      eventId,
      validatedData.name,
      validatedData.description || null,
      validatedData.location || null,
      validatedData.starts_at,
      validatedData.ends_at || null,
      validatedData.capacity || null,
      validatedData.ticket_price || 0,
      validatedData.is_public ? 1 : 0,
      validatedData.status || 'draft',
      user.userId,
    ];

    await queryDatabase(sql, params);

    // Audit log
    await writeAuditLog(req, user, 'event_create', eventId, {
      event_name: validatedData.name,
      status: validatedData.status || 'draft',
    });

    return NextResponse.json({
      success: true,
      event: {
        id: eventId,
        ...validatedData,
        created_by: user.userId,
      },
    });
  } catch (error: any) {
    console.error('Event creation error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rl = await rateLimit({ key: `events-list:${ip}`, limit: 30, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Admin authentication
    const user = getUserFromRequest(req);
    if (!user || !isAdminUser(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    // Get query parameters
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    const status = url.searchParams.get('status');

    // Build query
    let sql = `
      SELECT 
        e.*,
        u.email as created_by_email,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
    `;
    
    const params: any[] = [];
    
    if (status && ['draft', 'published', 'cancelled', 'completed'].includes(status)) {
      sql += ' WHERE e.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const events = await queryDatabase(sql, params);

    // Audit log
    await writeAuditLog(req, user, 'events_list', 'events', {
      count: events.length,
      filters: { status },
    });

    return NextResponse.json({
      success: true,
      events,
      pagination: {
        limit,
        offset,
        count: events.length,
      },
    });
  } catch (error: any) {
    console.error('Events listing error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}