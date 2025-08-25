#!/bin/bash

# 🚀 Cloudflare WAF Deployment Script for Odubo Studio
# This script deploys comprehensive WAF rules to protect your application

set -e

# Configuration
ZONE_ID="71d8ed9bab3cfa90b3c5998c3eba4a2d"
API_TOKEN="xEt3UcOC3UQ0o0hCwhNup-DuGkYy3v115LQ-WY_1"
WAF_RULES_FILE="waf-rules.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 Deploying Cloudflare WAF Rules for Odubo Studio${NC}"
echo "=================================================="

# Check if required files exist
if [ ! -f "$WAF_RULES_FILE" ]; then
    echo -e "${RED}❌ WAF rules file not found: $WAF_RULES_FILE${NC}"
    exit 1
fi

# Check if environment variables are set
if [ "$ZONE_ID" = "your-cloudflare-zone-id" ]; then
    echo -e "${YELLOW}⚠️  Please set your Cloudflare Zone ID in the script${NC}"
    echo "   You can find this in your Cloudflare dashboard"
    exit 1
fi

if [ "$API_TOKEN" = "your-cloudflare-api-token" ]; then
    echo -e "${YELLOW}⚠️  Please set your Cloudflare API Token in the script${NC}"
    echo "   Create one at: https://dash.cloudflare.com/profile/api-tokens"
    exit 1
fi

echo -e "${GREEN}✅ Configuration validated${NC}"

# Function to deploy WAF rules
deploy_waf_rules() {
    echo -e "${BLUE}📤 Deploying WAF rules...${NC}"
    
    # Create WAF package
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/waf/packages" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data @$WAF_RULES_FILE
    
    echo -e "${GREEN}✅ WAF rules deployed successfully${NC}"
}

# Function to configure rate limiting
configure_rate_limiting() {
    echo -e "${BLUE}⚡ Configuring rate limiting...${NC}"
    
    # Create rate limiting rule for API endpoints
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rate_limit_rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "description": "API Rate Limiting",
            "expression": "(http.request.uri.path contains \"/api/\")",
            "action": "challenge",
            "ratelimit": {
                "period": 60,
                "requests_per_period": 100,
                "mitigation_timeout": 300
            }
        }'
    
    echo -e "${GREEN}✅ Rate limiting configured${NC}"
}

# Function to enable security features
enable_security_features() {
    echo -e "${BLUE}🛡️  Enabling security features...${NC}"
    
    # Enable Always Use HTTPS
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_use_https" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "on"}'
    
    # Enable HSTS
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_header" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "value": {
                "strict_transport_security": {
                    "enabled": true,
                    "max_age": 31536000,
                    "include_subdomains": true,
                    "preload": true
                }
            }
        }'
    
    # Enable Browser Integrity Check
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/browser_check" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "on"}'
    
    echo -e "${GREEN}✅ Security features enabled${NC}"
}

# Function to configure Page Rules
configure_page_rules() {
    echo -e "${BLUE}📄 Configuring page rules...${NC}"
    
    # Protect admin endpoints
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/pagerules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "targets": [
                {
                    "target": "url",
                    "constraint": {
                        "operator": "matches",
                        "value": "*/admin/*"
                    }
                }
            ],
            "actions": [
                {
                    "id": "security_level",
                    "value": "high"
                }
            ],
            "status": "active"
        }'
    
    # Protect API endpoints
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/pagerules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "targets": [
                {
                    "target": "url",
                    "constraint": {
                        "operator": "matches",
                        "value": "*/api/*"
                    }
                }
            ],
            "actions": [
                {
                    "id": "security_level",
                    "value": "medium"
                }
            ],
            "status": "active"
        }'
    
    echo -e "${GREEN}✅ Page rules configured${NC}"
}

# Main deployment
main() {
    echo -e "${BLUE}🚀 Starting WAF deployment...${NC}"
    
    deploy_waf_rules
    configure_rate_limiting
    enable_security_features
    configure_page_rules
    
    echo -e "${GREEN}🎉 WAF deployment completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next steps:${NC}"
    echo "1. Test your application to ensure WAF rules work correctly"
    echo "2. Monitor Cloudflare Analytics for security events"
    echo "3. Review and adjust rules based on your needs"
    echo "4. Set up alerts for security events"
    echo ""
    echo -e "${BLUE}🔗 Useful links:${NC}"
    echo "• Cloudflare Dashboard: https://dash.cloudflare.com"
    echo "• WAF Analytics: https://dash.cloudflare.com/analytics/security"
    echo "• Firewall Rules: https://dash.cloudflare.com/firewall"
}

# Run main function
main "$@"
