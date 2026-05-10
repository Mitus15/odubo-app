import { notFound } from 'next/navigation';
import { generateSeoMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import fs from 'fs';
import path from 'path';

// Map slugs to actual doc file paths (relative to docs/)
const docMap: Record<string, string> = {
  'vision': 'VISION.md',
  'content-architecture': 'CONTENT_SYSTEM_ARCHITECTURE.md',
  'moments-architecture': 'moments/ARCHITECTURE.md',
  'moments-roadmap': 'moments/ROADMAP.md',
  'odubo-wrld-vision': 'COOL_WRLD/VISION.md',
  'odubo-wrld-technical': 'COOL_WRLD/TECHNICAL_IMPLEMENTATION.md',
  'business-launch': 'BUSINESS_LAUNCH_CHECKLIST.md',
  'deployment': 'DEPLOYMENT.md',
};

const docTitles: Record<string, string> = {
  'vision': 'Strategic Vision',
  'content-architecture': 'Content System Architecture',
  'moments-architecture': 'Moments App — Architecture',
  'moments-roadmap': 'Moments App — Roadmap',
  'odubo-wrld-vision': 'Odubo Wrld — Creative Vision',
  'odubo-wrld-technical': 'Odubo Wrld — Technical Implementation',
  'business-launch': 'Business Launch Checklist',
  'deployment': 'Deployment Guide',
};

// Patterns to redact (regex patterns for sensitive data)
const REDACT_PATTERNS: RegExp[] = [
  // API keys and tokens
  /\b(sk[-_][a-zA-Z0-9]{20,})\b/g,
  /\b(pk[-_][a-zA-Z0-9]{20,})\b/g,
  /\b(AKIA[0-9A-Z]{16})\b/g,
  /\b(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
  // Cloudflare tokens
  /\b([A-Za-z0-9_-]{30,40})\b(?=.*(?:token|key|secret))/gi,
  // Generic secret patterns
  /\b(secret|password|passwd|pwd|token|api[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}['"]?/gi,
  // Environment variable values that look like secrets
  /(CLOUDFLARE_R2_SECRET_ACCESS_KEY|CLOUDFLARE_STREAM_API_TOKEN|CLOUDFLARE_D1_API_TOKEN|CLOUDFLARE_API_TOKEN|POSTFORME_API_KEY|RESEND_API_KEY|GEMINI_API_KEY|DEEPSEEK_API_KEY|CLERK_SECRET_KEY|SHOPIFY_CLIENT_SECRET|GOOGLE_CLIENT_SECRET|ADMIN_JWT_SECRET|JWT_SECRET|CRON_SECRET)\s*=\s*['"]?[a-zA-Z0-9_-]{16,}['"]?/gi,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Internal/localhost URLs
  /http:\/\/localhost:\d+/g,
  /http:\/\/127\.0\.0\.1:\d+/g,
  // Private IPs
  /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
  /\b(172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g,
  /\b(192\.168\.\d{1,3}\.\d{1,3})\b/g,
];

function redactSensitiveContent(content: string): string {
  let redacted = content;
  for (const pattern of REDACT_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      // Don't redact if it's clearly a placeholder or example
      if (
        match.includes('xxx') ||
        match.includes('your-') ||
        match.includes('example') ||
        match.includes('placeholder')
      ) {
        return match;
      }
      return `[REDACTED]`;
    });
  }
  return redacted;
}

function simpleMarkdownToHtml(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="doc-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="doc-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="doc-h1">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="doc-code">$1</code>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="doc-li">$1</li>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="doc-blockquote">$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="doc-hr" />');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li class="doc-li">.*?<\/li>\n?)+/g, '<ul class="doc-ul">$&</ul>');

  // Wrap consecutive <blockquote> in container
  html = html.replace(/(<blockquote class="doc-blockquote">.*?<\/blockquote>\n?)+/g, '<div class="doc-blockquote-wrapper">$&</div>');

  // Paragraphs (catch remaining text)
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('</ul') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('</li') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('</blockquote') ||
      trimmed.startsWith('<div') ||
      trimmed.startsWith('</div') ||
      trimmed.startsWith('<code') ||
      trimmed.startsWith('<hr') ||
      trimmed === '' ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('---')
    ) {
      result.push(trimmed);
    } else if (trimmed) {
      result.push(`<p class="doc-p">${trimmed}</p>`);
    }
  }

  return result.join('\n');
}

export async function generateStaticParams() {
  return Object.keys(docMap).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = docTitles[slug] || 'Document';
  return generateSeoMetadata({
    title: `${title} — Case Study`,
    description: `Public documentation: ${title}`,
    path: `/docs/${slug}`,
  });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const relativePath = docMap[slug];

  if (!relativePath) {
    notFound();
  }

  const fullPath = path.join(process.cwd(), 'docs', relativePath);

  if (!fs.existsSync(fullPath)) {
    notFound();
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  content = redactSensitiveContent(content);
  const html = simpleMarkdownToHtml(content);
  const title = docTitles[slug] || 'Document';

  return (
    <div className="min-h-screen bg-[#f5f0eb]">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
        <a
          href="/docs"
          className="inline-flex items-center gap-1.5 text-sm text-[#843c2d] hover:text-[#a85a48] transition-colors mb-8 font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Documentation
        </a>

        <div className="text-[0.625rem] font-semibold tracking-[0.2em] uppercase text-[#843c2d] mb-3">
          Public Documentation
        </div>
        <h1 className="font-['Baskerville'] text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.15] text-[#1a1a1a] mb-10">
          {title}
        </h1>

        <div className="bg-white border border-[#efe9e3] rounded-2xl p-6 sm:p-10 shadow-sm">
          <div
            className="doc-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <div className="mt-8 text-xs text-[#9c9490] border-t border-[#e5ddd6] pt-6">
          <p>This document has been sanitized for public viewing. Sensitive information (API keys, credentials, internal URLs) has been redacted.</p>
        </div>
      </div>
    </div>
  );
}
