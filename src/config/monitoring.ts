// Monitoring Configuration
// Controls which monitoring components are visible in different environments

export const monitoringConfig = {
  // Performance Monitor
  performance: {
    enabled: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SHOW_PERFORMANCE_MONITOR === 'true',
    position: 'bottom-right' as const,
    zIndex: 50,
  },
  
  // Security Monitor
  security: {
    enabled: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SHOW_SECURITY_MONITOR === 'true',
    position: 'bottom-right' as const,
    zIndex: 50,
  },
  
  // GDPR Consent - ALWAYS enabled for legal compliance
  gdpr: {
    enabled: true, // Always enabled for GDPR compliance
    // Exempt from the developmentOnly rule below. Without this the comment
    // above was simply untrue: in production `enabled && !developmentOnly`
    // evaluated to false, GDPRConsent returned null, and the live site showed
    // no cookie banner at all. This is a legal-compliance surface, not a
    // developer monitoring widget, and it must not share their visibility rule.
    alwaysOn: true,
    position: 'bottom-left' as const,
    zIndex: 50,
  },
  
  // Accessibility Enhancer
  accessibility: {
    enabled: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SHOW_ACCESSIBILITY_ENHANCER === 'true',
    position: 'bottom-left' as const,
    zIndex: 50,
  },
  
  // Global monitoring settings
  global: {
    // Only show in development by default
    developmentOnly: true,
    
    // Allow override via environment variables
    allowOverride: process.env.NODE_ENV === 'development',
    
    // Position offsets to prevent overlap
    positionOffset: {
      'bottom-left': { bottom: 4, left: 4 },
      'bottom-right': { bottom: 4, right: 4 },
      'top-left': { top: 4, left: 4 },
      'top-right': { top: 4, right: 4 },
    },
  },
};

// Helper function to check if monitoring is enabled
export const isMonitoringEnabled = (component: keyof typeof monitoringConfig) => {
  if (component === 'global') return false;
  
  const config = monitoringConfig[component];
  if (!config) return false;

  // Compliance surfaces ignore the developmentOnly rule entirely — they exist
  // for visitors, not for us.
  if ((config as { alwaysOn?: boolean }).alwaysOn) return config.enabled;

  // In production, only show if explicitly enabled
  if (process.env.NODE_ENV === 'production') {
    return config.enabled && !monitoringConfig.global.developmentOnly;
  }
  
  // In development, show by default
  return config.enabled;
};

// Helper function to get component position
export const getComponentPosition = (component: keyof typeof monitoringConfig) => {
  if (component === 'global') return {};
  
  const config = monitoringConfig[component];
  if (!config) return {};
  
  const offset = monitoringConfig.global.positionOffset[config.position];
  return {
    ...offset,
    zIndex: config.zIndex,
  };
};
