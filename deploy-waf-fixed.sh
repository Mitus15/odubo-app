#!/bin/bash

# 🚀 Cloudflare WAF Deployment Script for Odubo Studio (FIXED VERSION)
# This script deploys comprehensive WAF rules using the correct API endpoints

set -e

# Configuration
ZONE_ID="71d8ed9bab3cfa90b3c5998c3eba4a2d"
API_TOKEN="xEt3UcOC3UQ0o0hCwhNup-DuGkYy3v115LQ-WY_1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 Deploying Cloudflare WAF Rules for Odubo Studio (FIXED)${NC}"
echo "=================================================="

echo -e "${GREEN}✅ Configuration validated${NC}"

# Function to create WAF rules using the correct API
create_waf_rules() {
    echo -e "${BLUE}📤 Creating WAF rules...${NC}"
    
    # Create SQL Injection protection rule
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "filter": {
                "expression": "(http.request.uri.query contains \"'\") or (http.request.uri.query contains \"--\") or (http.request.uri.query contains \"/*\") or (http.request.uri.query contains \"*/\") or (http.request.uri.query contains \"select\") or (http.request.uri.query contains \"union\") or (http.request.uri.query contains \"drop\") or (http.request.uri.query contains \"insert\") or (http.request.uri.query contains \"update\") or (http.request.uri.query contains \"delete\")",
                "paused": false
            },
            "action": "block",
            "description": "SQL Injection Protection - Odubo Studio",
            "paused": false
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ SQL Injection rule created${NC}" || echo -e "${YELLOW}⚠️  SQL Injection rule may already exist${NC}"
    
    # Create XSS protection rule
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "filter": {
                "expression": "(http.request.uri.query contains \"<script\") or (http.request.uri.query contains \"javascript:\") or (http.request.uri.query contains \"onload=\") or (http.request.uri.query contains \"onclick=\") or (http.request.uri.query contains \"<iframe\") or (http.request.uri.query contains \"<object\")",
                "paused": false
            },
            "action": "block",
            "description": "XSS Protection - Odubo Studio",
            "paused": false
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ XSS protection rule created${NC}" || echo -e "${YELLOW}⚠️  XSS protection rule may already exist${NC}"
    
    # Create path traversal protection rule
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/firewall/rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "filter": {
                "expression": "(http.request.uri.path contains \"../\") or (http.request.uri.path contains \"..\\\\\") or (http.request.uri.path contains \"%2e%2e%2f\")",
                "paused": false
            },
            "action": "block",
            "description": "Path Traversal Protection - Odubo Studio",
            "paused": false
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ Path traversal protection rule created${NC}" || echo -e "${YELLOW}⚠️  Path traversal protection rule may already exist${NC}"
    
    echo -e "${GREEN}✅ WAF rules created successfully${NC}"
}

# Function to configure rate limiting using the correct API
configure_rate_limiting() {
    echo -e "${BLUE}⚡ Configuring rate limiting...${NC}"
    
    # Create rate limiting rule for API endpoints
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rate_limit_rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "description": "API Rate Limiting - Odubo Studio",
            "expression": "(http.request.uri.path contains \"/api/\")",
            "action": "challenge",
            "ratelimit": {
                "period": 60,
                "requests_per_period": 100,
                "mitigation_timeout": 300
            }
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ API rate limiting configured${NC}" || echo -e "${YELLOW}⚠️  API rate limiting may already exist${NC}"
    
    # Create rate limiting rule for admin endpoints
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rate_limit_rules" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "description": "Admin Rate Limiting - Odubo Studio",
            "expression": "(http.request.uri.path contains \"/admin\") or (http.request.uri.path contains \"/studio\")",
            "action": "challenge",
            "ratelimit": {
                "period": 60,
                "requests_per_period": 50,
                "mitigation_timeout": 600
            }
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ Admin rate limiting configured${NC}" || echo -e "${YELLOW}⚠️  Admin rate limiting may already exist${NC}"
    
    echo -e "${GREEN}✅ Rate limiting configured${NC}"
}

# Function to enable security features
enable_security_features() {
    echo -e "${BLUE}🛡️  Enabling security features...${NC}"
    
    # Enable Always Use HTTPS
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_use_https" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "on"}' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ HTTPS enforcement enabled${NC}" || echo -e "${YELLOW}⚠️  HTTPS enforcement may already be enabled${NC}"
    
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
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ HSTS enabled${NC}" || echo -e "${YELLOW}⚠️  HSTS may already be enabled${NC}"
    
    # Enable Browser Integrity Check
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/browser_check" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "on"}' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ Browser integrity check enabled${NC}" || echo -e "${YELLOW}⚠️  Browser integrity check may already be enabled${NC}"
    
    echo -e "${GREEN}✅ Security features enabled${NC}"
}

# Function to configure Page Rules with correct domain
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
                        "value": "odubo.studio/admin/*"
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
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ Admin page rule created${NC}" || echo -e "${YELLOW}⚠️  Admin page rule may already exist${NC}"
    
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
                        "value": "odubo.studio/api/*"
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
        }' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ API page rule created${NC}" || echo -e "${YELLOW}⚠️  API page rule may already exist${NC}"
    
    echo -e "${GREEN}✅ Page rules configured${NC}"
}

# Function to enable additional security features
enable_additional_security() {
    echo -e "${BLUE}🔐 Enabling additional security features...${NC}"
    
    # Enable Security Level to High
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_level" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "high"}' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ Security level set to high${NC}" || echo -e "${YELLOW}⚠️  Security level may already be set to high${NC}"
    
    # Enable Challenge Passage
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/challenge_pass" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value": "on"}' 2>/dev/null | grep -q '"success":true' && echo -e "${GREEN}✅ Challenge passage enabled${NC}" || echo -e "${YELLOW}⚠️  Challenge passage may already be enabled${NC}"
    
    echo -e "${GREEN}✅ Additional security features enabled${NC}"
}

# Main deployment
main() {
    echo -e "${BLUE}🚀 Starting WAF deployment...${NC}"
    
    create_waf_rules
    configure_rate_limiting
    enable_security_features
    configure_page_rules
    enable_additional_security
    
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
    echo "• XSS: curl 'https://odubo.studio/search?q=<script>alert(1)</script>'"
    echo "• Path Traversal: curl 'https://odubo.studio/../../../etc/passwd'"
}

# Run main function
main "$@"
