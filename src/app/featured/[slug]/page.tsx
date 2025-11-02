import type { Metadata } from 'next';
import type { FeaturedConfig } from './FeaturedInteractive';
import FeaturedHeroClient from './FeaturedHeroClient';
import { queryDatabase } from '@/lib/db';

// In the future, fetch this from D1 or Admin-configured CMS. For now, inline config.
const FEATURED_MAP: Record<string, FeaturedConfig> = {
  'catching-light': {
    slug: 'catching-light',
    title: 'Catching Light',
    subtitle: 'A moving painting — a featured experience',
    date: 'November 15, 2025',
    venue: 'TRU Art Gallery',
    momentsLink: '/moments', // TODO: replace with event-specific join link
    extraLinks: [
      { label: 'Apple Music', href: '#' },
      { label: 'Spotify', href: '#' }
    ],
    // Provide later: backgroundVideoUrl: 'https://media.odubo.studio/featured/catching-light/loop.mp4'
  }
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = slug.toLowerCase();
  let cfg = FEATURED_MAP[s];
  try {
    const rows = await queryDatabase(
      `SELECT title, subtitle, date_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json
       FROM featured_pages WHERE slug = ? LIMIT 1`,
      [s]
    );
    if (rows && rows.length) {
      const r: any = rows[0];
      const extraLinks = (() => { try { return JSON.parse(r.extra_links_json || '[]'); } catch { return []; } })();
      cfg = {
        slug: s,
        title: r.title,
        subtitle: r.subtitle || undefined,
        date: r.date_text || undefined,
        venue: r.venue || undefined,
        momentsLink: r.moments_link || undefined,
        backgroundVideoUrl: r.background_video_url || undefined,
        extraLinks,
      } as FeaturedConfig;
    }
  } catch {}
  const title = cfg ? `Featured: ${cfg.title}` : 'Featured';
  const description = cfg?.subtitle || 'A featured experience by Odubo Studio';
  const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://odubo.studio'}/featured/${s}`;
  const images = [{ url: '/odubo_logo_emboss.png' }]; // TODO: replace with project OG image
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    }
  };
}

export default async function FeaturedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = slug.toLowerCase();
  let cfg = FEATURED_MAP[s];
  try {
    const rows = await queryDatabase(
      `SELECT title, subtitle, date_text, venue, album_link, moments_link, cover_image_url, background_video_url, extra_links_json
       FROM featured_pages WHERE slug = ? LIMIT 1`,
      [s]
    );
    if (rows && rows.length) {
      const r: any = rows[0];
      const extraLinks = (() => { try { return JSON.parse(r.extra_links_json || '[]'); } catch { return []; } })();
      cfg = {
        slug: s,
        title: r.title,
        subtitle: r.subtitle || undefined,
        date: r.date_text || undefined,
        venue: r.venue || undefined,
        momentsLink: r.moments_link || undefined,
        backgroundVideoUrl: r.background_video_url || undefined,
        extraLinks,
      } as FeaturedConfig;
    }
  } catch {}
  if (!cfg) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#171616] text-[#ede8df]">
        <div>Not found.</div>
      </div>
    );
  }

  return <FeaturedHeroClient config={cfg} />;
}
