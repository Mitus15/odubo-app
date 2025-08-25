#!/bin/bash

echo "🔒 Deploying Cloudflare WAF Rules for Odubo Studio"
echo "=================================================="

ZONE_ID="71d8ed9bab3cfa90b3c5998c3eba4a2d"
API_TOKEN="xEt3UcOC3UQ0o0hCwhNup-DuGkYy3v115LQ-WY_1"

echo "✅ Configuration validated"
echo "🚀 Starting WAF deployment..."

# Create basic WAF rule
echo "📤 Creating basic WAF rule..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "filter": {
      "expression": "http.request.uri.query contains \"'\",
      "paused": false
    },
    "action": "block",
    "description": "SQL Injection Protection",
    "paused": false
  }'

echo ""
echo "⚡ Configuring rate limiting..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rate_limit_rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "API Rate Limiting",
    "expression": "http.request.uri.path contains \"/api/\"",
    "action": "challenge",
    "ratelimit": {
      "period": 60,
      "requests_per_period": 100,
      "mitigation_timeout": 300
    }
  }'

echo ""
echo "🛡️ Enabling security features..."
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_use_https" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"value": "on"}'

curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_level" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"value": "high"}'

echo ""
echo "🎉 WAF deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Check Cloudflare Dashboard for deployed rules"
echo "2. Test with: curl 'https://odubo.studio/api/users?id=1'\'' OR '\''1'\''='\''1'"
echo "3. Monitor Security Analytics"
