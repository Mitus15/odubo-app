# Production Setup Guide 🚀

This guide covers everything needed to deploy your Odubo music platform to production.

## 🌐 **Production Environment Variables**

Create a `.env.production` file with these required variables:

### **Database (Cloudflare D1)**
```bash
# Production D1 Database
DATABASE_URL="https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
CLOUDFLARE_D1_TOKEN="your_d1_api_token"
CLOUDFLARE_ACCOUNT_ID="your_account_id"
CLOUDFLARE_D1_DATABASE_ID="c63953e2-82b5-407f-b10d-831fc7e5e85e"
```

### **File Storage (Cloudflare R2)**
```bash
# Production R2 Storage
CLOUDFLARE_R2_ENDPOINT="https://{account_id}.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY_ID="your_r2_access_key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="your_r2_secret_key"
CLOUDFLARE_R2_BUCKET_NAME="odubo-studio-media"
CLOUDFLARE_R2_PUBLIC_URL="https://media.odubo.studio"
```

### **Video Streaming (Cloudflare Stream)**
```bash
# Production Video Streaming
CLOUDFLARE_STREAM_ACCOUNT_ID="your_account_id"
CLOUDFLARE_STREAM_API_TOKEN="your_stream_api_token"
```

### **Authentication & Security**
```bash
# Production Security
JWT_SECRET="your_super_secure_jwt_secret_256_bits"
NEXT_PUBLIC_SITE_URL="https://odubo.studio"
```

### **E-Commerce (Shopify)**
```bash
# Production Shopify
SHOPIFY_STORE_URL="https://odubostudio.myshopify.com"
NEXT_PUBLIC_SHOPIFY_API_KEY="your_shopify_storefront_token"
SHOPIFY_STOREFRONT_VERSION="2024-07"
```

## 🔧 **Production Code Changes**

### **1. Fix Audio URL Resolution for Production**

The current `/api/test-audio` endpoint needs to handle production URLs properly:

```typescript
// src/app/api/test-audio/route.ts - Add production URL handling
const getBaseUrl = (request: NextRequest) => {
  // In production, use the configured site URL
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://odubo.studio';
  }
  // In development, use the request URL
  return new URL(request.url).origin;
};

// Update the URL resolution logic
const absoluteUrl = url.startsWith('/') 
  ? `${getBaseUrl(request)}${url}`
  : url;
```

### **2. Update CORS Headers for Production**

```typescript
// next.config.ts - Add production CORS
const corsHeaders = [
  { key: 'Access-Control-Allow-Origin', value: 'https://odubo.studio' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, Range' },
];
```

### **3. CDN Configuration**

Ensure your R2 bucket is properly configured with a custom domain:

```bash
# Set up custom domain for R2
# Point media.odubo.studio to your R2 bucket
# Configure SSL certificate
# Set Cache-Control headers for media files
```

## 📦 **Deployment Options**

### **Option 1: Vercel (Recommended)**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# https://vercel.com/your-team/odubo/settings/environment-variables
```

**Vercel Configuration:**
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### **Option 2: Cloudflare Pages**

```bash
# Build for Cloudflare Pages
npm run pages:build

# Deploy using Wrangler
npx wrangler pages deploy .vercel/output/static
```

### **Option 3: Docker + Any Cloud Provider**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🗄️ **Database Migration for Production**

```bash
# Run database migrations on production D1
npx wrangler d1 migrations apply odubo --remote

# Or manually execute schema
npx wrangler d1 execute odubo --file=database/schema.sql --remote
```

## 🔄 **File Organization Migration**

If you have existing production files, run the organization script:

```bash
# Set production environment variables first
export NODE_ENV=production

# Run video organization for production
npm run organize:videos --execute

# Run album fixes for production
npm run fix:albums
```

## 🚀 **Performance Optimizations**

### **1. Enable R2 CDN**
- Configure CloudFlare CDN for `media.odubo.studio`
- Set cache headers for long-term caching
- Enable gzip compression for audio files

### **2. Audio Streaming Optimization**
```typescript
// Add to streaming endpoints
res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
res.headers.set('Accept-Ranges', 'bytes');
```

### **3. Database Connection Pooling**
```typescript
// For high-traffic production
const connectionPool = new ConnectionPool({
  max: 10,
  timeout: 30000
});
```

## 🔒 **Security Checklist**

- [ ] JWT secrets are cryptographically secure (256+ bits)
- [ ] CORS is configured for your production domain only
- [ ] API rate limiting is enabled
- [ ] File upload size limits are appropriate
- [ ] Database queries use parameterized statements
- [ ] SSL/TLS is properly configured
- [ ] Environment variables are properly secured

## 📊 **Monitoring & Analytics**

### **Production Logging**
```typescript
// Add structured logging for production
import { createLogger } from '@vercel/log';

const logger = createLogger({
  service: 'odubo-music-platform',
  level: 'info'
});
```

### **Error Tracking**
```bash
# Add Sentry for error tracking
npm install @sentry/nextjs
```

## 🧪 **Production Testing**

### **Test Checklist**
- [ ] Audio streaming works across devices
- [ ] Cover art displays properly
- [ ] File uploads function correctly
- [ ] Database operations are fast
- [ ] CORS is properly configured
- [ ] Authentication flows work
- [ ] Mobile responsiveness is maintained

### **Load Testing**
```bash
# Test audio streaming under load
curl -H "Range: bytes=0-1023" https://odubo.studio/api/tracks/{id}/stream
```

## 🔄 **Deployment Script**

Create a deployment script:

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying Odubo to Production..."

# Run tests
npm run test

# Build the application
npm run build

# Deploy to Vercel
vercel --prod

# Run production health checks
curl https://odubo.studio/api/health

echo "✅ Deployment Complete!"
```

## 📋 **Post-Deployment Checklist**

- [ ] All environment variables are set
- [ ] Database migrations are applied
- [ ] Audio streaming endpoints respond correctly
- [ ] Cover art images load properly
- [ ] File organization is working
- [ ] Admin panel functions correctly
- [ ] Mobile/desktop experience is optimal
- [ ] SSL certificate is valid
- [ ] DNS is properly configured
- [ ] CDN is serving media files
- [ ] Monitoring is active

---

**Your production Odubo platform will be a robust, scalable music streaming service! 🎵✨**
