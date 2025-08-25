# 🛡️ **WAF DEPLOYMENT GUIDE - Odubo Studio**

## 🚀 **QUICK START (Recommended)**

### **Step 1: Get Your Cloudflare Credentials**

1. **Zone ID:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Select your domain (e.g., `odubo.studio`)
   - Copy the Zone ID from the right sidebar

2. **API Token:**
   - Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use "Custom token" template
   - Add these permissions:
     ```
     Zone:Zone:Edit
     Zone:Zone Settings:Edit
     Zone:Firewall Services:Edit
     Zone:Page Rules:Edit
     Zone:Rate Limiting:Edit
     ```

### **Step 2: Update Configuration**

Edit `deploy-waf.sh` and replace:
```bash
ZONE_ID="your-actual-zone-id-here"
API_TOKEN="your-actual-api-token-here"
```

### **Step 3: Deploy**

```bash
chmod +x deploy-waf.sh
./deploy-waf.sh
```

---

## 🔧 **DEPLOYMENT OPTIONS**

### **Option 1: Automated Script (Easiest)**

✅ **Pros:** One-command deployment, comprehensive setup
❌ **Cons:** Requires API token setup

```bash
./deploy-waf.sh
```

**What it does:**
- Deploys WAF rules
- Configures rate limiting
- Enables security features (HTTPS, HSTS, Browser Check)
- Sets up page rules for admin/API protection

### **Option 2: Manual Dashboard Setup**

✅ **Pros:** Visual control, no API tokens needed
❌ **Cons:** Time-consuming, manual configuration

1. **Go to Security → WAF**
2. **Create Custom Rules:**
   - SQL Injection protection
   - XSS protection
   - Path traversal protection
   - Rate limiting rules

### **Option 3: Cloudflare Worker (Advanced)**

✅ **Pros:** Edge-level protection, customizable
❌ **Cons:** More complex, requires wrangler CLI

```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy worker
wrangler deploy --env production
```

---

## 📋 **WAF RULES BREAKDOWN**

### **🔒 Security Rules**

| Rule | Purpose | Action |
|------|---------|---------|
| SQL Injection | Blocks SQL attack attempts | Block |
| XSS Protection | Prevents script injection | Block |
| Path Traversal | Blocks directory traversal | Block |
| Command Injection | Blocks shell command attempts | Block |
| File Inclusion | Blocks file inclusion attacks | Block |

### **⚡ Rate Limiting**

- **API Endpoints:** 100 requests/minute
- **Admin Areas:** 50 requests/minute
- **General:** 1000 requests/minute

### **🤖 Bot Protection**

- Challenges suspicious bot activity
- Blocks known malicious user agents
- Protects against automated attacks

---

## 🧪 **TESTING YOUR WAF**

### **Test SQL Injection Protection:**
```bash
curl "https://yourdomain.com/api/users?id=1' OR '1'='1"
# Should return 403 Forbidden
```

### **Test XSS Protection:**
```bash
curl "https://yourdomain.com/search?q=<script>alert('xss')</script>"
# Should return 403 Forbidden
```

### **Test Rate Limiting:**
```bash
# Make 101 requests quickly
for i in {1..101}; do curl "https://yourdomain.com/api/users"; done
# Should get 429 Too Many Requests after 100
```

---

## 📊 **MONITORING & ANALYTICS**

### **Cloudflare Dashboard:**
- **Security → WAF:** View blocked requests
- **Analytics → Security:** Monitor attack patterns
- **Firewall → Events:** Real-time security events

### **Key Metrics to Watch:**
- **Blocked Requests:** Should increase after deployment
- **False Positives:** Legitimate requests being blocked
- **Attack Patterns:** Types of attacks being attempted

---

## 🚨 **TROUBLESHOOTING**

### **Common Issues:**

1. **"Zone not found"**
   - Check Zone ID is correct
   - Ensure domain is added to Cloudflare

2. **"Permission denied"**
   - Verify API token has correct permissions
   - Check if token is expired

3. **Too many false positives**
   - Adjust rule sensitivity
   - Whitelist legitimate traffic patterns

4. **Performance impact**
   - Monitor response times
   - Adjust rate limiting thresholds

### **Emergency Disable:**
```bash
# Disable WAF temporarily
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/security_level" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"value": "medium"}'
```

---

## 🔄 **MAINTENANCE**

### **Regular Updates:**
- Review blocked requests monthly
- Update rule patterns quarterly
- Monitor security advisories

### **Rule Tuning:**
- Adjust sensitivity based on traffic patterns
- Whitelist legitimate automation tools
- Fine-tune rate limiting thresholds

---

## 📞 **SUPPORT**

- **Cloudflare Support:** [help.cloudflare.com](https://help.cloudflare.com)
- **Security Documentation:** [developers.cloudflare.com/security](https://developers.cloudflare.com/security)
- **Community Forum:** [community.cloudflare.com](https://community.cloudflare.com)

---

## ✅ **VERIFICATION CHECKLIST**

- [ ] WAF rules deployed successfully
- [ ] Rate limiting configured
- [ ] Security features enabled (HTTPS, HSTS)
- [ ] Page rules created for admin/API protection
- [ ] Test attacks are blocked
- [ ] Legitimate traffic flows normally
- [ ] Monitoring alerts configured
- [ ] Documentation updated

---

*🎯 **Goal:** Deploy comprehensive WAF protection without breaking legitimate functionality*
