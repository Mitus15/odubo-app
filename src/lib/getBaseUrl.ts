export function getBaseUrl(headers?: Headers | { get(key: string): string | null } | undefined): string {
  // Prefer host header when available (useful during SSR on Vercel or local dev with custom host/port)
  try {
    const proto = (headers && (headers as any).get && (headers as any).get('x-forwarded-proto')) || 'https';
    const host = (headers && (headers as any).get && (headers as any).get('host')) || null;
    const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || '';
    const normalizedEnvUrl = envUrl ? (envUrl.startsWith('http') ? envUrl : `https://${envUrl}`) : '';

    const base = host ? `${proto}://${host}` : (normalizedEnvUrl || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3000'));
    // Remove trailing slash
    return base.replace(/\/$/, '');
  } catch (e) {
    const fallback = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return String(fallback).replace(/\/$/, '');
  }
}

export default getBaseUrl;
