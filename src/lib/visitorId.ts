/**
 * Visitor identification utilities for anonymous analytics.
 *
 * Provides:
 * - Persistent visitor ID (survives browser sessions)
 * - Browser fingerprint for cross-device correlation hints
 * - Identity linking after email capture
 */

const VISITOR_ID_KEY = 'odubo:visitor_id';
const FINGERPRINT_KEY = 'odubo:fingerprint';

/**
 * Get or create a persistent visitor ID.
 * Stored in localStorage to survive browser sessions.
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';

  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    // Fallback if localStorage blocked
    return `anon-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Generate a simple browser fingerprint hash.
 * Uses canvas, screen, and timezone to create a semi-stable identifier.
 * NOT for security purposes, just for correlation hints.
 */
export async function generateFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'server';

  try {
    // Check cache first
    const cached = sessionStorage.getItem(FINGERPRINT_KEY);
    if (cached) return cached;

    const components: string[] = [];

    // Screen properties
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

    // Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Language
    components.push(navigator.language);

    // Platform
    components.push(navigator.platform || 'unknown');

    // Canvas fingerprint (simple)
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Odubo fingerprint', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Odubo fingerprint', 4, 17);
        components.push(canvas.toDataURL().slice(-50));
      }
    } catch {
      components.push('canvas-unavailable');
    }

    // WebGL renderer
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl && gl instanceof WebGLRenderingContext) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown');
        }
      }
    } catch {
      components.push('webgl-unavailable');
    }

    // Hash the components
    const data = components.join('|');
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

    // Cache in session storage
    sessionStorage.setItem(FINGERPRINT_KEY, fingerprint);

    return fingerprint;
  } catch {
    return 'fingerprint-error';
  }
}

/**
 * Get cached fingerprint (synchronous) or empty if not yet generated.
 */
export function getCachedFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(FINGERPRINT_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear visitor identity (for testing or GDPR compliance).
 */
export function clearVisitorIdentity(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(VISITOR_ID_KEY);
    sessionStorage.removeItem(FINGERPRINT_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Link anonymous visitor to a known fan profile.
 * Call this after email capture.
 */
export async function linkVisitorToFan(
  email: string
): Promise<{ success: boolean; fanId?: string; error?: string }> {
  const visitorId = getVisitorId();
  const fingerprint = getCachedFingerprint() || await generateFingerprint();

  try {
    const res = await fetch('/api/analytics/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, email, fingerprint }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error || 'Failed to link identity' };
    }

    const data = await res.json();
    return { success: true, fanId: data.fanId };
  } catch {
    return { success: false, error: 'Network error' };
  }
}
