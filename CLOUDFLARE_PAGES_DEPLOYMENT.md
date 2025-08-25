# Cloudflare Pages Deployment Guide 🌩️

Complete guide for deploying Odubo to Cloudflare Pages with D1, R2, and Stream integration.

## 🚀 **Why Cloudflare Pages?**

Perfect for your setup:
- ✅ **Native D1 Integration** - Direct database binding
- ✅ **Native R2 Integration** - Direct storage binding  
- ✅ **Stream Integration** - Built-in video streaming
- ✅ **Global Edge Network** - Ultra-fast worldwide performance
- ✅ **Zero Cold Starts** - Always-on edge functions
- ✅ **Unlimited Bandwidth** - No egress costs

## 📋 **Prerequisites**

1. **Cloudflare Account** with Pages access
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **GitHub Repository** connected to Cloudflare Pages
4. **Domain** pointed to Cloudflare (optional but recommended)

## 🔧 **Project Configuration**

### **1. Update `wrangler.toml` for Pages**

```toml
name = "odubo-app"
compatibility_date = "2025-01-15"
compatibility_flags = ["nodejs_compat"]

# Pages configuration
pages_build_output_dir = ".vercel/output/static"

# Database binding
[[d1_databases]]
binding = "DB"
database_name = "odubo"
database_id = "c63953e2-82b5-407f-b10d-831fc7e5e85e"

# Storage binding
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "odubo-studio-media"

# Environment variables for Pages
[env.production]
[env.production.vars]
NODE_ENV = "production"
NEXT_PUBLIC_SITE_URL = "https://odubo.studio"
CLOUDFLARE_R2_PUBLIC_URL = "https://media.odubo.studio"

# Secrets (set via dashboard or CLI)
# CLOUDFLARE_R2_ACCESS_KEY_ID
# CLOUDFLARE_R2_SECRET_ACCESS_KEY  
# JWT_SECRET
# SHOPIFY_STORE_URL
# NEXT_PUBLIC_SHOPIFY_API_KEY
```

### **2. Update `next.config.ts` for Pages** ✅ (Already Updated)

The config now includes:
- Edge runtime compatibility
- R2 hostname patterns for images
- Cloudflare Pages optimizations

### **3. Package.json Scripts** ✅ (Already Added)

```bash
# Quick deployment
npm run deploy:cf

# First-time deployment with secrets setup
npm run deploy:cf:secrets

# Full deployment with media organization
npm run deploy:cf:full
```

## 🚀 **Deployment Steps**

### **Step 1: Authentication**
```bash
# Install Wrangler CLI (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### **Step 2: Configure Secrets**
```bash
# Set production secrets (run once)
npm run deploy:cf:secrets
```

This will prompt you to enter:
- JWT_SECRET (256-bit secure string)
- CLOUDFLARE_R2_ACCESS_KEY_ID
- CLOUDFLARE_R2_SECRET_ACCESS_KEY  
- SHOPIFY_STORE_URL
- NEXT_PUBLIC_SHOPIFY_API_KEY

### **Step 3: Deploy**
```bash
# Standard deployment
npm run deploy:cf

# OR full deployment with media organization
npm run deploy:cf:full
```

## 🌐 **Domain Setup**

### **Option 1: Cloudflare Pages Domain**
Your site will be available at:
`https://odubo-app.pages.dev`

### **Option 2: Custom Domain**
1. Add your domain to Cloudflare
2. In Pages dashboard, go to Custom Domains
3. Add `odubo.studio` and `www.odubo.studio`
4. Update `NEXT_PUBLIC_SITE_URL` in wrangler.toml

### **Option 3: Media CDN Domain**
1. Create CNAME: `media.odubo.studio` → `odubo-studio-media.r2.cloudflarestorage.com`
2. Update `CLOUDFLARE_R2_PUBLIC_URL` in wrangler.toml

## ⚡ **Performance Optimizations**

### **Edge Functions**
- API routes run on Cloudflare's global edge
- Zero cold starts
- Sub-millisecond response times
- Automatic geographic distribution

### **Static Assets**
- Global CDN caching
- Brotli compression  
- HTTP/3 support
- Automatic image optimization

### **Database & Storage**
- D1 database with global read replicas
- R2 storage with unlimited bandwidth
- Stream delivery with global edge caching

## 🔧 **Environment Variables**

### **Required in Cloudflare Pages Dashboard:**
1. Go to Pages → odubo-app → Settings → Environment Variables
2. Add production variables:

```
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://odubo.studio
CLOUDFLARE_R2_PUBLIC_URL=https://media.odubo.studio
CLOUDFLARE_R2_BUCKET_NAME=odubo-studio-media
```

### **Secrets (Set via CLI):**
```bash
wrangler secret put JWT_SECRET
wrangler secret put CLOUDFLARE_R2_ACCESS_KEY_ID
wrangler secret put CLOUDFLARE_R2_SECRET_ACCESS_KEY
wrangler secret put SHOPIFY_STORE_URL
wrangler secret put NEXT_PUBLIC_SHOPIFY_API_KEY
```

## 📊 **Monitoring & Management**

### **View Logs**
```bash
# Real-time function logs
wrangler pages logs --project-name=odubo-app

# Deployment history
wrangler pages deployment list --project-name=odubo-app
```

### **Database Management**
```bash
# D1 console access
wrangler d1 console odubo --remote

# Run migrations
wrangler d1 migrations apply odubo --remote

# Query database
wrangler d1 execute odubo --command="SELECT COUNT(*) FROM albums" --remote
```

### **Storage Management**
```bash
# List R2 objects
wrangler r2 object list odubo-studio-media

# Check storage usage
wrangler r2 bucket list
```

## 🎵 **Audio Streaming on Cloudflare Pages**

### **Optimized Streaming**
- Range request support for seeking
- Global edge caching
- Automatic compression
- Mobile optimization

### **Streaming Endpoints**
- `/api/tracks/{id}/stream` - Proxied streaming
- Direct R2 URLs for fast delivery
- CORS headers for cross-origin audio

### **Performance Benefits**
- **<50ms latency** worldwide
- **Unlimited bandwidth** - no egress costs
- **Auto-scaling** - handles any traffic load
- **99.99% uptime** - enterprise reliability

## 🛡️ **Security Features**

### **Built-in Protection**
- DDoS protection
- Bot management
- WAF (Web Application Firewall)
- Rate limiting

### **Edge Security**
- Request validation at edge
- Authentication caching
- Secure header injection
- CSP enforcement

## 🔄 **CI/CD Integration**

### **GitHub Actions (Optional)**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run pages:build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: odubo-app
          directory: .vercel/output/static
```

## 🎯 **Production Checklist**

- [ ] Wrangler CLI installed and authenticated
- [ ] Secrets configured via `npm run deploy:cf:secrets`
- [ ] Domain DNS pointed to Cloudflare (if using custom domain)
- [ ] D1 database migrations applied
- [ ] R2 bucket configured with public access
- [ ] Media files organized via scripts
- [ ] Environment variables set in Pages dashboard
- [ ] SSL certificate configured
- [ ] Audio streaming tested on multiple devices

## 🚀 **Launch Commands**

### **First Time Setup:**
```bash
npm run deploy:cf:full
```

### **Regular Deployments:**
```bash
npm run deploy:cf
```

### **With Media Organization:**
```bash
npm run deploy:cf:full
```

---

## 🎉 **Benefits of Cloudflare Pages for Odubo**

✅ **Zero Configuration** - Native D1, R2, Stream integration  
✅ **Global Performance** - Edge functions + CDN worldwide  
✅ **Unlimited Scale** - Auto-scaling for any traffic  
✅ **Cost Effective** - No bandwidth charges, serverless pricing  
✅ **Developer Experience** - Hot reloads, preview deployments  
✅ **Enterprise Security** - DDoS protection, WAF, bot management  

**Your music platform will be blazingly fast worldwide! 🌍⚡🎵**

<function_calls>
<invoke name="read_file">
<parameter name="target_file">/Users/maniodubo/Documents/Apps/odubo/next.config.ts
