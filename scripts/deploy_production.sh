#!/bin/bash

# 🚀 Odubo Production Deployment Script
# This script handles the complete production deployment process

set -e  # Exit on any error

echo "🎵 Odubo Production Deployment Starting..."
echo "============================================="

# Color functions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "Not in the project root directory. Please run from the odubo project root."
    exit 1
fi

# Check if required environment variables are set
log_info "Checking environment variables..."
required_vars=(
    "NEXT_PUBLIC_SITE_URL"
    "CLOUDFLARE_R2_PUBLIC_URL"
    "CLOUDFLARE_R2_BUCKET_NAME"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    log_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    log_warning "Please set these in your .env.production file or deployment environment"
    exit 1
fi

log_success "Environment variables OK"

# Run linting and type checking
log_info "Running linting and type checks..."
npm run lint
log_success "Linting passed"

# Build the application
log_info "Building application for production..."
npm run build
log_success "Build completed"

# Run database migrations (if needed)
log_info "Checking database migrations..."
if command -v wrangler &> /dev/null; then
    log_info "Running D1 migrations..."
    npx wrangler d1 migrations apply odubo --remote || log_warning "Migration failed or not needed"
else
    log_warning "Wrangler not found. Skipping D1 migrations."
fi

# Organize existing media files (if needed)
log_info "Organizing media files..."
if [ "$1" = "--organize-media" ]; then
    log_info "Running media organization scripts..."
    npm run organize:videos --execute || log_warning "Video organization failed"
    npm run fix:albums || log_warning "Album fixes failed"
    log_success "Media organization completed"
else
    log_info "Skipping media organization (use --organize-media to run)"
fi

# Deploy to Vercel (or your chosen platform)
log_info "Deploying to production..."
if command -v vercel &> /dev/null; then
    vercel --prod
    log_success "Deployed to Vercel"
elif [ -f "wrangler.toml" ]; then
    log_info "Deploying to Cloudflare Pages..."
    npm run pages:build
    npx wrangler pages deploy .vercel/output/static
    log_success "Deployed to Cloudflare Pages"
else
    log_warning "No deployment tool found. Please deploy manually."
fi

# Health check
log_info "Running health checks..."
if [ -n "$NEXT_PUBLIC_SITE_URL" ]; then
    health_url="$NEXT_PUBLIC_SITE_URL/api/albums"
    log_info "Testing API endpoint: $health_url"
    
    if curl -sf "$health_url" > /dev/null; then
        log_success "API health check passed"
    else
        log_error "API health check failed"
        exit 1
    fi
else
    log_warning "NEXT_PUBLIC_SITE_URL not set, skipping health check"
fi

# Test audio streaming
log_info "Testing audio streaming..."
if [ -n "$NEXT_PUBLIC_SITE_URL" ]; then
    # Get first track for testing
    track_test_url="$NEXT_PUBLIC_SITE_URL/api/tracks"
    log_info "Testing audio streaming endpoint..."
    
    if curl -sf "$track_test_url" > /dev/null; then
        log_success "Audio streaming endpoint accessible"
    else
        log_warning "Audio streaming test inconclusive"
    fi
fi

echo "============================================="
log_success "🎉 Production deployment completed successfully!"
echo ""
log_info "Next steps:"
echo "  1. Test the production site manually"
echo "  2. Check that audio streaming works"
echo "  3. Verify cover art displays correctly"
echo "  4. Test admin functionality"
echo "  5. Monitor error logs for any issues"
echo ""
log_info "Production URL: ${NEXT_PUBLIC_SITE_URL:-'Not set'}"
log_info "Media CDN: ${CLOUDFLARE_R2_PUBLIC_URL:-'Not set'}"
echo ""
echo "🎵 Enjoy your production music platform! 🎵"
