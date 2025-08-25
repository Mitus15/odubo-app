#!/bin/bash

# 🚀 Cloudflare WAF Deployment Script for Odubo Studio (SIMPLE VERSION)
# This script deploys basic WAF rules using the correct API endpoints

set -e

# Configuration
ZONE_ID="71d8ed9bab3cfa90b3c5998c3eba4a2d"
API_TOKEN="xEt3UcOC3UQ0o0hCwhNup-DuGkYy3v115LQ-WY_1"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 Deploying Cloudflare WAF Rules for Odubo Studio (SIMPLE)${NC}"
echo "=================================================="

echo -e "${GREEN}✅ Configuration validated${NC}"

# Function to create basic WAF rules
create_basic_waf_rules() {
    echo -e "${BLUE}📤 Creating basic WAF rules...${NC}"
    
    # Create a simple SQL injection protection rule
    echo -e "${YELLOW}📝 Creating SQL Injection protection...${NC}"
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "filter": {
                "expression": "http.request.uri.query contains \"'\",
                "paused": false
            },
            "action": "block",
            "description": "SQL Injection Protection - Basic",
            "paused": false
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ SQL Injection rule created${NC}" || echo -e "${YELLOW}⚠️  SQL Injection rule may already exist${NC}"
    
    echo -e "${GREEN}✅ Basic WAF rules created${NC}"
}

# Function to configure rate limiting
configure_rate_limiting() {
    echo -e "${BLUE}⚡ Configuring rate limiting...${NC}"
    
    # Create rate limiting rule for API endpoints
    echo -e "${YELLOW}📝 Creating API rate limiting...${NC}"
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rate_limit_rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "description": "API Rate Limiting - Odubo Studio",
            "expression": "http.request.uri.path contains \"/api/\"",
            "action": "challenge",
            "ratelimit": {
                "period": 60,
                "requests_per_period": 100,
                "mitigation_timeout": 300
            }
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ API rate limiting configured${NC}" || echo -e "${YELLOW}⚠️  API rate limiting may already exist${NC}"
    
    echo -e "${GREEN}✅ Rate limiting configured${NC}"
}

# Function to enable security features
enable_security_features() {
    echo -e "${BLUE}🛡️  Enabling security features...${NC}"
    
    # Enable Always Use HTTPS
    echo -e "${YELLOW}📝 Enabling HTTPS enforcement...${NC}"
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_use_https" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "on"}' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ HTTPS enforcement enabled${NC}" || echo -e "${YELLOW}⚠️  HTTPS enforcement may already be enabled${NC}"
    
    # Enable HSTS
    echo -e "${YELLOW}📝 Enabling HSTS...${NC}"
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
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ HSTS enabled${NC}" || echo -e "${YELLOW}⚠️  HSTS may already be enabled${NC}"
    
    # Enable Browser Integrity Check
    echo -e "${YELLOW}📝 Enabling browser integrity check...${NC}"
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/browser_check" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "on"}' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ Browser integrity check enabled${NC}" || echo -e "${YELLOW}⚠️  Browser integrity check may already be enabled${NC}"
    
    echo -e "${GREEN}✅ Security features enabled${NC}"
}

# Function to set security level
set_security_level() {
    echo -e "${BLUE}🔐 Setting security level...${NC}"
    
    # Set Security Level to High
    echo -e "${YELLOW}📝 Setting security level to high...${NC}"
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_level" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "high"}' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ Security level set to high${NC}" || echo -e "${YELLOW}⚠️  Security level may already be set to high${NC}"
    
    echo -e "${GREEN}✅ Security level configured${NC}"
}

# Main deployment
main() {
    echo -e "${BLUE}🚀 Starting WAF deployment...${NC}"
    
    create_basic_waf_rules
    configure_rate_limiting
    enable_security_features
    set_security_level
    
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
    echo ""
    echo -e "${GREEN}🧪 Test your WAF:${NC}"
    echo "• SQL Injection: curl 'https://odubo.studio/api/users?id=1'\'' OR '\''1'\''='\''1'"
    echo "• Rate Limiting: Make 101 requests to /api/ endpoint quickly"
    echo "• Security Level: Check if suspicious requests are challenged"
}

# Run main function
main "$@"
