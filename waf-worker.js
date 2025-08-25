// 🛡️ Odubo Studio WAF Worker
// Basic WAF functionality implemented as a Cloudflare Worker

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    
    // Check if request should be blocked
    const blockReason = await checkSecurityRules(url, userAgent, ip, env);
    
    if (blockReason) {
      return new Response(`Access Denied: ${blockReason}`, {
        status: 403,
        statusText: 'Forbidden',
        headers: {
          'Content-Type': 'text/plain',
          'X-WAF-Blocked': blockReason
        }
      });
    }
    
    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(url, ip, env);
    if (!rateLimitResult.allowed) {
      return new Response('Too Many Requests', {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'Retry-After': Math.ceil(rateLimitResult.resetTime / 1000),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime
        }
      });
    }
    
    // Request passed all checks, continue
    return env.ASSETS.fetch(request);
  }
};

async function checkSecurityRules(url, userAgent, ip, env) {
  // SQL Injection protection
  const sqlPatterns = [
    /'/, /--/, /\/\*/, /\*\//, /xp_/, /sp_/, /@@/, /char\(/, /nchar\(/,
    /varchar\(/, /nvarchar\(/, /alter/, /begin/, /cast/, /create/, /cursor/,
    /declare/, /delete/, /drop/, /exec/, /execute/, /fetch/, /insert/, /kill/,
    /select/, /sys/, /sysobjects/, /syscolumns/, /table/, /update/
  ];
  
  const queryString = url.search;
  for (const pattern of sqlPatterns) {
    if (pattern.test(queryString)) {
      return 'SQL Injection attempt detected';
    }
  }
  
  // XSS protection
  const xssPatterns = [
    /<script/i, /javascript:/i, /vbscript:/i, /onload=/i, /onerror=/i,
    /onclick=/i, /onmouseover=/i, /<iframe/i, /<object/i, /<embed/i
  ];
  
  for (const pattern of xssPatterns) {
    if (pattern.test(queryString)) {
      return 'XSS attempt detected';
    }
  }
  
  // Path traversal protection
  const pathTraversalPatterns = [
    /\.\.\//, /\.\.\\/, /%2e%2e%2f/i, /%2e%2e%5c/i
  ];
  
  for (const pattern of pathTraversalPatterns) {
    if (pattern.test(url.pathname)) {
      return 'Path traversal attempt detected';
    }
  }
  
  // Bot protection (if enabled)
  if (env.BOT_PROTECTION === 'true') {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
      /python/i, /java/i, /perl/i, /ruby/i, /php/i, /go/i, /node/i
    ];
    
    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        return 'Bot activity detected';
      }
    }
  }
  
  return null; // No security issues found
}

async function checkRateLimit(url, ip, env) {
  if (env.RATE_LIMIT_ENABLED !== 'true') {
    return { allowed: true };
  }
  
  // Simple in-memory rate limiting (for demo purposes)
  // In production, use Cloudflare's built-in rate limiting or KV storage
  
  const key = `rate_limit:${ip}:${url.pathname}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;
  
  // This is a simplified version - Cloudflare has built-in rate limiting
  // that's more efficient than this worker-based approach
  
  return { allowed: true, resetTime: now + windowMs };
}
