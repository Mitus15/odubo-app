import { NextRequest, NextResponse } from 'next/server';

/**
 * Sync Shopify Customer Data
 * 
 * Stores Shopify customer information in your local database
 * for unified user management across your platform.
 */
export async function POST(request: NextRequest) {
  try {
    const { customerId, email, firstName, lastName, customerAccessToken } = await request.json();

    if (!customerId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get database connection
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Query function for Cloudflare D1
    const queryDatabase = async (query: string, params: any[] = []) => {
      const response = await fetch(DATABASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        },
        body: JSON.stringify({
          sql: query,
          params: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`Database query failed: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(`Database error: ${result.error || 'Unknown error'}`);
      }

      return result.result;
    };

    // Check if customer already exists
    const existingUser = await queryDatabase(
      'SELECT id, email, shopify_customer_id FROM users WHERE email = ? OR shopify_customer_id = ?',
      [email, customerId]
    );

    if (existingUser && existingUser.length > 0) {
      // Update existing user with Shopify info
      await queryDatabase(
        `UPDATE users SET 
          shopify_customer_id = ?,
          shopify_customer_token = ?,
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [customerId, customerAccessToken, firstName, lastName, existingUser[0].id]
      );

      return NextResponse.json({ 
        success: true, 
        message: 'Customer updated',
        userId: existingUser[0].id 
      });
    } else {
      // Create new user from Shopify customer
      const result = await queryDatabase(
        `INSERT INTO users (
          email, 
          first_name, 
          last_name, 
          shopify_customer_id, 
          shopify_customer_token,
          email_verified,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [email, firstName || null, lastName || null, customerId, customerAccessToken]
      );

      return NextResponse.json({ 
        success: true, 
        message: 'Customer created',
        userId: result.meta.last_row_id 
      });
    }

  } catch (error) {
    console.error('Shopify customer sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync customer data' }, 
      { status: 500 }
    );
  }
}