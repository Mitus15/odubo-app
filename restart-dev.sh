#!/bin/bash

# Script to restart Next.js dev server with cache clearing
# Usage: ./restart-dev.sh

echo "🔄 Restarting Next.js development server..."

# Kill any running Next.js dev servers
echo "⏹️  Stopping existing dev servers..."
pkill -f "next dev" 2>/dev/null || true
sleep 1

# Clear Next.js cache
echo "🧹 Clearing Next.js cache..."
rm -rf .next

# Clear Turbopack cache
echo "🧹 Clearing Turbopack cache..."
rm -rf .turbo

# Optional: Clear node_modules/.cache if it exists
if [ -d "node_modules/.cache" ]; then
  echo "🧹 Clearing node_modules cache..."
  rm -rf node_modules/.cache
fi

# Wait a moment to ensure ports are released
sleep 2

echo "✅ Cache cleared! Starting dev server..."
echo ""

# Start the dev server
npm run dev
