/**
 * SEO Configuration and Utilities
 * Centralized metadata management for consistent social sharing
 */

import type { Metadata } from 'next';

// Base URL for the application
export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://odubo.studio';

// Default SEO values
export const DEFAULT_SEO = {
  siteName: 'Odubo Studio',
  title: 'Odubo Studio',
  description: 'Experience music, fashion, and art from Odubo. Watch exclusive clips, shop the latest drops, and join the community.',
  ogImage: '/brand-logos/Danceman_Logo_Red.png',
  twitterHandle: '@odubostudio',
  locale: 'en_US',
  themeColor: '#843c2d',
};

// Generate full metadata object for a page
export function generateSeoMetadata({
  title,
  description,
  path = '',
  ogImage,
  noIndex = false,
  type = 'website',
}: {
  title?: string;
  description?: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
  // No 'product': Next's Metadata API only accepts the OpenGraph types it
  // models (website / article / book / profile / music.* / video.*) and throws
  // "Invalid OpenGraph type: product" at render. `product` is an OG extension
  // Facebook understands but Next does not — it is expressed through the
  // `product:price:*` meta tags instead (see generateProductMetadata).
  type?: 'website' | 'article' | 'music.album' | 'video.other';
}): Metadata {
  const fullTitle = title
    ? `${title} | ${DEFAULT_SEO.siteName}`
    : DEFAULT_SEO.title;

  const fullDescription = description || DEFAULT_SEO.description;
  const fullUrl = `${BASE_URL}${path}`;
  const fullOgImage = ogImage || DEFAULT_SEO.ogImage;
  const ogImageUrl = fullOgImage.startsWith('http') ? fullOgImage : `${BASE_URL}${fullOgImage}`;

  return {
    title: fullTitle,
    description: fullDescription,
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: fullUrl,
    },
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      url: fullUrl,
      siteName: DEFAULT_SEO.siteName,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title || DEFAULT_SEO.siteName,
        },
      ],
      locale: DEFAULT_SEO.locale,
      type,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      images: [ogImageUrl],
      creator: DEFAULT_SEO.twitterHandle,
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    other: {
      'theme-color': DEFAULT_SEO.themeColor,
    },
  };
}

// Generate metadata for product pages
export function generateProductMetadata({
  title,
  description,
  handle,
  image,
  price,
  currency = 'USD',
}: {
  title: string;
  description?: string;
  handle: string;
  image?: string;
  price?: string;
  currency?: string;
}): Metadata {
  const metadata = generateSeoMetadata({
    title,
    description: description || `Shop ${title} at Odubo Studio`,
    path: `/store/product/${handle}`,
    ogImage: image,
    type: 'website',
  });

  // og:type stays "website". Next emits og:* as `property=`, but anything in
  // `other` comes out as `name=`, so re-declaring og:type here just produces
  // two contradictory tags and scrapers read the `property=` one regardless.
  // The price tags below are what actually carry the commerce signal.
  if (price) {
    metadata.other = {
      ...metadata.other,
      'product:price:amount': price,
      'product:price:currency': currency ?? '',
    };
  }

  return metadata;
}

// Generate metadata for video/clip pages
export function generateVideoMetadata({
  title,
  description,
  videoId,
  thumbnail,
  duration,
}: {
  title: string;
  description?: string;
  videoId: string | number;
  thumbnail?: string;
  duration?: number;
}): Metadata {
  const metadata = generateSeoMetadata({
    title,
    description: description || `Watch ${title} on Odubo Studio`,
    path: `/media/${videoId}`,
    ogImage: thumbnail,
    type: 'video.other',
  });

  if (duration) {
    metadata.other = {
      ...metadata.other,
      'video:duration': duration.toString(),
    };
  }

  return metadata;
}

// Generate metadata for album pages
export function generateAlbumMetadata({
  title,
  artist,
  description,
  albumId,
  coverImage,
  releaseDate,
}: {
  title: string;
  artist?: string;
  description?: string;
  albumId: string | number;
  coverImage?: string;
  releaseDate?: string;
}): Metadata {
  const fullDescription = description || `Listen to ${title}${artist ? ` by ${artist}` : ''} on Odubo Studio`;

  const metadata = generateSeoMetadata({
    title: artist ? `${title} - ${artist}` : title,
    description: fullDescription,
    path: `/music/albums/${albumId}`,
    ogImage: coverImage,
    type: 'music.album',
  });

  if (releaseDate) {
    metadata.other = {
      ...metadata.other,
      'music:release_date': releaseDate,
    };
  }

  return metadata;
}
