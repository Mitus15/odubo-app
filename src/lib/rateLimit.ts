// Distributed rate limiter using Cloudflare D1 for production use
// Provides better security and works across multiple instances
import { executeQuery as d1Execute } from '@/lib/db';

type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

// Initialize rate limiting table if it doesn't exist
async function initRateLimitTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 1,
        reset_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch() * 1000),
        updated_at INTEGER DEFAULT (unixepoch() * 1000)
      );
      
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at ON rate_limits(updated_at);
    `;
    
    await executeQuery(sql);
  } catch (error) {
    console.error('Failed to initialize rate limit table:', error);
  }
}

// Clean up expired rate limit entries
async function cleanupExpiredRateLimits() {
  try {
    const now = Date.now();
    const sql = `DELETE FROM rate_limits WHERE reset_at < ?`;
    await executeQuery(sql, [now]);
  } catch (error) {
    console.error('Failed to cleanup expired rate limits:', error);
  }
}

// Execute database query (using your existing db.ts pattern)
const executeQuery = d1Execute;

export async function rateLimit({ key, limit, windowMs }: RateLimitConfig): Promise<RateLimitResult> {
  try {
    // Initialize table on first use
    await initRateLimitTable();
    
    // Clean up expired entries periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup
      await cleanupExpiredRateLimits();
    }

    const now = Date.now();
    const resetAt = now + windowMs;
    
    // Try to get existing rate limit entry
    const getSql = `SELECT count, reset_at FROM rate_limits WHERE key = ?`;
    const getResult = await executeQuery(getSql, [key]) as any;
    
    if (getResult.result?.[0]?.results?.[0]) {
      const existing = getResult.result[0].results[0];
      
      // Check if window has expired
      if (now > existing.reset_at) {
        // Reset the counter
        const updateSql = `UPDATE rate_limits SET count = 1, reset_at = ?, updated_at = ? WHERE key = ?`;
        await executeQuery(updateSql, [resetAt, now, key]);
        
        return { allowed: true, remaining: limit - 1, resetAt };
      }
      
      // Check if limit exceeded
      if (existing.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: existing.reset_at };
      }
      
      // Increment counter
      const incrementSql = `UPDATE rate_limits SET count = count + 1, updated_at = ? WHERE key = ?`;
      await executeQuery(incrementSql, [now, key]);
      
      return { allowed: true, remaining: limit - existing.count - 1, resetAt: existing.reset_at };
    } else {
      // Create new entry
      const insertSql = `INSERT INTO rate_limits (key, count, reset_at, created_at, updated_at) VALUES (?, 1, ?, ?, ?)`;
      await executeQuery(insertSql, [key, resetAt, now, now]);
      
      return { allowed: true, remaining: limit - 1, resetAt };
    }
  } catch (error) {
    console.error('Rate limiting error:', error);
    
    // Fallback to basic in-memory rate limiting if database fails
    return fallbackRateLimit({ key, limit, windowMs });
  }
}

// Fallback in-memory rate limiter for when database is unavailable
const fallbackWindows = new Map<string, { count: number; resetAt: number }>();

function fallbackRateLimit({ key, limit, windowMs }: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const existing = fallbackWindows.get(key);
  
  if (!existing || now > existing.resetAt) {
    fallbackWindows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  
  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

// Utility function to get rate limit info without consuming a request
export async function getRateLimitInfo(key: string): Promise<{ count: number; resetAt: number; remaining: number } | null> {
  try {
    const sql = `SELECT count, reset_at FROM rate_limits WHERE key = ?`;
    const result = await executeQuery(sql, [key]) as any;
    
    if (result.result?.[0]?.results?.[0]) {
      const data = result.result[0].results[0];
      const now = Date.now();
      
      if (now > data.reset_at) {
        return null; // Expired
      }
      
      return {
        count: data.count,
        resetAt: data.reset_at,
        remaining: Math.max(0, 10 - data.count) // Assuming default limit of 10
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get rate limit info:', error);
    return null;
  }
}


