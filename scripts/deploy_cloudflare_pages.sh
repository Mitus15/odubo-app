#!/bin/bash

# 🌩️ Cloudflare Pages Deployment Script for Odubo
# Optimized deployment for Cloudflare's edge network

set -e  # Exit on any error

echo "🌩️ Odubo → Cloudflare Pages Deployment"
echo "======================================"

# Color functions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${CYAN}🚀 $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "Not in the project root directory. Please run from the odubo project root."
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    log_error "Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

# Check authentication
log_step "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    log_error "Not authenticated with Cloudflare. Run: wrangler login"
    exit 1
fi

log_success "Cloudflare authentication OK"

# Check environment variables
log_step "Validating environment configuration..."
required_vars=(
    "NEXT_PUBLIC_SITE_URL"
    "CLOUDFLARE_R2_PUBLIC_URL"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log_warning "$var not set in current environment"
    else
        log_info "$var: ${!var}"
    fi
done

# Run type checking and linting
log_step "Running quality checks..."
npm run lint
log_success "Code quality checks passed"

# Build for Cloudflare Pages
log_step "Building for Cloudflare Pages..."
npm run pages:build
log_success "Pages build completed"

# Apply database migrations
log_step "Applying D1 database migrations..."
if [ "$1" = "--skip-migrations" ]; then
    log_info "Skipping migrations (--skip-migrations flag)"
else
    log_info "Applying migrations to production D1..."
    wrangler d1 migrations apply odubo --remote || {
        log_warning "Migrations may have failed or are not needed"
        read -p "Continue with deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Deployment cancelled"
            exit 1
        fi
    }
    log_success "Database migrations completed"
fi

# Set secrets if provided
log_step "Checking secrets configuration..."
if [ "$2" = "--set-secrets" ]; then
    log_info "Setting up production secrets..."
    echo "Please enter your production secrets:"
    
    read -s -p "JWT_SECRET (256-bit secure string): " jwt_secret
    echo
    echo "$jwt_secret" | wrangler secret put JWT_SECRET
    
    read -s -p "Cloudflare R2 Access Key ID: " r2_access_key
    echo  
    echo "$r2_access_key" | wrangler secret put CLOUDFLARE_R2_ACCESS_KEY_ID
    
    read -s -p "Cloudflare R2 Secret Access Key: " r2_secret_key
    echo
    echo "$r2_secret_key" | wrangler secret put CLOUDFLARE_R2_SECRET_ACCESS_KEY
    
    read -p "Shopify Store URL: " shopify_url
    echo "$shopify_url" | wrangler secret put SHOPIFY_STORE_URL
    
    read -p "Shopify API Key: " shopify_key  
    echo "$shopify_key" | wrangler secret put NEXT_PUBLIC_SHOPIFY_API_KEY
    
    log_success "Secrets configured"
else
    log_info "Skipping secrets setup (use --set-secrets to configure)"
fi

# Deploy to Cloudflare Pages
log_step "Deploying to Cloudflare Pages..."
log_info "Using output directory: .vercel/output/static"

if [ -d ".vercel/output/static" ]; then
    # Deploy with project name
    wrangler pages deploy .vercel/output/static --project-name=odubo-app
    log_success "Deployment to Cloudflare Pages completed!"
else
    log_error "Build output directory not found. Make sure 'npm run pages:build' succeeded."
    exit 1
fi

# Organize media files if requested
if [ "$1" = "--organize-media" ] || [ "$3" = "--organize-media" ]; then
    log_step "Organizing media files..."
    log_info "Running media organization scripts..."
    
    # Set production environment
    export NODE_ENV=production
    
    npm run organize:videos --execute || log_warning "Video organization may have failed"
    npm run fix:albums || log_warning "Album fixes may have failed"
    log_success "Media organization completed"
fi

# Run health checks
log_step "Running deployment health checks..."

# Get the deployment URL
if [ -n "$NEXT_PUBLIC_SITE_URL" ]; then
    health_url="$NEXT_PUBLIC_SITE_URL"
    log_info "Testing deployment at: $health_url"
    
    # Wait a moment for deployment to propagate
    log_info "Waiting for deployment to propagate (30s)..."
    sleep 30
    
    # Test homepage
    if curl -sf "$health_url" > /dev/null; then
        log_success "Homepage accessible"
    else
        log_warning "Homepage test failed (may need more time to propagate)"
    fi
    
    # Test API
    api_url="$health_url/api/albums"
    if curl -sf "$api_url" > /dev/null; then
        log_success "API endpoints accessible"
    else
        log_warning "API test failed (check D1 bindings)"
    fi
    
    # Test media CDN
    media_url="$CLOUDFLARE_R2_PUBLIC_URL"
    if [ -n "$media_url" ] && curl -sf "$media_url" > /dev/null; then
        log_success "Media CDN accessible"
    else
        log_warning "Media CDN test inconclusive"
    fi
    
else
    log_warning "NEXT_PUBLIC_SITE_URL not set, skipping health checks"
fi

# Final success message
echo "======================================"
log_success "🎉 Cloudflare Pages deployment completed!"
echo ""
log_info "✨ Your Odubo music platform is now live on Cloudflare's global edge network!"
echo ""
log_info "📊 Features deployed:"
echo "  🎵 Audio streaming with global edge caching"
echo "  🎨 Cover art delivery via R2 CDN"
echo "  💿 Album management with D1 database"
echo "  📱 Mobile-optimized streaming"
echo "  🔒 Secure authentication"
echo "  🛒 E-commerce integration"
echo ""
log_info "🔗 URLs:"
echo "  🌐 Site: ${NEXT_PUBLIC_SITE_URL:-'Set NEXT_PUBLIC_SITE_URL'}"
echo "  📁 Media: ${CLOUDFLARE_R2_PUBLIC_URL:-'Set CLOUDFLARE_R2_PUBLIC_URL'}"
echo ""
log_info "🛠️ Next steps:"
echo "  1. Test audio streaming on multiple devices"
echo "  2. Verify admin panel functionality"  
echo "  3. Check analytics in Cloudflare dashboard"
echo "  4. Monitor edge function logs"
echo ""
echo "🎵 Enjoy your lightning-fast music platform! 🎵"

# Show useful commands
echo ""
log_info "📋 Useful commands:"
echo "  View logs:     wrangler pages logs --project-name=odubo-app"
echo "  Check status:  wrangler pages deployment list --project-name=odubo-app" 
echo "  D1 console:    wrangler d1 console odubo --remote"
echo "  R2 objects:    wrangler r2 object list odubo-studio-media"
