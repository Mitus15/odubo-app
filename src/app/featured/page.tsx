import type { Metadata } from 'next';
import type { FeaturedConfig } from './[slug]/FeaturedInteractive';
import FeaturedHeroClient from './[slug]/FeaturedHeroClient';
import { executeQuery, queryDatabase } from '@/lib/db';

async function loadSingleton(): Promise<FeaturedConfig | null> {
  const rows = await queryDatabase(
    `SELECT slug, title, subtitle, date_text, time_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json FROM featured_pages LIMIT 1`,
    []
  );
  if (rows && rows.length) {
    const r: any = rows[0];
    const extraLinks = (() => { try { return JSON.parse(r.extra_links_json || '[]'); } catch { return []; } })();
    // Derive SSR label and target path for Moments button based on schedule
    let momentsButtonLabel: 'RSVP' | 'Moments' | undefined;
    let momentsTargetPath: string | undefined;
    const ml: string | undefined = r.moments_link || undefined;
    if (ml) {
      const m = String(ml).match(/[?&]galleryId=(\d+)/);
      const gid = m ? m[1] : '';
      if (gid) {
        try {
          const gRows = await queryDatabase('SELECT id, starts_at, ends_at FROM galleries WHERE id = ? LIMIT 1', [Number(gid)]);
          if (gRows && gRows[0]) {
            const starts = gRows[0].starts_at ? Date.parse(gRows[0].starts_at as string) : NaN;
            const now = Date.now();
            const beforeStart = Number.isFinite(starts) ? now < starts : false;
            momentsButtonLabel = beforeStart ? 'RSVP' : 'Moments';
            momentsTargetPath = beforeStart ? `/moments/rsvp/${encodeURIComponent(gid)}` : `/moments?galleryId=${encodeURIComponent(gid)}`;
          }
        } catch {}
      }
    }
    return {
      slug: r.slug || 'featured',
      title: r.title,
      subtitle: r.subtitle || undefined,
  date: r.date_text || undefined,
  time: r.time_text || undefined,
      venue: r.venue || undefined,
      momentsLink: r.moments_link || undefined,
      momentsButtonLabel,
      momentsTargetPath,
      backgroundVideoUrl: r.background_video_url || undefined,
      extraLinks,
    } as FeaturedConfig;
  }
  // Create default if missing (server-side safety)
  await executeQuery(`INSERT INTO featured_pages (slug, title, is_published, created_at, updated_at) VALUES (?, ?, 1, datetime('now'), datetime('now'))`, ['featured', 'Featured']);
  return {
    slug: 'featured',
    title: 'Featured',
    extraLinks: [],
  } as FeaturedConfig;
}

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await loadSingleton();
  const title = cfg ? `Featured: ${cfg.title}` : 'Featured';
  const description = cfg?.subtitle || 'A featured experience by Odubo Studio';
  const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://odubo.studio'}/featured`;
  const images = [{ url: '/odubo_logo_emboss.png' }];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, images },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function FeaturedIndexPage() {
  const cfg = await loadSingleton();
  return <FeaturedHeroClient config={cfg!} />;
}
