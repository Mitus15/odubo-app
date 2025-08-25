# 🚀 Monitoring Components Guide

## Overview
Odubo Studio includes several monitoring components for development and debugging. These are **hidden by default in production** to maintain a clean user experience.

## 🔧 Available Components

### 1. 📊 Performance Monitor
- **Purpose**: Real-time Core Web Vitals tracking
- **Default**: Hidden in production
- **Enable**: Set `NEXT_PUBLIC_SHOW_PERFORMANCE_MONITOR=true`

### 2. 🔒 Security Monitor  
- **Purpose**: Security events and alerts
- **Default**: Hidden in production
- **Enable**: Set `NEXT_PUBLIC_SHOW_SECURITY_MONITOR=true`

### 3. 🍪 GDPR Consent
- **Purpose**: Cookie preferences management (LEGAL REQUIREMENT)
- **Default**: **ALWAYS VISIBLE** in production (GDPR compliance)
- **Note**: Cannot be disabled - required by law

### 4. ♿ Accessibility Enhancer
- **Purpose**: WCAG compliance features
- **Default**: Hidden in production
- **Enable**: Set `NEXT_PUBLIC_SHOW_ACCESSIBILITY_ENHANCER=true`

## 🌍 Environment Control

### Development (Default)
```bash
# All monitoring components visible
npm run dev
```

### Production (Default)
```bash
# All monitoring components hidden
npm run build && npm start
```

### Production with Monitoring
```bash
# Enable specific components
NEXT_PUBLIC_SHOW_PERFORMANCE_MONITOR=true npm run build
NEXT_PUBLIC_SHOW_SECURITY_MONITOR=true npm start
```

## 📱 User Experience

- **Development**: Full monitoring suite visible
- **Production**: GDPR consent visible (legal requirement), other monitoring hidden
- **Override**: Environment variables for specific needs

## 🎯 Best Practices

1. **Always show GDPR consent in production (legal requirement)**
2. **Hide development monitoring in production by default**
3. **Use environment variables for temporary debugging**
4. **Monitor performance through analytics instead**
5. **Keep security monitoring server-side only**
