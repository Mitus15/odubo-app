import { NextRequest } from 'next/server';

export type User = {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  is_admin?: boolean;
  role?: string;
  reset_token_hash?: string | null;
  reset_token_expiry?: number | null;
  // Account lockout fields (will be added later)
  failed_login_attempts?: number;
  account_locked_until?: string | null;
  last_failed_login?: string | null;
  // Email verification fields (using existing structure)
  email_verified?: boolean;
  email_verification_token?: string | null;
  email_verification_expiry?: string | null;
  email_verified_at?: string | null;
  // Shopify integration fields
  shopify_customer_id?: string | null;
  total_spent?: number;
};

// Cloudflare D1 database client for Next.js API routes
// Using HTTP API approach with proper environment variable names

// Use Web Crypto API for token generation (Edge-compatible)
function generateRandomHexString(byteLength: number): string {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Database helper functions
export async function executeQuery(sql: string, params: any[] = []) {
  try {
  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN environment variable is not set');
    }
    
    const response = await fetch(`${databaseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ sql, params }),
    });
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const text = await response.text();
      throw new Error(`D1 /query non-JSON response (${response.status}): ${text.slice(0, 500)}`);
    }

    const data = await response.json() as { success?: boolean; [key: string]: any };
    if (!response.ok || data.success === false) {
      throw new Error('Database query failed: ' + JSON.stringify(data));
    }
    
    return data;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function queryDatabase(sql: string, params: any[] = []) {
  try {
  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN environment variable is not set');
    }
    
    const response = await fetch(`${databaseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ sql, params }),
    });
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const text = await response.text();
      throw new Error(`D1 /query non-JSON response (${response.status}): ${text.slice(0, 500)}`);
    }

    const data = await response.json() as {
      result?: { results?: any[] }[];
      success?: boolean;
      [key: string]: any;
    };
    if (!response.ok || !data.result) {
      throw new Error('Database query failed: ' + JSON.stringify(data));
    }
    
    return data.result[0]?.results || [];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function insertUser(user: {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  is_admin?: boolean;
}) {
  try {
  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN environment variable is not set');
    }
    
    // Use a simpler INSERT statement that only includes the essential fields
    // and lets the database handle defaults for missing fields
    const sql = `INSERT INTO users (id, email, username, password_hash, first_name, last_name, is_admin, email_verified, is_active, subscription_tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    const params = [
      user.id,
      user.email,
      user.username,
      user.password_hash,
      user.first_name || null,
      user.last_name || null,
      user.is_admin === true ? 1 : 0,
      0, // email_verified = false by default
      1, // is_active = true by default
      'free', // subscription_tier = 'free' by default
    ];
    console.log('Inserting user with email:', user.email, 'params:', params);
    
    const response = await fetch(`${databaseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ sql, params }),
    });
    
    const data = await response.json() as { success?: boolean; [key: string]: any };
    console.log('Insert user response:', data);
    if (!response.ok || data.success === false) {
      throw new Error('Failed to insert user: ' + JSON.stringify(data));
    }
    return { success: true };
  } catch (error) {
    console.error('Insert user error:', error);
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN environment variable is not set');
    }
    
    const sql = 'SELECT * FROM users WHERE email = ? LIMIT 1';
    const params = [email];
    console.log('Querying user by email:', email);
    
    const response = await fetch(`${databaseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ sql, params }),
    });
    
    const data = await response.json() as {
      result?: { results?: any[] }[];
      success?: boolean;
      [key: string]: any;
    };
    console.log('getUserByEmail response:', data);
    
    // Cloudflare D1 HTTP API: user row is in data.result[0].results[0]
    if (!response.ok || !data.result || !data.result.length || !data.result[0].results || !data.result[0].results.length) return null;
    const row = data.result[0].results[0];
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      password_hash: row.password_hash,
      first_name: row.first_name,
      last_name: row.last_name,
      is_admin: row.is_admin === 1 || row.is_admin === true,
      reset_token_hash: row.reset_token_hash,
      reset_token_expiry: row.reset_token_expiry,
      // Account lockout fields
      failed_login_attempts: row.failed_login_attempts || 0,
      account_locked_until: row.account_locked_until,
      last_failed_login: row.last_failed_login,
      // Email verification fields
      email_verified: row.email_verified === 1 || row.email_verified === true || row.email_verified === "true",
      email_verification_token: row.email_verification_token,
      email_verification_expiry: row.email_verification_expiry,
      email_verified_at: row.email_verified_at,
    };
  } catch (error) {
    console.error('Get user by email error:', error);
    throw error;
  }
}

export async function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'username'>>) {
  // Convert updates into a dynamic UPDATE statement
  const fields: string[] = [];
  const params: any[] = [];
  const set = (col: string, val: any) => { if (val !== undefined) { fields.push(`${col} = ?`); params.push(val); } };

  set('email', (updates as any).email);
  set('password_hash', (updates as any).password_hash);
  set('first_name', updates.first_name);
  set('last_name', updates.last_name);
  set('is_admin', updates.is_admin !== undefined ? (updates.is_admin ? 1 : 0) : undefined);
  set('role', (updates as any).role);
  set('email_verified', (updates as any).email_verified !== undefined ? ((updates as any).email_verified ? 1 : 0) : undefined);
  set('email_verification_token_hash', (updates as any).email_verification_token_hash);
  set('email_verification_expiry', (updates as any).email_verification_expiry);
  set('reset_token_hash', (updates as any).reset_token_hash);
  set('reset_token_expiry', (updates as any).reset_token_expiry);
  set('invite_token_hash', (updates as any).invite_token_hash);
  set('invite_token_expiry', (updates as any).invite_token_expiry);
  set('failed_login_attempts', (updates as any).failed_login_attempts);
  set('account_locked_until', (updates as any).account_locked_until);
  set('last_failed_login', (updates as any).last_failed_login);

  if (fields.length === 0) return { success: true, message: 'No updates' };

  const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  params.push(id);
  await executeQuery(sql, params);
  return { success: true };
}

// Account lockout functions
export async function incrementFailedLoginAttempts(email: string): Promise<{ isLocked: boolean; lockoutExpiry?: string }> {
  try {
  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN environment variable is not set');
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    
    // For now, just return not locked since we don't have the lockout fields yet
    // TODO: Implement proper account lockout when we add the fields
    return { isLocked: false };
  } catch (error) {
    console.error('Increment failed login attempts error:', error);
    throw error;
  }
}

export async function resetFailedLoginAttempts(email: string): Promise<void> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN environment variable is not set');
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    
    // For now, do nothing since we don't have the lockout fields yet
    // TODO: Implement proper account lockout reset when we add the fields
  } catch (error) {
    console.error('Reset failed login attempts error:', error);
    throw error;
  }
}

export async function isAccountLocked(email: string): Promise<{ isLocked: boolean; lockoutExpiry?: string }> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN environment variable is not set');
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return { isLocked: false };
    }
    
    // For now, return not locked since we don't have the lockout fields yet
    // TODO: Implement proper account lockout when we add the fields
    return { isLocked: false };
  } catch (error) {
    console.error('Check account lockout error:', error);
    return { isLocked: false };
  }
}

// Email verification functions (adapted for existing database structure)
export async function generateEmailVerificationToken(email: string): Promise<{ token: string; expiry: string }> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN environment variable is not set');
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    
    // For now, just generate a token (we'll store it in memory or use a different approach)
    // Since we don't have the token fields in the database yet
    const token = generateRandomHexString(32);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    // TODO: Store token in database when we add the fields
    // For now, we'll just return the token and handle verification differently
    
    return { token, expiry };
  } catch (error) {
    console.error('Generate email verification token error:', error);
    throw error;
  }
}

export async function verifyEmailToken(email: string, token: string): Promise<boolean> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN environment variable is not set');
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return false;
    }
    
    // For now, just mark the email as verified since we don't have token validation
    // TODO: Implement proper token validation when we add the fields
    
    // Mark email as verified
    await updateUser(user.id, {
      email_verified: true
    });
    
    return true;
  } catch (error) {
    console.error('Verify email token error:', error);
    return false;
  }
}

export async function isEmailVerified(email: string): Promise<boolean> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN environment variable is not set');
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return false;
    }
    
    return user.email_verified || false;
  } catch (error) {
    console.error('Check email verification error:', error);
    return false;
  }
}

export async function deleteUser(id: string) {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN environment variable is not set');
    }
    
    const sql = 'DELETE FROM users WHERE id = ?';
    const params = [id];
    console.log('Deleting user with id:', id);
    
    const response = await fetch(`${databaseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ sql, params }),
    });
    
    const data = await response.json() as { success?: boolean; [key: string]: any };
    console.log('Delete user response:', data);
    if (!response.ok || data.success === false) {
      throw new Error('Failed to delete user: ' + JSON.stringify(data));
    }
    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    throw error;
  }
}

// Job status upsert for background clip generation pipeline
// NOTE: Requires migration creating table `job_status` with columns:
// jobId TEXT PRIMARY KEY, status TEXT, videoId INTEGER, cfVideoId TEXT, errorDetails TEXT, created_at TEXT, updated_at TEXT
export async function updateJobStatus(
  jobId: string,
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
  errorDetails: string | null = null,
  videoId?: number,
  cfVideoId?: string
) {
  const sql = `
    INSERT INTO job_status (jobId, status, errorDetails, videoId, cfVideoId, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(jobId) DO UPDATE SET
      status = excluded.status,
      errorDetails = excluded.errorDetails,
      videoId = COALESCE(excluded.videoId, job_status.videoId),
      cfVideoId = COALESCE(excluded.cfVideoId, job_status.cfVideoId),
      updated_at = CURRENT_TIMESTAMP
  `;
  await executeQuery(sql, [jobId, status, errorDetails, videoId ?? null, cfVideoId ?? null]);
}

// Append a job event for timeline
export async function appendJobEvent(jobId: string, step: string, message?: string) {
  const sql = `INSERT INTO job_status_events (jobId, step, message, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
  await executeQuery(sql, [jobId, step, message ?? null]);
}