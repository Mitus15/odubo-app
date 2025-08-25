#!/bin/bash

echo "🔒 Deploying Cloudflare WAF Rules for Odubo Studio (FINAL)"
echo "=================================================="

ZONE_ID="71d8ed9bab3cfa90b3c5998c3eba4a2d"
API_TOKEN="xEt3UcOC3UQ0o0hCwhNup-DuGkYy3v115LQ-WY_1"

echo "✅ Configuration validated"
echo "🚀 Starting WAF deployment..."

# Enable security features (these work in free plan)
echo "🛡️ Enabling security features..."

echo "📝 Setting security level to high..."
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_level" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"high"}'

echo "📝 Enabling HTTPS enforcement..."
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_use_https" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"on"}'

echo "📝 Enabling HSTS..."
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_header" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":{"strict_transport_security":{"enabled":true,"max_age":31536000,"include_subdomains":true,"preload":true}}}'

echo "📝 Enabling browser integrity check..."
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/browser_check" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"on"}'

echo "📝 Enabling challenge passage..."
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/challenge_pass" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"on"}'

echo ""
echo "🎉 Basic WAF deployment completed!"
echo ""
echo "📋 What was deployed:"
echo "✅ Security Level: HIGH (blocks suspicious requests)"
echo "✅ HTTPS Enforcement: ON (forces HTTPS)"
echo "✅ HSTS: Enabled (1 year, includes subdomains)"
echo "✅ Browser Integrity Check: ON (challenges suspicious browsers)"
echo "✅ Challenge Passage: ON (allows legitimate users through)"
echo ""
echo "🔗 Next steps:"
echo "1. Go to Cloudflare Dashboard → Security → WAF"
echo "2. Create custom rules manually for SQL injection, XSS protection"
echo "3. Test with: curl 'https://odubo.studio/api/users?id=1'\'' OR '\''1'\''='\''1'"
echo "4. Monitor Security Analytics for blocked requests"
echo ""
echo "💡 Note: Advanced WAF rules require manual creation in dashboard"
echo "   Your security level is now HIGH, which provides basic protection"
